// Runtime comum de IA do Leonardo: respostas estruturadas (JSON Schema) e uso de ferramentas.
//
// Princípios:
// - Workers AI é o provedor padrão (já integrado, sem chave externa).
// - Provedores pagos (OpenAI, Gemini, xAI, Anthropic) só são chamados com
//   LEONARDO_EXTERNAL_AI_ENABLED=true E o provedor listado em LEONARDO_AI_ALLOWED_PROVIDERS.
// - Toda resposta é validada no servidor contra o schema, mesmo com saída estruturada nativa.
// - Ferramentas são declaradas com schema de argumentos e efeito. Nesta fase só existem
//   ferramentas de LEITURA: nenhum agente publica, envia mensagens ou altera aprovações.
// - Cada chamada é contada (quota diária) e registrada em ai_usage, sem prompts nem respostas.
import {fail,AppError} from './security.mjs';
import {quota,statement,now} from './store.mjs';
import {validate,providerSchema,extractJSON} from './json-schema.mjs';

const EXTERNAL={
 openai:{key:'OPENAI_API_KEY',model:'OPENAI_MODEL',label:'OpenAI'},
 gemini:{key:'GEMINI_API_KEY',model:'GEMINI_MODEL',label:'Google Gemini'},
 xai:{key:'XAI_API_KEY',model:'XAI_MODEL',label:'xAI Grok'},
 anthropic:{key:'ANTHROPIC_API_KEY',model:'ANTHROPIC_MODEL',label:'Anthropic Claude'}
};
export const PROVIDER_IDS=['workers-ai',...Object.keys(EXTERNAL)];
const validModel=value=>typeof value==='string'&&/^[@a-zA-Z0-9][a-zA-Z0-9@/._:-]{1,120}$/.test(value);
const allowedExternal=env=>(env.LEONARDO_AI_ALLOWED_PROVIDERS||'').split(',').map(x=>x.trim()).filter(Boolean);

export function providerAvailability(env){
 const out={'workers-ai':{label:'Workers AI (Cloudflare)',external:false,model:validModel(env.AI_MODEL)?env.AI_MODEL:null,ready:!!((env.AI||env.ai)&&validModel(env.AI_MODEL))}};
 for(const [id,c] of Object.entries(EXTERNAL)){
  const configured=!!env[c.key]&&validModel(env[c.model]);
  out[id]={label:c.label,external:true,model:configured?env[c.model]:null,
   ready:configured&&env.LEONARDO_EXTERNAL_AI_ENABLED==='true'&&allowedExternal(env).includes(id)};
 }
 return out;
}

function assertProvider(env,provider){
 const status=providerAvailability(env)[provider];
 if(!status)fail(400,'Provedor de IA inválido.');
 if(!status.ready){
  if(provider==='workers-ai')fail(503,'Conecte Workers AI (binding AI) e configure AI_MODEL.');
  fail(503,`${status.label} desativado. Requer chave, modelo, LEONARDO_EXTERNAL_AI_ENABLED=true e o provedor em LEONARDO_AI_ALLOWED_PROVIDERS.`);
 }
 return status;
}

function responsesText(data){
 if(typeof data?.output_text==='string')return data.output_text;
 if(Array.isArray(data?.output))return data.output.filter(x=>x.type==='message').flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('');
 return '';
}
function workersText(result){
 if(result?.response&&typeof result.response==='object')return result.response;
 if(typeof result?.response==='string')return result.response;
 const chat=result?.choices?.[0]?.message?.content;if(typeof chat==='string')return chat;
 return responsesText(result);
}

async function postJSON(url,headers,payload){
 let response;
 try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000),redirect:'error'})}
 catch{fail(502,'O provedor de IA não respondeu.')}
 if(!response.ok){
  if(response.status===401||response.status===403)fail(502,'O provedor de IA recusou as credenciais.');
  if(response.status===429)fail(429,'Limite ou créditos do provedor de IA atingidos.');
  fail(502,'Falha no provedor de IA (HTTP '+response.status+').');
 }
 try{return await response.json()}catch{fail(502,'Resposta inválida do provedor de IA.')}
}

