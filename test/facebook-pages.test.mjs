import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findCwsFacebookPage} from '../server/facebook-pages.mjs';

const env={META_API_VERSION:'v26.0'};
test('CWS Page is accepted only when Meta confirms linked Instagram ID',async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({data:[
  {id:'123',name:'CWS',instagram_business_account:{id:'17841452697239527',username:'cws_work'}},
  {id:'456',name:'Other',instagram_business_account:{id:'111',username:'other'}}
 ]}),{status:200,headers:{'Content-Type':'application/json'}});
 try{
  assert.deepEqual(await findCwsFacebookPage(env,'test-token','17841452697239527'),{id:'123',name:'CWS'});
  await assert.rejects(()=>findCwsFacebookPage(env,'test-token','not-the-owner'),/não confirmou/);
 }finally{globalThis.fetch=prior}
});
test('ambiguous Pages cannot be registered',async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({data:[
  {id:'123',name:'CWS',instagram_business_account:{id:'17841452697239527'}},
  {id:'456',name:'CWS',instagram_business_account:{id:'17841452697239527'}}
 ]}),{status:200,headers:{'Content-Type':'application/json'}});
 try{await assert.rejects(()=>findCwsFacebookPage(env,'test-token','17841452697239527'),/não confirmou/)}
 finally{globalThis.fetch=prior}
});
