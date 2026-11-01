import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle} from '../server/worker.mjs';
import {sign,identity,seal,unseal,cookie,hash,verify} from '../server/security.mjs';
import {sync,snapshot,approve,statement,quota} from '../server/store.mjs';
import {schedule,tick} from '../server/queue.mjs';
import {connect} from '../server/social.mjs';
import {generate} from '../server/ai.mjs';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_content_engine.sql',import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return sql.prepare(query).run(...args)},_query:query,_args:args}}}},async batch(items){sql.exec('BEGIN');try{const result=items.map(x=>sql.prepare(x._query).run(...x._args));sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
 const env={DB,APP_ORIGIN:'https://engine.example',SESSION_SECRET:'session-secret-with-more-than-thirty-two-chars',GITHUB_ALLOWED_ID:'owner',GITHUB_CLIENT_ID:'github-app',GITHUB_CLIENT_SECRET:'github-secret',TOKEN_ENCRYPTION_KEY:'b'.repeat(64),PUBLISHING_ENABLED:'true',SCHEDULER_ENABLED:'true',CRON_SECRET:'cron-secret-with-more-than-thirty-two-chars',X_CLIENT_ID:'x-app',X_CLIENT_SECRET:'x-secret',AI_MODEL:'test-model'};
 return {sql,env};
}
const blank=()=>({memories:[],ideas:[],posts:[]});
const post=(id='a',values={})=>({id,rootId:'a',text:'Minha criação real.',platform:'X',lang:'pt',status:'draft',at:'2026-10-31',...values});
async function request(env,path,data,options={}){const token=await sign(env,{sub:options.owner||'owner',login:'caroline'},'session');return handle(new Request(env.APP_ORIGIN+path,{method:data===undefined?'GET':'POST',headers:{Cookie:'__Host-smezi_session='+token,Origin:env.APP_ORIGIN,'Content-Type':'application/json',...options.headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env)}
async function setupQueue(env){await sync(env,'owner',{...blank(),posts:[post()]});await approve(env,'owner','a');await statement(env,'INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)','owner','x','social-owner','CWS',await seal(env,{access_token:'private-access'},'owner:x'),Date.now()+3600000,new Date().toISOString()).run();await statement(env,'INSERT INTO scheduler_heartbeat VALUES(?,?)','scheduler',new Date().toISOString()).run();return schedule(env,'owner',{recordId:'a',scheduledAt:new Date(Date.now()+120000).toISOString()})}
test('no login, forged cookie, wrong owner and CSRF cannot access cloud data',async()=>{
 const {env}=fixture();assert.equal((await handle(new Request(env.APP_ORIGIN+'/api/state'),env)).status,401);
 assert.equal((await handle(new Request(env.APP_ORIGIN+'/api/state',{headers:{Cookie:'__Host-smezi_session=forged'}}),env)).status,401);
 assert.equal((await request(env,'/api/state',undefined,{owner:'other'})).status,403);
 assert.equal((await request(env,'/api/sync',blank(),{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await handle(new Request(env.APP_ORIGIN+'/api/status'),env)).status,200);
 const status=await (await handle(new Request(env.APP_ORIGIN+'/api/status'),env)).text();assert.ok(!status.includes(env.SESSION_SECRET));assert.ok(!status.includes(env.GITHUB_CLIENT_SECRET));
});
test('session purpose and expiry are enforced',async()=>{
 const {env}=fixture();const wrong=await sign(env,{sub:'owner'},'github-login');await assert.rejects(()=>identity(new Request(env.APP_ORIGIN,{headers:{Cookie:'__Host-smezi_session='+wrong}}),env));
 const expired=await sign(env,{sub:'owner'},'session',-10);await assert.rejects(()=>verify(env,expired,'session'));
});
test('token ciphertext is authenticated and bound to owner/provider',async()=>{
 const {env}=fixture();const encrypted=await seal(env,{access_token:'private'},'owner:x');assert.ok(!encrypted.includes('private'));assert.deepEqual(await unseal(env,encrypted,'owner:x'),{access_token:'private'});await assert.rejects(()=>unseal(env,encrypted,'other:x'));
});
test('sync isolates owners, rejects conflicting writes atomically and preserves original local payloads',async()=>{
 const {env}=fixture();const data={...blank(),posts:[post()]};await sync(env,'owner',data);assert.equal((await snapshot(env,'other')).posts.length,0);
 const conflicting={...blank(),ideas:[{id:'idea',text:'new'}],posts:[post('a',{text:'overwrite'})]};await assert.rejects(()=>sync(env,'owner',conflicting),/Conflito/);assert.equal((await snapshot(env,'owner')).ideas.length,0);assert.equal((await snapshot(env,'owner')).posts[0].text,post().text);
 await sync(env,'owner',data);assert.equal((await snapshot(env,'owner')).posts.length,1);
});
test('cloud restore requires own backup prefix and import cannot grant approval',async()=>{
 const {env}=fixture();assert.equal((await request(env,'/api/backups/restore',{key:'backups/other/a.json'})).status,403);
 await sync(env,'owner',{...blank(),posts:[post('a',{status:'approved'})]});await statement(env,'INSERT INTO scheduler_heartbeat VALUES(?,?)','scheduler',new Date().toISOString()).run();
 // Even with a connected account, imported status is not a server approval.
 await statement(env,'INSERT INTO connections VALUES(?,?,?,?,?,?,?)','owner','x','social-owner','CWS',await seal(env,{access_token:'private'},'owner:x'),Date.now()+3600000,new Date().toISOString()).run();
 await assert.rejects(()=>schedule(env,'owner',{recordId:'a',scheduledAt:new Date(Date.now()+120000).toISOString()}),/Aprove/);
});
test('approval locks latest immutable revision; edits cancel pending delivery',async()=>{
 const {env}=fixture();await setupQueue(env);await assert.rejects(()=>schedule(env,'owner',{recordId:'a',scheduledAt:new Date(Date.now()+120000).toISOString()}),/duplicada/);
 await sync(env,'owner',{...blank(),posts:[post('b',{parentId:'a',revision:2,text:'Correção'})]});
 assert.equal((await statement(env,'SELECT status FROM jobs').first()).status,'cancelled');await assert.rejects(()=>approve(env,'owner','a'),/mais recente/);await approve(env,'owner','b');
});
test('scheduler absence and pause prevent scheduling',async()=>{
 const {env}=fixture();await sync(env,'owner',{...blank(),posts:[post()]});await approve(env,'owner','a');await assert.rejects(()=>schedule(env,'owner',{recordId:'a',scheduledAt:new Date(Date.now()+120000).toISOString()}),/agendador/);
 env.PUBLISHING_ENABLED='false';assert.deepEqual(await tick(env),{paused:true});
});
test('two consumers cannot send the same job twice',async()=>{
 const {env}=fixture();await setupQueue(env);await statement(env,"UPDATE jobs SET scheduled_at='2000-01-01'").run();
 const original=globalThis.fetch;let sends=0;globalThis.fetch=async()=>{sends++;return new Response(JSON.stringify({data:{id:'published-id'}}),{status:201,headers:{'Content-Type':'application/json'}})};
 try{await Promise.all([tick(env),tick(env)]);assert.equal(sends,1);assert.equal((await statement(env,'SELECT status,remote_id FROM jobs').first()).status,'published')}finally{globalThis.fetch=original}
});
test('ambiguous delivery never retries; definite rate-limit rejection backs off',async()=>{
 const {env}=fixture();await setupQueue(env);await statement(env,"UPDATE jobs SET scheduled_at='2000-01-01'").run();const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('network timeout with potentially private token')};
 try{await tick(env);const row=await statement(env,'SELECT status,error FROM jobs').first();assert.equal(row.status,'uncertain');assert.ok(!row.error.includes('token'));assert.equal((await tick(env)).handled,0)}finally{globalThis.fetch=original}
 const other=fixture();await setupQueue(other.env);await statement(other.env,"UPDATE jobs SET scheduled_at='2000-01-01'").run();globalThis.fetch=async()=>new Response('{}',{status:429});try{await tick(other.env);assert.equal((await statement(other.env,'SELECT status FROM jobs').first()).status,'pending')}finally{globalThis.fetch=original}
});
test('reconnecting a different social account cannot redirect an existing job',async()=>{
 const {env}=fixture();await setupQueue(env);await statement(env,"UPDATE jobs SET scheduled_at='2000-01-01'").run();await statement(env,"UPDATE connections SET account_id='different-account'").run();let sends=0;const original=globalThis.fetch;globalThis.fetch=async()=>{sends++;throw Error()};try{await tick(env);assert.equal(sends,0);assert.equal((await statement(env,'SELECT status FROM jobs').first()).status,'failed')}finally{globalThis.fetch=original}
});
test('CRM is persistent, records history and validates publication attribution',async()=>{
 const {env}=fixture();const first=await request(env,'/api/clients',{name:'Cliente real',stage:'novo',project:'Site autoral'});assert.equal(first.status,200);const {id}=await first.json();await request(env,'/api/clients',{id,name:'Cliente real',stage:'proposta',project:'Site autoral'});
 const history=await request(env,'/api/clients/'+id+'/history');assert.equal((await history.json()).length,2);
 assert.equal((await request(env,'/api/clients',{name:'Outro',stage:'novo',sourcePostId:'invented'})).status,400);
});
test('AI uses latest non-hypothetical memory, preserves source and never approves',async()=>{
 const {env}=fixture();await sync(env,'owner',{...blank(),memories:[{id:'m1',rootId:'m',title:'Voz',text:'antigo',kind:'decisao'},{id:'m2',rootId:'m',title:'Voz',text:'atual',kind:'decisao'},{id:'h',title:'Hipótese',text:'não confirmado',kind:'hipotese'}]});let input;
 env.AI={run:async(model,values)=>{input=values;return {response:'Minha criação, com minha voz.'}}};const result=await generate(env,'owner',{idea:'Fonte autoral',platform:'LinkedIn',lang:'pt'});
 assert.equal(result.post.status,'draft');assert.equal(result.post.sourceIdea,'Fonte autoral');assert.deepEqual(result.sourceIds,['m2']);assert.ok(input.messages[1].content.includes('atual'));assert.ok(!input.messages[1].content.includes('não confirmado'));
});
test('daily limits stop expensive operations',async()=>{
 const {env}=fixture();await quota(env,'owner','test',2);await quota(env,'owner','test',2);await assert.rejects(()=>quota(env,'owner','test',2),/Limite/);
});
test('OAuth uses random state, PKCE for X and signed short-lived binding',async()=>{
 const {env}=fixture();const a=await connect(env,'owner','x'),b=await connect(env,'owner','x');const u=new URL(a.url);assert.notEqual(u.searchParams.get('state'),new URL(b.url).searchParams.get('state'));assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.ok(a.cookie.includes('HttpOnly'));assert.ok(a.cookie.includes('Secure'));assert.ok(!a.url.includes(env.X_CLIENT_SECRET));
});
test('tracked redirects aggregate requests without storing visitor identifiers',async()=>{
 const {env}=fixture();await sync(env,'owner',{...blank(),posts:[post()]});const r=await request(env,'/api/links',{recordId:'a',target:'https://portfolio.example/case'});const link=await r.json();const response=await handle(new Request(link.url),env);assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'https://portfolio.example/case');const count=await statement(env,'SELECT * FROM click_counts').first();assert.equal(count.count,1);assert.deepEqual(Object.keys(count).sort(),['count','day','token']);
});

test('GitHub OAuth callback binds state and PKCE, restricts owner, and issues only HttpOnly session',async()=>{
 const {env}=fixture();const {login,callback}=await import('../server/auth.mjs');
 const start=await login(new Request(env.APP_ORIGIN+'/api/auth/login'),env);const authorization=new URL(start.headers.get('Location'));const state=authorization.searchParams.get('state');
 const loginCookie=start.headers.get('Set-Cookie').split(';')[0];let calls=0;const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{calls++;if(String(url).includes('access_token')){assert.equal(await hash(options.body.get('code_verifier')),authorization.searchParams.get('code_challenge'));return new Response(JSON.stringify({access_token:'github-private-token'}),{headers:{'Content-Type':'application/json'}})}return new Response(JSON.stringify({id:'owner',login:'caroline'}),{headers:{'Content-Type':'application/json'}})};
 try{
  await assert.rejects(()=>callback(new Request(env.APP_ORIGIN+'/api/auth/callback?state=wrong&code=code',{headers:{Cookie:loginCookie}}),env));assert.equal(calls,0);
  const response=await callback(new Request(env.APP_ORIGIN+'/api/auth/callback?state='+state+'&code=code',{headers:{Cookie:loginCookie}}),env);assert.equal(response.status,302);const setCookies=response.headers.getSetCookie();assert.ok(setCookies.some(c=>c.startsWith('__Host-smezi_session=')&&c.includes('HttpOnly')&&c.includes('Secure')));assert.ok(!setCookies.join().includes('github-private-token'));
 }finally{globalThis.fetch=original}
});

test('social callback encrypts provider tokens and rejects owner/provider state mismatch',async()=>{
 const {env}=fixture();const {socialCallback}=await import('../server/social.mjs');const first=await connect(env,'owner','x'),url=new URL(first.url),state=url.searchParams.get('state'),oauthCookie=first.cookie.split(';')[0];let calls=0;const original=globalThis.fetch;
 globalThis.fetch=async(target,options)=>{calls++;if(String(target).includes('/oauth2/token')){assert.equal(await hash(options.body.get('code_verifier')),url.searchParams.get('code_challenge'));return new Response(JSON.stringify({access_token:'secret-provider-access',refresh_token:'secret-refresh',expires_in:7200}),{headers:{'Content-Type':'application/json'}})}return new Response(JSON.stringify({data:{id:'x-person',username:'caroline'}}),{headers:{'Content-Type':'application/json'}})};
 try{
  const req=new Request(env.APP_ORIGIN+'/api/social/x/callback?state='+state+'&code=code',{headers:{Cookie:oauthCookie}});
  await assert.rejects(()=>socialCallback(req,env,'other','x'));assert.equal(calls,0);
  const result=await socialCallback(req,env,'owner','x');assert.equal(result.status,302);const row=await statement(env,'SELECT encrypted_token FROM connections').first();assert.ok(!row.encrypted_token.includes('secret-provider-access'));assert.equal((await unseal(env,row.encrypted_token,'owner:x')).refresh_token,'secret-refresh');
 }finally{globalThis.fetch=original}
});
