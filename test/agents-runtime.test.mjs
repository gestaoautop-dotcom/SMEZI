import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {sign} from '../server/security.mjs';

// Runtime real de Workers + D1 local: migrations 0001, 0002 e 0004 e as rotas dos agentes no bundle publicado (dist/_worker.js).
test('real Workers runtime: agents, append-only research memory and safe behaviour without Workers AI',{timeout:45000},async()=>{
 const bindings={APP_ORIGIN:'https://engine.example',SESSION_SECRET:'test-session-secret-longer-than-thirty-two-chars',GITHUB_ALLOWED_ID:'owner',GITHUB_CLIENT_ID:'test-app',GITHUB_CLIENT_SECRET:'test-secret'};
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'dist/_worker.js',compatibilityDate:'2026-10-30',bindings,d1Databases:['DB'],serviceBindings:{ASSETS:async()=>new Response('static')}}));
 try{
  const db=await mf.getD1Database('DB');
  for(const file of ['0001_content_engine.sql','0002_leonardo_ads.sql','0004_agents_memory.sql']){
   const schema=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').replace(/--[^\n]*/g,'');
   await db.batch(schema.split(';').filter(x=>x.trim()).map(x=>db.prepare(x)));
  }
  const session=await sign(bindings,{sub:'owner',login:'caroline'},'session');
  const call=(path,data)=>mf.dispatchFetch(bindings.APP_ORIGIN+path,{method:data===undefined?'GET':'POST',headers:{Cookie:'__Host-smezi_session='+session,Origin:bindings.APP_ORIGIN,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const status=await call('/api/agents');assert.equal(status.status,200,await status.clone().text());
  const data=await status.json();assert.deepEqual(data.agents.map(a=>a.id),['leonardo','jade']);assert.equal(data.ai.ready,false);
  const created=await call('/api/agents/memories',{agentId:'leonardo',title:'Teste',text:'Memória verificada',status:'verificada'});assert.equal(created.status,201,await created.clone().text());
  const {memory}=await created.json();
  assert.equal((await call('/api/agents/memories/review',{rootId:memory.rootId,status:'contestada'})).status,200);
  const history=await (await call('/api/agents/memories/history?root='+memory.rootId)).json();
  assert.deepEqual(history.versions.map(v=>v.status),['contestada','verificada']);
  const blocked=await call('/api/agents/collaborate',{topic:'Tema',platform:'X',lang:'pt'});assert.equal(blocked.status,503);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM usage_limits').first()).n,0);
 }finally{await mf.dispose()}
});
