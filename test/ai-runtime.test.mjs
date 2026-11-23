import {test} from 'node:test';
import assert from 'node:assert/strict';
import {d1,mockFetch} from './support/d1.mjs';
import {handle} from '../server/worker.mjs';
import {sign} from '../server/security.mjs';
import {validate,providerSchema,extractJSON} from '../server/json-schema.mjs';
import {generateStructured,runAgent,providerAvailability,callModel} from '../server/ai-runtime.mjs';
import {TOOLS} from '../server/assistant.mjs';

const schema={type:'object',additionalProperties:false,required:['titulo','itens'],properties:{titulo:{type:'string',maxLength:20},itens:{type:'array',maxItems:2,items:{type:'string',enum:['a','b']}}}};
function fixture(replies=[],extra={}){
 const {sql,DB}=d1();const calls=[];
 const AI={async run(model,input){calls.push(input);const next=replies.shift();if(next instanceof Error)throw next;return {response:typeof next==='string'?next:next,usage:{prompt_tokens:10,completion_tokens:5}}}};
 const env={DB,AI,AI_MODEL:'@cf/test/model',APP_ORIGIN:'https://engine.example',SESSION_SECRET:'session-secret-with-more-than-thirty-two-chars',GITHUB_ALLOWED_ID:'owner',GITHUB_CLIENT_ID:'id',GITHUB_CLIENT_SECRET:'secret',...extra};
 return {sql,env,calls};
}
async function req(env,path,data){
 const token=await sign(env,{sub:'owner',login:'caroline'},'session');
 return handle(new Request(env.APP_ORIGIN+path,{method:data===undefined?'GET':'POST',headers:{Cookie:'__Host-smezi_session='+token,Origin:env.APP_ORIGIN,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
}

test('schema validator enforces types, enums, required, extra fields and limits',()=>{
 assert.deepEqual(validate(schema,{titulo:'ok',itens:['a']}),[]);
 const errors=validate(schema,{titulo:'x'.repeat(21),itens:['a','c','b'],extra:1});
 assert.ok(errors.some(e=>e.includes('20 caracteres')));assert.ok(errors.some(e=>e.includes('fora da lista')));
 assert.ok(errors.some(e=>e.includes('mais de 2')));assert.ok(errors.some(e=>e.includes('não permitido')));
 assert.deepEqual(validate(schema,{itens:[]}),['$.titulo: obrigatório']);
 const native=providerSchema(schema);assert.equal(native.properties.titulo.maxLength,undefined);assert.equal(native.properties.itens.maxItems,undefined);
 assert.deepEqual(extractJSON('```json\n{"a":1}\n```'),{a:1});assert.equal(extractJSON('nada'),null);
});

test('Workers AI: native JSON Mode, validation, one repair attempt, then refusal without saving',async()=>{
 {const {env,calls,sql}=fixture([{titulo:'Oi',itens:['a']}]);
  const r=await generateStructured(env,'owner',{purpose:'teste',system:'S',input:{},schema});
  assert.deepEqual(r.data,{titulo:'Oi',itens:['a']});
  assert.equal(calls[0].response_format.type,'json_schema');assert.equal(calls[0].response_format.json_schema.properties.titulo.maxLength,undefined);
  const usage=sql.prepare('SELECT provider,input_tokens,output_tokens,ok FROM ai_usage').get();
  assert.deepEqual({...usage},{provider:'workers-ai',input_tokens:10,output_tokens:5,ok:1});}
 {const {env,calls}=fixture(['texto livre',JSON.stringify({titulo:'Corrigido',itens:[]})]);
  const r=await generateStructured(env,'owner',{purpose:'teste',system:'S',input:{},schema});
  assert.equal(r.data.titulo,'Corrigido');assert.match(calls[1].messages[1].content,/erros/);}
 {const {env}=fixture(['{}','{"titulo":5}']);
  await assert.rejects(generateStructured(env,'owner',{purpose:'teste',system:'S',input:{},schema}),/formato esperado/);}
 {const {env,calls}=fixture([new Error('json mode unsupported'),JSON.stringify({titulo:'Sem JSON Mode',itens:[]})]);
  const r=await generateStructured(env,'owner',{purpose:'teste',system:'S',input:{},schema});
  assert.equal(r.data.titulo,'Sem JSON Mode');assert.equal(calls[1].response_format,undefined);}
});

test('paid providers stay off without the global switch AND the allowlist; request shapes per provider',async()=>{
 const keys={OPENAI_API_KEY:'k',OPENAI_MODEL:'gpt-test',GEMINI_API_KEY:'k',GEMINI_MODEL:'gemini-test',XAI_API_KEY:'k',XAI_MODEL:'grok-test',ANTHROPIC_API_KEY:'k',ANTHROPIC_MODEL:'claude-test'};
 const off=fixture([],keys);
 assert.equal(providerAvailability(off.env).openai.ready,false);
 await assert.rejects(callModel(off.env,{provider:'openai',system:'s',user:'u',schema}),/desativado/);
 const only=fixture([],{...keys,LEONARDO_EXTERNAL_AI_ENABLED:'true',LEONARDO_AI_ALLOWED_PROVIDERS:'anthropic'});
 await assert.rejects(callModel(only.env,{provider:'openai',system:'s',user:'u',schema}),/desativado/);
 const on=fixture([],{...keys,LEONARDO_EXTERNAL_AI_ENABLED:'true',LEONARDO_AI_ALLOWED_PROVIDERS:'openai,gemini,xai,anthropic'});
 const out=JSON.stringify({titulo:'x',itens:[]});
 const m=mockFetch([
  ['api.openai.com',{output:[{type:'message',content:[{type:'output_text',text:out}]}],usage:{input_tokens:1,output_tokens:2}}],
  ['api.x.ai',{output_text:out}],
  ['generativelanguage',{candidates:[{content:{parts:[{text:out}]}}]}],
  ['api.anthropic.com',{content:[{type:'text',text:out}],usage:{input_tokens:3,output_tokens:4}}]
 ]);
 try{
  for(const provider of ['openai','xai','gemini','anthropic'])assert.equal(extractJSON((await callModel(on.env,{provider,system:'s',user:'u',schema,schemaName:'teste'})).content).titulo,'x');
  const body=u=>JSON.parse(m.calls.find(c=>c.url.includes(u)).body);
  assert.deepEqual(body('api.openai.com').text.format.type,'json_schema');assert.equal(body('api.openai.com').text.format.strict,true);assert.equal(body('api.openai.com').store,false);
  assert.equal(body('api.x.ai').text.format.name,'teste');
  assert.equal(body('generativelanguage').generationConfig.responseMimeType,'application/json');
  assert.equal(body('api.anthropic.com').output_config.format.type,'json_schema');
  assert.equal(m.calls.find(c=>c.url.includes('api.anthropic.com')).headers['x-api-key'],'k');
 }finally{m.restore()}
});

test('agent tool loop: reads through declared tools, invalid arguments are reported back, final answer is structured',async()=>{
 const step=(acao,ferramenta,args)=>JSON.stringify({acao,ferramenta,argumentos_json:JSON.stringify(args),motivo:'x'});
 const {env,calls}=fixture([
  step('usar_ferramenta','publicacoes_recentes',{quantidade:500}),
  step('usar_ferramenta','publicacoes_recentes',{quantidade:3}),
  step('responder','nenhuma',{}),
  JSON.stringify({titulo:'Final',itens:['b']})
 ]);
 const tools=TOOLS.filter(t=>t.name==='publicacoes_recentes');
 const r=await runAgent(env,'owner',{purpose:'teste',system:'S',input:{pedido:'p'},schema,tools});
 assert.deepEqual(r.data,{titulo:'Final',itens:['b']});
 assert.equal(r.toolCalls.length,2);
 assert.match(calls[1].messages[1].content,/Argumentos inválidos/);
 assert.match(calls[3].messages[1].content,/resultados_das_ferramentas/);
 assert.ok(TOOLS.every(t=>t.effect==='leitura'));
});

test('assistant endpoint: captions per network respect limits; suggested rule is validated and NOT saved',async()=>{
 const {env,sql}=fixture([
  JSON.stringify({legendas:[{rede:'X',texto:'y'.repeat(400),hashtags:['design','#site']},{rede:'LinkedIn',texto:'não pedido',hashtags:[]}],chamada_para_acao:'Fale comigo',observacoes:''}),
  JSON.stringify({nome:'Cardápio',canal:'instagram',origem:'comentario',palavras_chave:['cardápio','menu'],correspondencia:'contem',resposta_publica:'Te enviei!',resposta_privada:'Link: …',observacoes:''})
 ]);
 const a=await (await req(env,'/api/assistant',{tarefa:'legendas',usarFerramentas:false,entrada:{tema:'Site novo',redes:['X']}})).json();
 assert.equal(a.resultado.legendas.length,1);assert.equal(Array.from(a.resultado.legendas[0].texto).length,280);
 assert.deepEqual(a.resultado.legendas[0].hashtags,['#design','#site']);assert.equal(a.saved,false);
 const b=await (await req(env,'/api/assistant',{tarefa:'regra_automacao',usarFerramentas:false,entrada:{pedido:'quem comentar cardápio recebe o link'}})).json();
 assert.equal(b.resultado.regra.active,false);assert.equal(b.resultado.regra.mode,'aprovacao');assert.equal(b.resultado.regra.keywords,'cardapio, menu');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM automation_rules').get().n,0);
 const bad=await req(env,'/api/assistant',{tarefa:'publicar_tudo',entrada:{}});assert.equal(bad.status,400);
 const info=await (await req(env,'/api/assistant')).json();
 assert.equal(info.providers['workers-ai'].ready,true);assert.equal(info.usage30d[0].calls,2);
});
