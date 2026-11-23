import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askOfficialAI,providerStatus} from '../server/official-ai.mjs';

function environment(){
 const sql=[];
 const DB={prepare(query){return {bind(...args){return {async first(){sql.push({query,args});return {count:1}}}}}}};
 return {
  DB,sql,LEONARDO_EXTERNAL_AI_ENABLED:'true',LEONARDO_AI_ALLOWED_PROVIDERS:'openai,gemini,xai',
  OPENAI_API_KEY:'openai-secret',OPENAI_MODEL:'gpt-4.1-mini',
  GEMINI_API_KEY:'gemini-secret',GEMINI_MODEL:'gemini-2.5-flash',
  XAI_API_KEY:'xai-secret',XAI_MODEL:'grok-4.7'
 };
}
test('external AI requires explicit opt-in and authorized provider',async()=>{
 const e=environment();e.LEONARDO_EXTERNAL_AI_ENABLED='false';
 await assert.rejects(()=>askOfficialAI(e,'owner',{provider:'openai',prompt:'Teste'}),/desativadas/);
 assert.equal(e.sql.length,0);
 e.LEONARDO_EXTERNAL_AI_ENABLED='true';e.LEONARDO_AI_ALLOWED_PROVIDERS='gemini';
 await assert.rejects(()=>askOfficialAI(e,'owner',{provider:'openai',prompt:'Teste'}),/não autorizado/);
 assert.equal(e.sql.length,0);
});
test('invalid prompts and providers do not charge quota',async()=>{
 const e=environment();
 await assert.rejects(()=>askOfficialAI(e,'owner',{provider:'other',prompt:'Teste'}),/Provedor inválido/);
 await assert.rejects(()=>askOfficialAI(e,'owner',{provider:'gemini',prompt:' '}),/pergunta/);
 assert.equal(e.sql.length,0);
});
test('provider status reveals no API keys',()=>{
 const e=environment(),status=providerStatus(e);
 assert.deepEqual(Object.keys(status).sort(),['gemini','openai','xai']);
 assert.equal(status.openai.configured,true);
 assert.equal(JSON.stringify(status).includes('openai-secret'),false);
});
test('OpenAI Responses request does not persist conversation and returns only assistant text',async()=>{
 const e=environment(),original=globalThis.fetch;let seen;
 globalThis.fetch=async(url,options)=>{
  seen={url,options};
  return new Response(JSON.stringify({output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Resposta OpenAI'}]}],usage:{input_tokens:12,output_tokens:8}}),{status:200});
 };
 try{
  const r=await askOfficialAI(e,'owner',{provider:'openai',prompt:'Olá'});
  assert.equal(r.answer,'Resposta OpenAI');
  assert.equal(seen.url,'https://api.openai.com/v1/responses');
  assert.equal(JSON.parse(seen.options.body).store,false);
  assert.equal(r.saved,false);
  assert.equal(r.published,false);
  assert.equal(e.sql.length,1);
 }finally{globalThis.fetch=original}
});
test('Gemini calls generateContent with server-side key and extracts text',async()=>{
 const e=environment(),original=globalThis.fetch;let seen;
 globalThis.fetch=async(url,options)=>{
  seen={url,options};
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Resposta Gemini'}]}}]}),{status:200});
 };
 try{
  const r=await askOfficialAI(e,'owner',{provider:'gemini',prompt:'Olá'});
  assert.equal(r.answer,'Resposta Gemini');
  assert.match(seen.url,/gemini-2.5-flash:generateContent$/);
  assert.equal(seen.options.headers['x-goog-api-key'],'gemini-secret');
  assert.equal(seen.url.includes('gemini-secret'),false);
 }finally{globalThis.fetch=original}
});
test('Grok uses xAI Responses endpoint and does not publish',async()=>{
 const e=environment(),original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.x.ai/v1/responses');
  assert.equal(JSON.parse(options.body).model,'grok-4.7');
  return new Response(JSON.stringify({output_text:'Resposta Grok'}),{status:200});
 };
 try{assert.equal((await askOfficialAI(e,'owner',{provider:'xai',prompt:'Olá'})).answer,'Resposta Grok')}
 finally{globalThis.fetch=original}
});
