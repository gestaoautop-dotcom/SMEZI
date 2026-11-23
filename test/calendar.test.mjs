import {test} from 'node:test';
import assert from 'node:assert/strict';
import {d1,r2,mockFetch} from './support/d1.mjs';
import {handle} from '../server/worker.mjs';
import {sign,seal} from '../server/security.mjs';
import {tick} from '../server/queue.mjs';

const KEY='b'.repeat(64);
const JPEG=new Uint8Array([0xFF,0xD8,0xFF,0xE0,1,2,3,4,5,0xFF,0xD9]);
const SCOPES=['instagram_basic','instagram_content_publish','pages_show_list','pages_read_engagement','pages_manage_posts'];
async function fixture({publishing=false}={}){
 const {sql,DB}=d1();
 const env={DB,MEDIA:r2(),ASSETS:{fetch:()=>new Response('asset')},APP_ORIGIN:'https://engine.example',SESSION_SECRET:'session-secret-with-more-than-thirty-two-chars',GITHUB_ALLOWED_ID:'owner',GITHUB_CLIENT_ID:'id',GITHUB_CLIENT_SECRET:'secret',
  TOKEN_ENCRYPTION_KEY:KEY,META_API_VERSION:'v99.0',META_APP_ID:'123',META_APP_SECRET:'s',INSTAGRAM_UNIFIED_CONFIG_ID:'456',
  PUBLISHING_ENABLED:publishing?'true':'false',SCHEDULER_ENABLED:publishing?'true':'false',CRON_SECRET:'c'.repeat(40),X_CLIENT_ID:'x',X_CLIENT_SECRET:'y'};
 const far=Date.now()+30*86400000,time=new Date().toISOString();
 sql.prepare('INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('owner','instagram','IG1','cws',await seal(env,{access_token:'ig-user',auth_mode:'instagram_unified',granted_scopes:SCOPES},'owner:instagram'),far,time);
 sql.prepare('INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('owner','facebook','PAGE1','CWS',await seal(env,{access_token:'ig-user',auth_mode:'facebook_page_unified',granted_scopes:SCOPES},'owner:facebook'),far,time);
 sql.prepare('INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('owner','x','X1','cws',await seal(env,{access_token:'x-token'},'owner:x'),far,time);
 sql.prepare("INSERT INTO scheduler_heartbeat(id,updated_at) VALUES('scheduler',?)").run(time);
 return {sql,env};
}
async function req(env,path,data,{method,headers={},raw,origin}={}){
 const token=await sign(env,{sub:'owner',login:'caroline'},'session');
 const body=raw!==undefined?raw:data===undefined?undefined:JSON.stringify(data);
 return handle(new Request(env.APP_ORIGIN+path,{method:method||(body===undefined?'GET':'POST'),headers:{Cookie:'__Host-smezi_session='+token,Origin:origin||env.APP_ORIGIN,...(raw===undefined?{'Content-Type':'application/json'}:{}),...headers},body}),env);
}
async function upload(env){
 const r=await req(env,'/api/media?name=foto.jpg',undefined,{raw:JPEG,headers:{'Content-Type':'image/jpeg'}});
 assert.equal(r.status,201);return r.json();
}
const future=(h=48)=>new Date(Date.now()+h*3600000).toISOString();

test('photo upload accepts only JPEG from the app origin; public URL is unguessable and serves the image',async()=>{
 const {env}=await fixture();
 const media=await upload(env);
 assert.match(media.publicURL,/^https:\/\/engine\.example\/m\/[a-f0-9]{32}\.jpg$/);
 assert.equal((await req(env,'/api/media',undefined,{raw:new Uint8Array([1,2,3]),headers:{'Content-Type':'image/jpeg'}})).status,415);
 assert.equal((await req(env,'/api/media',undefined,{raw:JPEG,headers:{'Content-Type':'image/png'}})).status,415);
 assert.equal((await req(env,'/api/media',undefined,{raw:JPEG,headers:{'Content-Type':'image/jpeg'},origin:'https://evil.example'})).status,403);
 const pub=await handle(new Request(media.publicURL),env);
 assert.equal(pub.status,200);assert.equal(pub.headers.get('Content-Type'),'image/jpeg');assert.equal(pub.headers.get('X-Robots-Tag'),'noindex');
 assert.deepEqual(new Uint8Array(await pub.arrayBuffer()),JPEG);
 assert.equal((await handle(new Request(env.APP_ORIGIN+'/m/'+'0'.repeat(32)+'.jpg'),env)).status,404);
 assert.equal((await handle(new Request(media.publicURL,{method:'POST'}),env)).status,404);
 assert.equal((await handle(new Request(env.APP_ORIGIN+media.previewURL),env)).status,401);
 assert.equal((await req(env,media.previewURL)).status,200);
});

test('batch creates one versioned draft per network; photo only where supported; Instagram requires photo',async()=>{
 const {env}=await fixture();
 const media=await upload(env);
 const noPhoto=await req(env,'/api/batches',{caption:'Legenda',networks:['Instagram'],plannedAt:future()});
 assert.equal(noPhoto.status,400);
 const r=await req(env,'/api/batches',{caption:'Bastidores da entrega',networks:['Instagram','Facebook','X'],overrides:{X:'Versão curta para o X'},mediaId:media.id,plannedAt:future()});
 assert.equal(r.status,201);const batch=await r.json();
 assert.deepEqual(batch.items.map(i=>[i.platform,i.hasMedia,i.approved]),[['Facebook',true,false],['Instagram',true,false],['X',false,false]]);
 assert.equal(batch.items.find(i=>i.platform==='X').text,'Versão curta para o X');
 const tooLong=await req(env,'/api/batches',{caption:'x'.repeat(300),networks:['X'],plannedAt:future()});
 assert.equal(tooLong.status,400);
 const cal=await (await req(env,`/api/calendar?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(future(24*10))}`)).json();
 assert.equal(cal.batches.length,1);assert.equal(cal.batches[0].previewURL,'/api/media/'+media.id);
});

test('approve + schedule all networks at the batch time; revision and move invalidate pending jobs',async()=>{
 const {env,sql}=await fixture({publishing:true});
 const media=await upload(env);
 const batch=await (await req(env,'/api/batches',{caption:'Lote',networks:['Instagram','Facebook','X'],mediaId:media.id,plannedAt:future()})).json();
 const early=await (await req(env,`/api/batches/${batch.id}/schedule`,{})).json();
 assert.ok(early.results.every(x=>!x.ok&&/Aprove/.test(x.error)));
 const approved=await (await req(env,`/api/batches/${batch.id}/approve`,{})).json();
 assert.ok(approved.results.every(x=>x.ok));assert.ok(approved.batch.items.every(i=>i.approved));
 const scheduled=await (await req(env,`/api/batches/${batch.id}/schedule`,{})).json();
 assert.ok(scheduled.results.every(x=>x.ok),JSON.stringify(scheduled.results));
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM jobs WHERE status='pending' AND scheduled_at=?").get(batch.plannedAt).n,3);
 const again=await (await req(env,`/api/batches/${batch.id}/schedule`,{})).json();
 assert.ok(again.results.every(x=>x.already));
 const revised=await (await req(env,`/api/batches/${batch.id}/revise`,{platform:'X',text:'Texto novo'})).json();
 const x=revised.items.find(i=>i.platform==='X');
 assert.equal(x.revision,2);assert.equal(x.approved,false);assert.equal(x.job.status,'cancelled');
 assert.equal(revised.items.find(i=>i.platform==='Instagram').job.status,'pending');
 const moved=await (await req(env,`/api/batches/${batch.id}/move`,{plannedAt:future(72)})).json();
 assert.ok(moved.items.every(i=>i.job.status==='cancelled'));
 assert.equal(moved.plannedAt,new Date(Date.parse(moved.plannedAt)).toISOString());
});

test('publishing stays off by default: scheduling reports per network without throwing',async()=>{
 const {env}=await fixture({publishing:false});
 const batch=await (await req(env,'/api/batches',{caption:'Só texto',networks:['Facebook','X'],plannedAt:future()})).json();
 await req(env,`/api/batches/${batch.id}/approve`,{});
 const r=await (await req(env,`/api/batches/${batch.id}/schedule`,{})).json();
 assert.ok(r.results.every(x=>!x.ok&&/Ative a publicação/.test(x.error)));
});

test('scheduler publishes Instagram (Facebook Login) and Facebook Page with photo through the Graph API',async()=>{
 const {env,sql}=await fixture({publishing:true});
 const media=await upload(env);
 const batch=await (await req(env,'/api/batches',{caption:'Publicação real',networks:['Instagram','Facebook'],mediaId:media.id,plannedAt:future()})).json();
 await req(env,`/api/batches/${batch.id}/approve`,{});
 await req(env,`/api/batches/${batch.id}/schedule`,{});
 sql.prepare("UPDATE jobs SET scheduled_at=?").run(new Date(Date.now()-1000).toISOString());
 const meta=mockFetch([
  [/\/IG1\/media$/,{id:'container-1'}],[/container-1\?fields=status_code/,{status_code:'FINISHED'}],[/\/IG1\/media_publish$/,{id:'ig-post-1'}],
  [/\/PAGE1\?fields=access_token/,{access_token:'page-token'}],[/\/PAGE1\/photos$/,{id:'photo-1',post_id:'PAGE1_99'}]
 ]);
 try{
  await tick(env);
  const jobs=sql.prepare('SELECT provider,status,remote_id FROM jobs ORDER BY provider').all().map(j=>({...j}));
  assert.deepEqual(jobs,[{provider:'facebook',status:'published',remote_id:'PAGE1_99'},{provider:'instagram',status:'published',remote_id:'ig-post-1'}]);
  const container=meta.calls.find(c=>c.url.endsWith('/v99.0/IG1/media'));
  assert.equal(new URLSearchParams(container.body).get('image_url'),media.publicURL);
  const photo=meta.calls.find(c=>c.url.endsWith('/PAGE1/photos'));
  assert.equal(photo.headers.Authorization,'Bearer page-token');
  assert.equal(new URLSearchParams(photo.body).get('url'),media.publicURL);
 }finally{meta.restore()}
});

test('Facebook publishing is refused without pages_manage_posts and nothing is sent',async()=>{
 const {env,sql}=await fixture({publishing:true});
 sql.prepare("UPDATE connections SET encrypted_token=? WHERE provider='facebook'").run(await seal(env,{access_token:'u',auth_mode:'facebook_page_unified',granted_scopes:['pages_show_list']},'owner:facebook'));
 const batch=await (await req(env,'/api/batches',{caption:'Texto',networks:['Facebook'],plannedAt:future()})).json();
 await req(env,`/api/batches/${batch.id}/approve`,{});await req(env,`/api/batches/${batch.id}/schedule`,{});
 sql.prepare("UPDATE jobs SET scheduled_at=?").run(new Date(Date.now()-1000).toISOString());
 const meta=mockFetch([]);
 try{await tick(env);
  const job=sql.prepare('SELECT status,error FROM jobs').get();
  assert.equal(job.status,'failed');assert.match(job.error,/pages_manage_posts/);
  assert.equal(meta.calls.length,0);
 }finally{meta.restore()}
});
