import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {sign} from '../server/security.mjs';

test('real Workers runtime: signed login, D1 storage, CRM and R2 backup restoration', {timeout:45000}, async()=>{
 const bindings={APP_ORIGIN:'https://engine.example',SESSION_SECRET:'test-session-secret-longer-than-thirty-two-chars',GITHUB_ALLOWED_ID:'owner',GITHUB_CLIENT_ID:'test-app',GITHUB_CLIENT_SECRET:'test-secret'};
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'dist/_worker.js',compatibilityDate:'2026-10-30',bindings,d1Databases:['DB'],r2Buckets:['BACKUPS'],serviceBindings:{ASSETS:async()=>new Response('static')}}));
 try{
  const db=await mf.getD1Database('DB');const schema=readFileSync(new URL('../migrations/0001_content_engine.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'');
  await db.batch(schema.split(';').filter(x=>x.trim()).map(x=>db.prepare(x)));
  const session=await sign(bindings,{sub:'owner',login:'caroline'},'session');
  const call=(path,data)=>mf.dispatchFetch(bindings.APP_ORIGIN+path,{method:data===undefined?'GET':'POST',headers:{Cookie:'__Host-smezi_session='+session,Origin:bindings.APP_ORIGIN,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  assert.equal((await mf.dispatchFetch(bindings.APP_ORIGIN+'/api/state')).status,401);
  const data={memories:[{id:'author',title:'Autoria',text:'Minha voz vem primeiro.',kind:'decisao'}],ideas:[],posts:[]};
  const sync=await call('/api/sync',data);assert.equal(sync.status,200,await sync.clone().text());assert.equal((await sync.json()).backup,true);
  const state=await call('/api/state');assert.equal(state.status,200,await state.clone().text());assert.equal((await state.json()).data.memories[0].text,'Minha voz vem primeiro.');
  const crm=await call('/api/clients',{name:'Contato real',stage:'conversa'});assert.equal(crm.status,200);
  const backup=await call('/api/backups',{});assert.equal(backup.status,200);const {key}=await backup.json();assert.match(key,/^backups\/owner\//);
  await db.prepare("DELETE FROM records WHERE owner='owner'").run();
  const restored=await call('/api/backups/restore',{key});assert.equal(restored.status,200,await restored.clone().text());assert.equal((await restored.json()).data.memories[0].id,'author');
 }finally{await mf.dispose()}
});