// Uma chamada ao modelo. Retorna o conteúdo (objeto ou texto) e o uso de tokens.
export async function callModel(env,{provider,system,user,schema,schemaName='resposta',maxTokens=1200}){
 const status=assertProvider(env,provider),model=status.model;
 const native=schema?providerSchema(schema):null;
 if(provider==='workers-ai'){
  const ai=env.AI||env.ai;
  const messages=[{role:'system',content:system},{role:'user',content:user}];
  const max_tokens=model.includes('/gpt-oss-')?Math.max(maxTokens,4096):maxTokens;
  let result;
  try{result=await ai.run(model,{messages,max_tokens,...(native?{response_format:{type:'json_schema',json_schema:native}}:{})})}
  catch{
   // Nem todo modelo do Workers AI aceita JSON Mode: tenta uma vez sem response_format.
   if(!native)fail(502,'Workers AI não respondeu.');
   try{result=await ai.run(model,{messages,max_tokens})}catch{fail(502,'Workers AI não respondeu.')}
  }
  return {content:workersText(result),model,usage:{input:result?.usage?.prompt_tokens??null,output:result?.usage?.completion_tokens??null}};
 }
 const key=env[EXTERNAL[provider].key];
 if(provider==='gemini'){
  const data=await postJSON('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{'x-goog-api-key':key},{
   systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],
   generationConfig:{maxOutputTokens:maxTokens,...(native?{responseMimeType:'application/json',responseJsonSchema:native}:{})}
  });
  const text=(data.candidates?.[0]?.content?.parts||[]).filter(x=>typeof x.text==='string').map(x=>x.text).join('');
  return {content:text,model,usage:{input:data.usageMetadata?.promptTokenCount??null,output:data.usageMetadata?.candidatesTokenCount??null}};
 }
 if(provider==='anthropic'){
  const data=await postJSON('https://api.anthropic.com/v1/messages',{'x-api-key':key,'anthropic-version':env.ANTHROPIC_VERSION||'2023-06-01'},{
   model,max_tokens:maxTokens,system,messages:[{role:'user',content:user}],
   ...(native?{output_config:{format:{type:'json_schema',schema:native}}}:{})
  });
  const text=(Array.isArray(data.content)?data.content:[]).filter(x=>x.type==='text').map(x=>x.text).join('');
  return {content:text,model,usage:{input:data.usage?.input_tokens??null,output:data.usage?.output_tokens??null}};
 }
 // OpenAI e xAI: Responses API com text.format json_schema (modo estrito).
 const url=provider==='openai'?'https://api.openai.com/v1/responses':'https://api.x.ai/v1/responses';
 const data=await postJSON(url,{Authorization:'Bearer '+key},{
  model,input:[{role:'system',content:system},{role:'user',content:user}],max_output_tokens:maxTokens,
  ...(provider==='openai'?{store:false}:{}),
  ...(native?{text:{format:{type:'json_schema',name:schemaName,strict:true,schema:native}}}:{})
 });
 return {content:responsesText(data),model,usage:{input:data.usage?.input_tokens??null,output:data.usage?.output_tokens??null}};
}

async function recordUsage(env,owner,{provider,model,purpose,usage,ok}){
 // Registro sem conteúdo: apenas contagem para controle de custo. Falha de registro não interrompe a tarefa.
 try{await statement(env,'INSERT INTO ai_usage(owner,provider,model,purpose,input_tokens,output_tokens,ok,created_at) VALUES(?,?,?,?,?,?,?,?)',owner,provider,model||'',purpose,usage?.input??null,usage?.output??null,ok?1:0,now()).run()}catch{}
}
async function meteredCall(env,owner,purpose,args){
 const daily=args.provider==='workers-ai'?Number(env.AGENT_AI_DAILY_LIMIT_WORKERS||200):Number(env.AGENT_AI_DAILY_LIMIT_EXTERNAL||40);
 await quota(env,owner,'agent-ai-'+args.provider,daily);
 try{
  const result=await callModel(env,args);
  await recordUsage(env,owner,{provider:args.provider,model:result.model,purpose,usage:result.usage,ok:true});
  return result;
 }catch(error){
  await recordUsage(env,owner,{provider:args.provider,model:null,purpose,usage:null,ok:false});
  throw error;
 }
}

const JSON_RULE='Responda SOMENTE com um objeto JSON válido que siga exatamente o schema informado. Sem texto antes ou depois.';

