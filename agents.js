'use strict';
// Interface Leonardo + Jade. Todo conteúdo é inserido com textContent (sem HTML vindo da IA ou do banco).
const $=id=>document.getElementById(id);
const STEP={pesquisa:'Pesquisa e briefing',rascunho:'Rascunho',revisao:'Revisão',final:'Versão final'};
const STATUS={rascunho:'rascunho',verificada:'verificada',contestada:'contestada',substituida:'substituída'};
let agents=[];
function node(tag,props={},children=[]){const el=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('data-'))el.setAttribute(k,v);else el[k]=v}for(const c of children)if(c)el.append(c);return el}
async function api(path,data){
 const response=await fetch('/api/agents'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 let result={};try{result=await response.json()}catch{}
 if(response.status===401)throw Error('Faça login no Leonardo para usar os agentes.');
 if(!response.ok)throw Error(result.error||'Não foi possível concluir a operação.');
 return result;
}
const fill=(el,...items)=>el.replaceChildren(...items.filter(Boolean));
const nameOf=id=>agents.find(a=>a.id===id)?.name||id;
function message(m){
 return node('div',{class:'msg','data-agent':m.agentId},[node('span',{class:'who',text:m.agent||nameOf(m.agentId)}),node('span',{class:'step',text:STEP[m.step]||m.step}),node('div',{class:'output',text:m.text})]);
}
async function refresh(){
 try{
  const r=await api('');agents=r.agents;
  const counts=agents.map(a=>`${a.name}: ${r.counts[a.id]?.total||0} notas (${r.counts[a.id]?.verificada||0} verificadas)`).join(' • ');
  $('status').textContent=(r.ai.ready?`Agentes prontos — modelo ${r.ai.model} (Workers AI). `:'Workers AI não configurado: conecte o binding AI e AI_MODEL no Pages para ativar a colaboração. ')+counts;
  $('run').disabled=!r.ai.ready;
  $('limit').textContent=`Limite de ${r.dailyLimit} colaborações por dia. Cada colaboração usa 2 ou 4 chamadas ao Workers AI.`;
  for(const id of ['memAgent','newAgent']){const sel=$(id),keep=sel.value;sel.replaceChildren(...(id==='memAgent'?[node('option',{value:'',text:'Todos'})]:[]),...agents.map(a=>node('option',{value:a.id,text:a.name})));sel.value=keep||sel.options[0]?.value||''}
  renderInstructions();
 }catch(error){$('status').textContent=error.message}
}
function renderInstructions(){
 $('instructions').replaceChildren(...agents.map(a=>{
  const area=node('textarea',{maxLength:6000,value:a.instructions,id:'inst-'+a.id});area.style.minHeight='180px';
  const role=node('input',{maxLength:200,value:a.role,id:'role-'+a.id});
  const info=node('p',{class:'muted',text:a.origin==='padrao-provisorio'?'Padrão provisório — substitua pelas instruções originais.':a.origin==='proprietaria'?'Instruções definidas por você.':'Instruções padrão.'});
  const save=node('button',{text:'Salvar instruções de '+a.name});
  save.onclick=async()=>{save.disabled=true;try{await api('/instructions',{agentId:a.id,role:role.value,instructions:area.value});info.textContent='Salvo. A versão anterior foi preservada.';await refresh()}catch(e){info.textContent=e.message}finally{save.disabled=false}};
  return node('div',{class:'memory'},[node('h3',{text:a.name}),node('label',{htmlFor:'role-'+a.id,text:'Função'}),role,node('label',{htmlFor:'inst-'+a.id,text:'Instruções'}),area,info,save]);
 }));
}
function memoryCard(m){
 const tags=node('div',{class:'tags'},[node('span',{class:'tag '+m.status,text:STATUS[m.status]||m.status}),node('span',{class:'tag',text:m.kind}),node('span',{class:'tag',text:nameOf(m.agentId)}),node('span',{class:'tag',text:m.scope}),node('span',{class:'tag',text:m.origin==='agente'?'criada por agente':'criada por você'})]);
 const actions=node('div');
 for(const [status,label] of [['verificada','Verificar'],['contestada','Contestar'],['substituida','Marcar substituída'],['rascunho','Voltar a rascunho']]){
  if(status===m.status)continue;
  const b=node('button',{class:'ghost',text:label});b.onclick=async()=>{b.disabled=true;try{await api('/memories/review',{rootId:m.rootId,status});await loadMemories();await refresh()}catch(e){alert(e.message)}};actions.append(b);
 }
 const hist=node('button',{class:'ghost',text:'Histórico'}),histBox=node('div');
 hist.onclick=async()=>{try{const r=await api('/memories/history?root='+encodeURIComponent(m.rootId));histBox.replaceChildren(...r.versions.map(v=>node('p',{class:'muted',text:`${v.createdAt} — ${STATUS[v.status]||v.status}`})))}catch(e){histBox.textContent=e.message}};
 actions.append(hist);
 return node('div',{class:'memory'},[node('h3',{text:m.title}),tags,node('div',{class:'output',text:m.text}),m.source?node('p',{class:'muted',text:'Fonte: '+m.source}):null,actions,histBox]);
}
async function loadMemories(){
 try{
  const q=new URLSearchParams({agent:$('memAgent').value,q:$('memQuery').value});
  const r=await api('/memories?'+q);
  $('memories').replaceChildren(...(r.memories.length?r.memories.map(memoryCard):[node('p',{class:'muted',text:'Nenhuma nota encontrada.'})]));
 }catch(e){$('memories').textContent=e.message}
}
async function loadConversations(){
 try{
  const r=await api('/conversations');
  $('conversations').replaceChildren(...(r.conversations.length?r.conversations.map(c=>{const b=node('button',{class:'conv',text:`${c.created_at.slice(0,16).replace('T',' ')} · ${c.platform} · ${c.status} — ${c.topic.slice(0,120)}`});b.onclick=()=>openConversation(c.id);return b}):[node('p',{class:'muted',text:'Nenhuma conversa ainda.'})]));
 }catch(e){$('conversations').textContent=e.message}
}
async function openConversation(id){
 try{
  const r=await api('/conversations/'+encodeURIComponent(id));
  fill($('conversationDetail'),node('h3',{text:'Tema: '+r.conversation.topic.slice(0,300)}),r.conversation.error?node('p',{class:'notice',text:r.conversation.error}):null,...r.messages.map(message),r.notes.length?node('p',{class:'muted',text:`${r.notes.length} nota(s) registrada(s) nesta conversa — revise na Memória de pesquisa.`}):null);
 }catch(e){$('conversationDetail').textContent=e.message}
}
$('run').onclick=async()=>{
 const topic=$('topic').value.trim();
 if(!topic){$('timeline').textContent='Escreva o tema ou a ideia antes de iniciar.';return}
 $('run').disabled=true;$('timeline').replaceChildren(node('p',{class:'muted',text:'Jade está pesquisando e Leonardo vai escrever em seguida… isso pode levar até alguns minutos.'}));
 try{
  const r=await api('/collaborate',{topic,angle:$('angle').value,platform:$('platform').value,lang:$('lang').value,review:$('review').checked});
  const copy=node('button',{class:'ghost',text:'Copiar texto final'});copy.onclick=()=>navigator.clipboard?.writeText(r.post.text);
  fill($('timeline'),
   ...r.steps.map(message),
   node('div',{class:'final'},[node('div',{class:'eyebrow',text:`Texto ${r.versions.length>1?'final (versão 2)':'(versão 1)'} · ${r.post.text.length} caracteres`}),node('div',{class:'output',text:r.post.text}),copy]),
   node('p',{class:'muted',text:`Salvo no Leonardo como rascunho (${r.versions.length} versão/versões preservadas). Revise e aprove no Calendário do painel. ${r.notes.length} nota(s) nova(s) aguardam sua validação na Memória de pesquisa.`}),
   r.error?node('p',{class:'notice',text:'Colaboração incompleta: '+r.error+' O que foi criado está preservado.'}):null
  );
  await Promise.all([loadMemories(),loadConversations(),refresh()]);
 }catch(e){$('timeline').replaceChildren(node('p',{class:'notice',text:e.message}));await loadConversations()}
 finally{$('run').disabled=false}
};
$('memSearch').onclick=loadMemories;
$('memQuery').addEventListener('keydown',e=>{if(e.key==='Enter')loadMemories()});
$('memAgent').onchange=loadMemories;
$('newSave').onclick=async()=>{
 try{
  await api('/memories',{agentId:$('newAgent').value,kind:$('newKind').value,status:$('newStatus').value,scope:$('newScope').value,title:$('newTitle').value,text:$('newText').value,source:$('newSource').value});
  for(const id of ['newTitle','newText','newSource'])$(id).value='';
  await Promise.all([loadMemories(),refresh()]);
 }catch(e){alert(e.message)}
};
refresh().then(()=>Promise.all([loadMemories(),loadConversations()]));
