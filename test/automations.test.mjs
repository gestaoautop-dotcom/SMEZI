import {test} from 'node:test';
import assert from 'node:assert/strict';
import {d1,mockFetch} from './support/d1.mjs';
import {seal} from '../server/security.mjs';
import {parseWebhook,matchesKeyword,findRule,renderReply,parseKeywords,withinWindow} from '../server/automation-core.mjs';
import {saveRule,listRules,ruleHistory,processEvent,sendEvent,ignoreEvent,listEvents,previewRule} from '../server/automations.mjs';
import {consumeConversationBatch} from '../server/conversations-consumer.mjs';
import {handle} from '../server/worker.mjs';
import {sign} from '../server/security.mjs';

const KEY='a'.repeat(64);
const ALL_SCOPES=['instagram_basic','instagram_content_publish','instagram_manage_comments','instagram_manage_messages','pages_show_list','pages_read_engagement','pages_messaging','pages_manage_engagement','pages_manage_posts'];
async function fixture({scopes=ALL_SCOPES,auto=false}={}){
 const {sql,DB}=d1();
 const env={DB,TOKEN_ENCRYPTION_KEY:KEY,META_API_VERSION:'v99.0',GITHUB_ALLOWED_ID:'owner',CONVERSATIONS_AUTO_REPLY_ENABLED:auto?'true':'false',APP_ORIGIN:'https://engine.example'};
 const far=Date.now()+30*86400000,time=new Date().toISOString();
 sql.prepare('INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('owner','instagram','IG1','cws_work',await seal(env,{access_token:'user-token',auth_mode:'instagram_unified',granted_scopes:scopes},'owner:instagram'),far,time);
 sql.prepare('INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('owner','facebook','PAGE1','CWS',await seal(env,{access_token:'user-token',auth_mode:'facebook_page_unified',granted_scopes:scopes},'owner:facebook'),far,time);
 return {sql,env};
}
const igComment=(id,text,from='U1',extra={})=>({channel:'instagram',source:'comentario',id:'ig:'+id,commentId:id,accountId:'IG1',senderId:from,senderName:'@maria',mediaId:'M1',text,timestamp:Date.now(),...extra});
const rule=(over={})=>({name:'Quero',channel:'instagram',source:'comentario',keywords:'quero, preço',publicReply:'Oi {nome}! Te chamei no direct.',privateReply:'Aqui está o catálogo.',active:true,...over});
const metaOK=()=>mockFetch([
 [/\/PAGE1\?fields=access_token/,{access_token:'page-token'}],
 [/\/replies$/,{id:'reply-1'}],
 [/\/comments$/,{id:'fbreply-1'}],
 [/\/PAGE1\/messages$/,{recipient_id:'U1',message_id:'mid-1'}]
]);

test('keyword matching respects word boundaries, accents and exact mode',()=>{
 assert.ok(matchesKeyword('Eu QUERO saber!','quero','contem'));
 assert.ok(!matchesKeyword('querosene barato','quero','contem'));
 assert.ok(matchesKeyword('Qual o preco?','preço','contem'));
 assert.ok(matchesKeyword('  Cardápio!! ','cardapio','exata'));
 assert.ok(!matchesKeyword('quero o cardápio','cardapio','exata'));
 assert.deepEqual(parseKeywords('Quero, quero,\n a, preço'),['quero','preco']);
 assert.equal(renderReply('Oi {nome}<script>','x'),'Oi <script>'.replace('{nome}',''));
 assert.equal(renderReply('Oi {nome}!',{senderName:'@ana<b>'}),'Oi @anab!');
});

test('webhook parsing: Instagram comments, Facebook feed comments and DMs; ignores own account and echoes',()=>{
 const ig=parseWebhook({object:'instagram',entry:[{id:'IG1',time:1,changes:[
  {field:'comments',value:{id:'C1',text:'quero',from:{id:'U1',username:'maria'},media:{id:'M1'}}},
  {field:'comments',value:{id:'C2',text:'quero',from:{id:'IG1',username:'cws'}}}],
  messaging:[{sender:{id:'U2'},recipient:{id:'IG1'},timestamp:5,message:{mid:'m1',text:'preço?'}},{sender:{id:'IG1'},recipient:{id:'U2'},message:{mid:'m2',text:'eco',is_echo:true}}]}]});
 assert.deepEqual(ig.map(e=>[e.source,e.id,e.senderName]),[['dm','dm:m1',''],['comentario','ig:C1','@maria']]);
 const fb=parseWebhook({object:'page',entry:[{id:'PAGE1',changes:[{field:'feed',value:{item:'comment',verb:'add',comment_id:'P_1',post_id:'P',message:'quero',from:{id:'U3',name:'João'},created_time:10}},{field:'feed',value:{item:'comment',verb:'edited',comment_id:'P_2',message:'quero',from:{id:'U3'}}}]}]});
 assert.deepEqual(fb.map(e=>[e.channel,e.id,e.senderName]),[['facebook','fb:P_1','João']]);
 assert.deepEqual(parseWebhook({object:'whatsapp_business_account',entry:[]}),[]);
});

test('rules are created inactive in approval mode by default, validated and versioned on edit',async()=>{
 const {env}=await fixture();
 const r=await saveRule(env,'owner',{name:'Teste',channel:'instagram',source:'comentario',keywords:'quero',privateReply:'Oi'});
 assert.equal(r.active,false);assert.equal(r.mode,'aprovacao');
 await assert.rejects(saveRule(env,'owner',{name:'DM',channel:'instagram',source:'dm',keywords:'oi',publicReply:'x',privateReply:'y'}),/só existe resposta privada/);
 await assert.rejects(saveRule(env,'owner',{name:'Sem',channel:'instagram',source:'comentario',keywords:'a',privateReply:'y'}),/palavra-gatilho/);
 await saveRule(env,'owner',{...r,id:r.id,name:'Teste 2',keywords:r.keywords});
 const history=await ruleHistory(env,'owner',r.id);
 assert.equal(history[0].name,'Teste');
 assert.equal((await listRules(env,'other')).length,0);
 const preview=await previewRule(env,'owner',{...rule(),sampleText:'quero!'});
 assert.equal(preview.matches,true);assert.equal(preview.publicReply,'Oi @exemplo! Te chamei no direct.');
});

test('approval mode never calls Meta; duplicates are ignored; human send claims once',async()=>{
 const {env}=await fixture();const meta=metaOK();
 try{
  await saveRule(env,'owner',rule());
  assert.equal((await processEvent(env,'owner',igComment('C1','sem gatilho'))).status,'sem_regra');
  assert.equal((await processEvent(env,'owner',igComment('C2','Quero muito!'))).status,'pendente');
  assert.equal((await processEvent(env,'owner',igComment('C2','Quero muito!'))).duplicate,true);
  assert.equal(meta.calls.length,0);
  const [pending]=await listEvents(env,'owner','pendente');
  assert.equal(pending.publicReply,'Oi @maria! Te chamei no direct.');
  const sent=await sendEvent(env,'owner',pending.id,{publicReply:'Oi @maria, já te respondi!'});
  assert.equal(sent.status,'enviado');
  assert.ok(meta.calls.some(c=>c.url.endsWith('/v99.0/C2/replies')&&JSON.parse(c.body).message==='Oi @maria, já te respondi!'));
  const dm=meta.calls.find(c=>c.url.endsWith('/PAGE1/messages'));
  assert.deepEqual(JSON.parse(dm.body).recipient,{comment_id:'C2'});
  assert.equal(dm.headers.Authorization,'Bearer page-token');
  await assert.rejects(sendEvent(env,'owner',pending.id,{}),/já foi enviado/);
  await assert.rejects(ignoreEvent(env,'owner',pending.id),/não pode mais/);
 }finally{meta.restore()}
});

test('automatic mode requires the global switch, respects 24h per contact and checks permissions first',async()=>{
 {
  const {env}=await fixture({auto:false});const meta=metaOK();
  try{await saveRule(env,'owner',rule({mode:'automatico'}));
   assert.equal((await processEvent(env,'owner',igComment('C1','quero'))).status,'pendente');
   assert.equal(meta.calls.length,0);
  }finally{meta.restore()}
 }
 {
  const {env}=await fixture({auto:true});const meta=metaOK();
  try{await saveRule(env,'owner',rule({mode:'automatico'}));
   assert.equal((await processEvent(env,'owner',igComment('C1','quero'))).status,'enviado');
   assert.equal((await processEvent(env,'owner',igComment('C3','quero de novo'))).status,'ignorado');
   assert.equal((await processEvent(env,'owner',igComment('C4','quero','U9'))).status,'enviado');
  }finally{meta.restore()}
 }
 {
  const {env}=await fixture({auto:true,scopes:['instagram_basic','instagram_content_publish']});const meta=metaOK();
  try{await saveRule(env,'owner',rule({mode:'automatico'}));
   const r=await processEvent(env,'owner',igComment('C1','quero'));
   assert.equal(r.status,'permissao_ausente');assert.match(r.error,/instagram_manage_comments/);
   assert.equal(meta.calls.filter(c=>c.method==='POST').length,0);
  }finally{meta.restore()}
 }
});

test('network failure is marked uncertain and never retried; old comments are out of the Meta window',async()=>{
 const {env}=await fixture({auto:true});
 const meta=mockFetch([[/access_token/,{access_token:'page-token'}],[/\/replies$/,()=>new TypeError('network')]]);
 try{await saveRule(env,'owner',rule({mode:'automatico'}));
  assert.equal((await processEvent(env,'owner',igComment('C1','quero'))).status,'incerto');
  assert.equal(meta.calls.filter(c=>c.url.includes('/messages')).length,0);
  await assert.rejects(sendEvent(env,'owner','ig:C1',{}),/já foi enviado/);
 }finally{meta.restore()}
 const old=await fixture();const m2=metaOK();
 try{await saveRule(old.env,'owner',rule());
  await processEvent(old.env,'owner',igComment('C9','quero','U1',{timestamp:Date.now()-8*86400000}));
  await assert.rejects(sendEvent(old.env,'owner','ig:C9',{}),/Fora do prazo/);
  assert.equal((await listEvents(old.env,'owner','fora_do_prazo')).length,1);
  assert.equal(m2.calls.length,0);
 }finally{m2.restore()}
 assert.equal(withinWindow({source:'dm',received_at:new Date(Date.now()-25*3600000).toISOString()}),false);
});

test('queue consumer stores only events for the connected account and acknowledges',async()=>{
 const {env}=await fixture();
 await saveRule(env,'owner',rule());
 const acked=[];const retried=[];
 const msg=body=>({body,ack(){acked.push(1)},retry(){retried.push(1)}});
 await consumeConversationBatch({messages:[
  msg({object:'instagram',entry:[{id:'IG1',changes:[{field:'comments',value:{id:'C1',text:'quero',from:{id:'U1',username:'ana'}}}]}]}),
  msg({object:'instagram',entry:[{id:'OTHER',changes:[{field:'comments',value:{id:'C2',text:'quero',from:{id:'U1'}}}]}]})
 ]},env);
 assert.equal(acked.length,2);assert.equal(retried.length,0);
 const events=await listEvents(env,'owner');
 assert.deepEqual(events.map(e=>[e.id,e.status]),[['ig:C1','pendente']]);
 const broken={...env,DB:undefined};
 await consumeConversationBatch({messages:[msg({object:'instagram',entry:[{id:'IG1',changes:[{field:'comments',value:{id:'C5',text:'quero',from:{id:'U1'}}}]}]})]},broken);
 assert.equal(retried.length,1);
});

test('findRule picks the active rule with the lowest priority for the same channel and source',()=>{
 const rules=[{id:'b',active:1,channel:'instagram',source:'comentario',keywords:'quero',match_mode:'contem',priority:50,created_at:'2'},{id:'a',active:1,channel:'instagram',source:'comentario',keywords:'quero',match_mode:'contem',priority:10,created_at:'3'},{id:'c',active:0,channel:'instagram',source:'comentario',keywords:'quero',match_mode:'contem',priority:1,created_at:'1'},{id:'d',active:1,channel:'facebook',source:'comentario',keywords:'quero',match_mode:'contem',priority:1,created_at:'1'}];
 assert.equal(findRule(rules,{channel:'instagram',source:'comentario',text:'quero'}).id,'a');
 assert.equal(findRule(rules,{channel:'instagram',source:'dm',text:'quero'}),null);
});

test('HTTP routes: rules, inbox and sending an event whose id contains ":"',async()=>{
 const {env}=await fixture();
 Object.assign(env,{SESSION_SECRET:'session-secret-with-more-than-thirty-two-chars',GITHUB_CLIENT_ID:'id',GITHUB_CLIENT_SECRET:'secret'});
 const token=await sign(env,{sub:'owner',login:'caroline'},'session');
 const call=(path,data)=>handle(new Request(env.APP_ORIGIN+path,{method:data===undefined?'GET':'POST',headers:{Cookie:'__Host-smezi_session='+token,Origin:env.APP_ORIGIN,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
 const created=await (await call('/api/automations/rules',rule())).json();
 assert.equal(created.active,true);
 await processEvent(env,'owner',igComment('C7','quero'));
 const status=await (await call('/api/automations')).json();
 assert.equal(status.autoReplyEnabled,false);assert.equal(status.counts.pendente,1);assert.equal(status.rules.length,1);
 const meta=metaOK();
 try{
  const r=await call('/api/automations/events/'+encodeURIComponent('ig:C7')+'/send',{privateReply:'Só no privado.',publicReply:''});
  assert.equal(r.status,200);assert.equal((await r.json()).status,'enviado');
  assert.equal(meta.calls.filter(c=>c.url.endsWith('/replies')).length,0);
 }finally{meta.restore()}
 const evil=await handle(new Request(env.APP_ORIGIN+'/api/automations/rules',{method:'POST',headers:{Cookie:'__Host-smezi_session='+token,Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify(rule())}),env);
 assert.equal(evil.status,403);
});
