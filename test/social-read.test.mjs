import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {socialRead} from '../server/social-read.mjs';
import {seal} from '../server/security.mjs';

function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../migrations/0001_content_engine.sql',import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){return sql.prepare(query).run(...args)}}}}}};
 return {sql,env:{DB,TOKEN_ENCRYPTION_KEY:'c'.repeat(64),META_API_VERSION:'v26.0'}};
}
async function add(env,provider,id,scopes){
 const token=await seal(env,{access_token:'test-token',granted_scopes:scopes},'owner:'+provider);
 await env.DB.prepare('INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('owner',provider,id,provider,token,Date.now()+3600000,new Date().toISOString()).run();
}
test('Graph publication counters are returned only from actual provider payloads',async()=>{
 const {env}=setup();
 await add(env,'instagram','17841452697239527',['instagram_basic']);
 await add(env,'facebook','222',['pages_read_engagement']);
 const old=globalThis.fetch;
 const urls=[];
 globalThis.fetch=async(url)=>{
  urls.push(String(url));
  const instagram=String(url).includes('/media?');
  return new Response(JSON.stringify({data:instagram?[{id:'11',caption:'Irvine Atlas',timestamp:'2026-11-04',like_count:7,comments_count:2}]:[{id:'222_3',message:'CWS',created_time:'2026-11-04',comments:{summary:{total_count:5}},reactions:{summary:{total_count:8}}}]}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const result=await socialRead(env,'owner');
  assert.equal(result.readOnly,true);
  assert.equal(result.publishingEnabled,false);
  assert.equal(result.channels.find(c=>c.provider==='facebook').metrics.items[0].reactions,8);
  assert.equal(result.channels.find(c=>c.provider==='instagram').posts.items[0].text,'Irvine Atlas');
  assert.equal(result.channels.find(c=>c.provider==='linkedin').posts.status,'unavailable');
  assert.equal(urls.length,2);
  assert.ok(urls.every(u=>u.startsWith('https://graph.facebook.com/v26.0/')));
 }finally{globalThis.fetch=old}
});
test('missing scopes block reads and API failures never produce invented zero metrics',async()=>{
 const {env}=setup();
 await add(env,'instagram','11',[]);
 await add(env,'facebook','22',['pages_read_engagement']);
 const old=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async()=>{requests++;return new Response('{}',{status:403})};
 try{
  const result=await socialRead(env,'owner');
  assert.equal(result.channels.find(c=>c.provider==='instagram').posts.status,'unavailable');
  assert.equal(result.channels.find(c=>c.provider==='facebook').metrics.status,'unavailable');
  assert.equal(requests,1);
 }finally{globalThis.fetch=old}
});
