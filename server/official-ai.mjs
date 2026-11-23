import {fail} from './security.mjs';
import {quota} from './store.mjs';

const providers={
 openai:{key:'OPENAI_API_KEY',model:'OPENAI_MODEL',url:'https://api.openai.com/v1/responses'},
 gemini:{key:'GEMINI_API_KEY',model:'GEMINI_MODEL'},
 xai:{key:'XAI_API_KEY',model:'XAI_MODEL',url:'https://api.x.ai/v1/responses'}
};
const encoder=new TextEncoder();
function validModel(value){return typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,90}$/.test(value)}
export function providerStatus(env){
 return Object.fromEntries(Object.entries(providers).map(([name,config])=>[name,{
  configured:Boolean(env[config.key]&&validModel(env[config.model])),
  model:validModel(env[config.model])?env[config.model]:null,
  enabled:env.LEONARDO_EXTERNAL_AI_ENABLED==='true'
 }]));
}
function outputText(response){
 if(typeof response.output_text==='string')return response.output_text;
 if(Array.isArray(response.output))return response.output.filter(x=>x.type==='message'&&x.role==='assistant')
  .flatMap(x=>Array.isArray(x.content)?x.content:[])
  .filter(x=>x.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('\n');
 return '';
}
function parseGemini(result){
 return (result.candidates?.[0]?.content?.parts||[]).filter(x=>typeof x.text==='string').map(x=>x.text).join('\n');
}
export async function askOfficialAI(env,owner,input){
 if(env.LEONARDO_EXTERNAL_AI_ENABLED!=='true')fail(503,'APIs externas desativadas para evitar custos.');
 const provider=String(input?.provider||'');
 const config=providers[provider];
 if(!config)fail(400,'Provedor inválido. Use openai, gemini ou xai.');
 const prompt=input?.prompt;
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>8000)fail(400,'Envie uma pergunta de até 8.000 caracteres.');
 const instructions=input?.instructions===undefined?'Responda em português do Brasil, com precisão e clareza. Não afirme ter executado ações que não realizou.':input.instructions;
 if(typeof instructions!=='string'||instructions.length>2000)fail(400,'Instruções inválidas.');
 const key=env[config.key],model=env[config.model];
 if(!key||!validModel(model))fail(503,'Configure o segredo e o modelo oficial de '+provider+'.');
 // Global opt-in is not sufficient for a paid API call: a provider allowlist is required.
 const allowed=(env.LEONARDO_AI_ALLOWED_PROVIDERS||'').split(',').map(x=>x.trim());
 if(!allowed.includes(provider))fail(403,'Provedor não autorizado no Leonardo.');
 // The limit is conservative; enforce spending ceilings at each provider too.
 await quota(env,owner,'external-ai-'+provider,10);
 const url=provider==='gemini'
  ?'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent'
  :config.url;
 const headers={'Content-Type':'application/json'};
 let payload;
 if(provider==='gemini'){
  headers['x-goog-api-key']=key;
  payload={contents:[{role:'user',parts:[{text:prompt}]}],systemInstruction:{parts:[{text:instructions}]},generationConfig:{maxOutputTokens:512}};
 }else{
  headers.Authorization='Bearer '+key;
  payload={model,input:[{role:'system',content:instructions},{role:'user',content:prompt}],max_output_tokens:512};
  if(provider==='openai')payload.store=false;
 }
 let response;
 try{
  response=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(60000),redirect:'error'});
 }catch{fail(502,'O provedor não respondeu. Verifique o painel oficial antes de tentar novamente.')}
 if(!response.ok){
  if(response.status===401||response.status===403)fail(502,'A API recusou as credenciais ou permissões.');
  if(response.status===429)fail(429,'Limite ou créditos do provedor atingidos.');
  fail(502,'Falha na API de '+provider+' (HTTP '+response.status+').');
 }
 let data;try{data=await response.json()}catch{fail(502,'Resposta inválida do provedor.')}
 const answer=(provider==='gemini'?parseGemini(data):outputText(data)).trim();
 if(!answer)fail(502,'A API não retornou texto final. Confira os limites do modelo selecionado.');
 return {provider,model,answer:answer.slice(0,16000),usage:provider==='gemini'
  ?{inputTokens:data.usageMetadata?.promptTokenCount??null,outputTokens:data.usageMetadata?.candidatesTokenCount??null}
  :{inputTokens:data.usage?.input_tokens??null,outputTokens:data.usage?.output_tokens??null},
  // No automatic publishing, no persistence, no outbound actions.
  mode:'manual',saved:false,published:false};
}
