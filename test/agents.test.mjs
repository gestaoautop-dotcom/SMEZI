import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle} from '../server/worker.mjs';
import {sign} from '../server/security.mjs';
import {sync,snapshot} from '../server/store.mjs';
import {ensureAgents,listAgents,updateAgent,agentHistory,addMemory,reviewMemory,memoryHistory,latestMemories,rankMemories,collaborate,conversationDetail,parseAgentJSON,RULES} from '../server/agents.mjs';

function fixture(replies=[]){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['0001_content_engine.sql','0004_agents_memory.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return sql.prepare(query).run(...args)},_query:query,_args:args}}}},async batch(items){sql.exec('BEGIN');try{const result=items.map(x=>sql.prepare(x._query).run(...x._args));sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
 const calls=[];
 const AI={async run(model,input){calls.push(input);const next=replies.shift();if(next instanceof Error)throw next;return {response:typeof next==='string'?next:JSON.stringify(next)}}};
 const env={DB,AI,AI_MODEL:'@cf/test/model',APP_ORIGIN:'https://engine.example',SESSION_SECRET:'session-secret-with-more-than-thirty-two-chars',GITHUB_ALLOWED_ID:'owner',GITHUB_CLIENT_ID:'id',GITHUB_CLIENT_SECRET:'secret'};
 return {sql,env,calls};
}
async function request(env,path,data,options={}){
 const token=await sign(env,{sub:options.owner||'owner',login:'caroline'},'session');
 return handle(new Request(env.APP_ORIGIN+path,{method:data===undefined?'GET':'POST',headers:{Cookie:'__Host-smezi_session='+token,Origin:options.origin||env.APP_ORIGIN,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
}
const research={briefing:'Briefing da Jade',angulos:['Ângulo novo'],fatos:[{texto:'Fato verificado',memoria:'PLACEHOLDER'},{texto:'Fato inventado',memoria:'id-falso'}],hipoteses:['Talvez funcione'],perguntas_para_autora:['Qual foi o prazo real?'],notas_pesquisa:[{titulo:'Nota sobre automação',texto:'Clientes perguntam sobre automação de atendimento.',tipo:'pesquisa'}]};

test('agents are seeded once per owner and isolated',async()=>{
 const {env}=fixture();
 await ensureAgents(env,'owner');await ensureAgents(env,'owner');
 const list=await listAgents(env,'owner');
 assert.deepEqual(list.map(a=>a.id),['leonardo','jade']);
 assert.equal(list.find(a=>a.id==='jade').origin,'padrao-provisorio');
 assert.equal((await listAgents(env,'other')).length,0);
});

test('instruction changes preserve the previous version',async()=>{
 const {env}=fixture();await ensureAgents(env,'owner');
 const before=(await listAgents(env,'owner')).find(a=>a.id==='jade').instructions;
 await updateAgent(env,'owner',{agentId:'jade',instructions:'Instruções originais da Jade, coladas pela autora.'});
 const jade=(await listAgents(env,'owner')).find(a=>a.id==='jade');
 assert.equal(jade.origin,'proprietaria');
 assert.equal((await agentHistory(env,'owner','jade'))[0].instructions,before);
 await assert.rejects(()=>updateAgent(env,'owner',{agentId:'jade',instructions:'curta'}),/20 e 6.000/);
 await assert.rejects(()=>updateAgent(env,'other',{agentId:'jade',instructions:'x'.repeat(30)}),/não encontrado/);
});

test('memory is append-only: reviews create versions and history keeps everything',async()=>{
 const {env,sql}=fixture();await ensureAgents(env,'owner');
 const {memory}=await addMemory(env,'owner',{agentId:'jade',title:'Fonte',text:'Dado com fonte.',kind:'fato',source:'https://exemplo.com'});
 assert.equal(memory.status,'rascunho');
 await reviewMemory(env,'owner',{rootId:memory.rootId,status:'verificada'});
 await reviewMemory(env,'owner',{rootId:memory.rootId,status:'contestada'});
 const versions=await memoryHistory(env,'owner',memory.rootId);
 assert.deepEqual(versions.map(v=>v.status),['contestada','verificada','rascunho']);
 assert.equal((await latestMemories(env,'owner')).length,1);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM agent_memories').get().n,3);
 await assert.rejects(()=>reviewMemory(env,'other',{rootId:memory.rootId,status:'verificada'}),/não encontrada/);
 // Correção de conteúdo também é nova versão do mesmo root.
 const corrected=await addMemory(env,'owner',{agentId:'jade',title:'Fonte',text:'Dado corrigido.',kind:'fato',rootId:memory.rootId,status:'verificada'});
 assert.equal(corrected.memory.rootId,memory.rootId);assert.equal((await memoryHistory(env,'owner',memory.rootId)).length,4);
});

test('agent-written notes are always drafts, even if they claim to be verified',async()=>{
 const {env}=fixture();await ensureAgents(env,'owner');
 const {memory}=await addMemory(env,'owner',{agentId:'jade',title:'Nota',text:'Texto',status:'verificada'},{origin:'agente'});
 assert.equal(memory.status,'rascunho');assert.equal(memory.origin,'agente');
});

test('retrieval ranks relevant memories and ignores contested or replaced ones',()=>{
 const m=(id,title,text,status='rascunho')=>({id,title,text,status,agentId:'jade',scope:'compartilhada'});
 const ranked=rankMemories([m('a','Receitas','Bolo de cenoura'),m('b','Automação de atendimento','WhatsApp e Instagram','verificada'),m('c','Automação antiga','Instagram','substituida'),m('d','Atendimento','Instagram direct')],'automação no atendimento do Instagram');
 assert.deepEqual(ranked.map(x=>x.id),['b','d']);
 assert.deepEqual(rankMemories([m('a','x','y'),m('b','z','w','verificada')],'nada relacionado').map(x=>x.id),['b']);
});

test('JSON parsing tolerates fences and rejects non-objects',()=>{
 assert.deepEqual(parseAgentJSON('```json\n{"texto":"oi"}\n```'),{texto:'oi'});
 assert.equal(parseAgentJSON('sem json'),null);assert.equal(parseAgentJSON('[1,2]'),null);
});

test('full collaboration: Jade researches, Leonardo drafts, Jade reviews, Leonardo finalizes; nothing is lost',async()=>{
 const {env,calls,sql}=fixture();await ensureAgents(env,'owner');
 await sync(env,'owner',{memories:[{id:'mem-autora',title:'Minha voz',text:'Escrevo de forma direta.',kind:'decisao'}],ideas:[],posts:[]});
 const verified=(await addMemory(env,'owner',{agentId:'jade',title:'Atendimento automatizado',text:'Dado verificado sobre atendimento.',status:'verificada',kind:'fato'})).memory;
 const replies=[
  {...research,fatos:[{texto:'Fato verificado',memoria:verified.id},{texto:'Fato inventado',memoria:'id-falso'}]},
  {texto:'Rascunho do Leonardo',justificativa:'Ângulo novo',memorias_usadas:[verified.id,'mem-autora','inventado']},
  {avaliacao:'Bom, mas genérico',problemas:['Frase genérica'],sugestoes:['Ser específico'],aprendizados:[{titulo:'Evitar genérico',texto:'Use exemplos reais.'}]},
  '```json\n{"texto":"Versão final do Leonardo","mudancas":["Mais específico"],"memorias_usadas":["mem-autora"]}\n```'
 ];
 env.AI={async run(model,input){calls.push(input);return {response:typeof replies[0]==='string'?replies.shift():JSON.stringify(replies.shift())}}};
 const result=await collaborate(env,'owner',{topic:'Automação de atendimento no Instagram',platform:'Instagram',lang:'pt'});
 assert.equal(result.status,'concluida');assert.equal(calls.length,4);
 assert.deepEqual(result.steps.map(s=>s.step),['pesquisa','rascunho','revisao','final']);
 assert.equal(result.post.text,'Versão final do Leonardo');assert.equal(result.versions.length,2);
 assert.equal(result.approved,false);assert.equal(result.published,false);
 // Fato sem memória válida vira hipótese; citações inventadas são removidas.
 const brief=result.steps[0].payload;
 assert.deepEqual(brief.fatos.map(f=>f.texto),['Fato verificado']);assert.ok(brief.hipoteses.includes('Fato inventado'));
 assert.deepEqual(result.steps[1].payload.memorias_usadas,[verified.id,'mem-autora']);
 // Leonardo recebeu a nota nova da Jade (conversa entre agentes via memória compartilhada).
 assert.match(calls[1].messages[1].content,/Nota sobre automação/);
 // Memória e tópico ficam só na mensagem do usuário (dados), nunca no prompt de sistema.
 assert.ok(!calls[1].messages[0].content.includes('Dado verificado'));const system=calls[0].messages[0].content;assert.ok(system.indexOf(RULES)>system.indexOf('Você é Jade'));
 // Notas da Jade: pesquisa + aprendizado, todas como rascunho.
 assert.deepEqual(result.notes.map(n=>[n.kind,n.status]),[['pesquisa','rascunho'],['aprendizado','rascunho']]);
 // As duas versões do texto estão no fluxo normal de posts, no mesmo root.
 const posts=(await snapshot(env,'owner')).posts;
 assert.deepEqual(posts.map(p=>[p.text,p.revision,p.rootId]),[['Rascunho do Leonardo',1,result.versions[0]],['Versão final do Leonardo',2,result.versions[0]]]);
 assert.equal((await snapshot(env,'owner')).ideas.length,1);
 const detail=await conversationDetail(env,'owner',result.conversationId);
 assert.equal(detail.messages.length,4);assert.equal(detail.conversation.status,'concluida');assert.equal(detail.notes.length,2);
 assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM agent_conversations WHERE owner='other'").get().n,0);
 await assert.rejects(()=>conversationDetail(env,'other',result.conversationId),/não encontrada/);
});

test('a failure after the draft keeps the draft and marks the conversation incomplete',async()=>{
 const {env}=fixture([research,{texto:'Rascunho preservado',memorias_usadas:[]},new Error('timeout')]);
 const result=await collaborate(env,'owner',{topic:'Tema',platform:'X',lang:'pt'});
 assert.equal(result.status,'incompleta');assert.match(result.error,/Jade não respondeu/);
 assert.equal(result.post.text,'Rascunho preservado');
 assert.equal((await snapshot(env,'owner')).posts.length,1);
 assert.equal((await conversationDetail(env,'owner',result.conversationId)).messages.length,2);
});

test('a failure before any draft returns 502 but the conversation stays in history',async()=>{
 const {env,sql}=fixture([new Error('down')]);
 await assert.rejects(()=>collaborate(env,'owner',{topic:'Tema',platform:'X',lang:'pt'}),/preservada no histórico/);
 assert.equal(sql.prepare("SELECT status FROM agent_conversations").get().status,'incompleta');
});

test('review can be skipped (2 AI calls) and AI must be configured before quota is used',async()=>{
 const {env,calls,sql}=fixture([research,{texto:'Só rascunho'}]);
 const result=await collaborate(env,'owner',{topic:'Tema',platform:'LinkedIn',lang:'en',review:false});
 assert.equal(calls.length,2);assert.equal(result.versions.length,1);
 const off=fixture();delete off.env.AI;
 await assert.rejects(()=>collaborate(off.env,'owner',{topic:'Tema',platform:'X',lang:'pt'}),/Workers AI/);
 assert.equal(off.sql.prepare('SELECT COUNT(*) AS n FROM usage_limits').get().n,0);
 await assert.rejects(()=>collaborate(env,'owner',{topic:'Tema',platform:'Facebook',lang:'pt'}),/Rede ou idioma/);
});

test('daily collaboration limit is enforced',async()=>{
 const {env,sql}=fixture();
 sql.prepare("INSERT INTO usage_limits(owner,kind,bucket,count) VALUES('owner','agents-collaboration',?,15)").run(new Date().toISOString().slice(0,10));
 await assert.rejects(()=>collaborate(env,'owner',{topic:'Tema',platform:'X',lang:'pt'}),/Limite diário/);
});

test('HTTP routes require login, same origin and keep owners apart',async()=>{
 const {env}=fixture();
 assert.equal((await handle(new Request(env.APP_ORIGIN+'/api/agents'),env)).status,401);
 const list=await request(env,'/api/agents');assert.equal(list.status,200);
 const data=await list.json();assert.deepEqual(data.agents.map(a=>a.name),['Leonardo','Jade']);assert.equal(data.ai.ready,true);
 assert.equal((await request(env,'/api/agents/memories',{agentId:'jade',title:'t',text:'x'},{origin:'https://evil.example'})).status,403);
 const created=await request(env,'/api/agents/memories',{agentId:'jade',title:'Pesquisa',text:'Conteúdo da pesquisa'});assert.equal(created.status,201);
 const search=await (await request(env,'/api/agents/memories?agent=jade&q=pesquisa')).json();assert.equal(search.memories.length,1);
 assert.equal((await request(env,'/api/agents/memories',{agentId:'jade',title:'t',text:'x'},{owner:'other'})).status,403);
 assert.equal((await request(env,'/api/agents/nada')).status,404);
});