// Resposta estruturada validada. Uma única tentativa de correção se o modelo errar o formato.
export async function generateStructured(env,owner,{provider='workers-ai',purpose,system,input,schema,schemaName,maxTokens}){
 const user=JSON.stringify({entrada:input,schema_da_resposta:schema});
 const sys=system+'\n\n'+JSON_RULE;
 let attempt=await meteredCall(env,owner,purpose,{provider,system:sys,user,schema,schemaName,maxTokens});
 let value=extractJSON(attempt.content),errors=value?validate(schema,value):['$: não é um objeto JSON'];
 if(errors.length){
  const repair=JSON.stringify({entrada:input,schema_da_resposta:schema,resposta_anterior:typeof attempt.content==='string'?attempt.content.slice(0,6000):attempt.content,erros:errors.slice(0,12)});
  attempt=await meteredCall(env,owner,purpose+':correcao',{provider,system:sys+'\nA resposta anterior não seguiu o schema. Corrija os erros listados.',user:repair,schema,schemaName,maxTokens});
  value=extractJSON(attempt.content);errors=value?validate(schema,value):['$: não é um objeto JSON'];
  if(errors.length)throw new AppError(502,'A IA não retornou uma resposta no formato esperado. Nada foi salvo.');
 }
 return {data:value,model:attempt.model,provider};
}

// Agente com ferramentas. Protocolo neutro (funciona em todos os provedores):
// a cada passo o modelo escolhe "usar_ferramenta" ou "responder" num envelope JSON validado.
// Depois, uma chamada final produz a resposta no schema da tarefa, com os resultados das ferramentas.
export async function runAgent(env,owner,{provider='workers-ai',purpose,system,input,schema,schemaName,tools=[],toolContext={},maxSteps=3,maxTokens}){
 const byName=new Map(tools.map(t=>[t.name,t]));
 const trace=[];
 if(tools.length){
  const envelope={type:'object',additionalProperties:false,required:['acao','ferramenta','argumentos_json','motivo'],properties:{
   acao:{type:'string',enum:['usar_ferramenta','responder']},
   ferramenta:{type:'string',enum:[...byName.keys(),'nenhuma']},
   argumentos_json:{type:'string',description:'Objeto JSON (em texto) com os argumentos da ferramenta. Use "{}" se não houver.'},
   motivo:{type:'string',description:'Por que esta ação é necessária, em uma frase.'}
  }};
  const catalog=tools.map(t=>({nome:t.name,descricao:t.description,argumentos:t.parameters,efeito:t.effect}));
  for(let step=0;step<maxSteps;step++){
   const {data}=await generateStructured(env,owner,{provider,purpose:purpose+':passo',schemaName:'acao_do_agente',maxTokens:400,
    system:system+'\n\nVocê pode consultar ferramentas de leitura antes de responder. Use uma ferramenta somente quando ela trouxer informação necessária. Quando já tiver o suficiente, escolha "responder".',
    input:{tarefa:input,ferramentas:catalog,resultados_anteriores:trace},schema:envelope});
   if(data.acao==='responder'||data.ferramenta==='nenhuma')break;
   const tool=byName.get(data.ferramenta);
   let args={};try{args=JSON.parse(data.argumentos_json||'{}')}catch{args=null}
   const argErrors=args&&typeof args==='object'&&!Array.isArray(args)?validate(tool.parameters,args):['argumentos não são um objeto JSON'];
   let result;
   if(argErrors.length)result={erro:'Argumentos inválidos: '+argErrors.slice(0,5).join('; ')};
   else{
    try{result=await tool.run(env,owner,args,toolContext)}
    catch(error){result={erro:error instanceof AppError?error.message:'A ferramenta falhou.'}}
   }
   const serialized=JSON.stringify(result);
   trace.push({ferramenta:tool.name,argumentos:args,resultado:serialized.length>6000?{resultado_truncado:serialized.slice(0,6000)}:result});
  }
 }
 const final=await generateStructured(env,owner,{provider,purpose,system,schema,schemaName,maxTokens,input:{tarefa:input,resultados_das_ferramentas:trace}});
 return {...final,toolCalls:trace.map(t=>({tool:t.ferramenta,arguments:t.argumentos}))};
}
