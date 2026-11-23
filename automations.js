'use strict';
// Automações por palavra-gatilho. Conteúdo do servidor e de terceiros entra só por textContent.
const $=id=>document.getElementById(id);
const STATUS={recebido:'recebido',sem_regra:'sem regra',rascunho:'rascunho',pendente:'aguardando você',enviando:'enviando',enviado:'enviado',parcial:'enviado em parte',incerto:'sem confirmação',falhou:'falhou',ignorado:'descartado',bloqueado:'bloqueado',permissao_ausente:'falta permissão',fora_do_prazo:'fora do prazo'};
const TABS=[['pendente','Aguardando você'],['rascunho','Rascunhos'],['permissao_ausente','Falta permissão'],['sem_regra','Sem regra'],['enviado','Enviados'],['','Todos']];
const MODE={aprovacao:'aprovação',rascunho:'só rascunho',automatico:'automático'};
let tab='pendente',state=null;

function node(tag,props={},children=[]){const el=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('data-')||k.startsWith('aria-'))el.setAttribute(k,v);else el[k]=v}for(const c of children)if(c)el.append(c);return el}
async function api(path,data){
 const response=await fetch(path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 let result={};try{result=await response.json()}catch{}
 if(response.status===401)throw Error('Faça login no Leonardo para usar as automações.');
 if(!response.ok)throw Error(result.error||'Não foi possível concluir a operação.');
 return result;
}
const form=()=>({name:$('name').value,channel:$('channel').value,source:$('source').value,keywords:$('keywords').value,matchMode:$('matchMode').value,mode:$('mode').value,priority:Number($('priority').value),publicReply:$('source').value==='dm'?'':$('publicReply').value,privateReply:$('privateReply').value,active:$('active').checked,...($('ruleId').value?{id:$('ruleId').value}:{})});
function fill(r){
 $('ruleId').value=r.id||'';$('name').value=r.name||'';$('channel').value=r.channel||'instagram';$('source').value=r.source||'comentario';
 $('keywords').value=Array.isArray(r.keywords)?r.keywords.join(', '):(r.keywords||'');$('matchMode').value=r.matchMode||'contem';$('mode').value=r.mode||'aprovacao';
 $('priority').value=r.priority||100;$('publicReply').value=r.publicReply||'';$('privateReply').value=r.privateReply||'';$('active').checked=!!r.active;
 $('formTitle').textContent=r.id?'Editar regra':'Nova regra';togglePublic();
}
function togglePublic(){$('publicWrap').hidden=$('source').value==='dm'}
$('source').onchange=togglePublic;
$('mode').onchange=()=>{if($('mode').value==='automatico'&&state&&!state.autoReplyEnabled)$('formMsg').textContent='O envio automático está desligado na configuração geral: as respostas ficarão aguardando sua aprovação até ser ligado.'};

async function load(){
 try{
  state=await api('/api/automations');
  const conns=state.connections.map(c=>`${c.provider}: ${c.label}${c.expired?' (expirada)':''}`).join(' • ')||'nenhuma conta Meta conectada';
  $('status').textContent=`Envio automático geral: ${state.autoReplyEnabled?'LIGADO':'desligado'} (limite ${state.dailyAutoLimit}/dia). Contas: ${conns}.`;
  $('rules').replaceChildren(...(state.rules.length?state.rules.map(r=>{
   const edit=node('button',{class:'ghost',type:'button',text:'Editar'});edit.onclick=()=>{fill(r);$('name').focus()};
   const toggle=node('button',{class:'ghost',type:'button',text:r.active?'Desativar':'Ativar'});
   toggle.onclick=async()=>{toggle.disabled=true;try{await api('/api/automations/rules',{...r,active:!r.active});await load()}catch(e){$('formMsg').textContent=e.message}finally{toggle.disabled=false}};
   return node('div',{class:'entry'},[node('h3',{text:r.name}),
    node('span',{class:'chip '+(r.active?'on':'off'),text:r.active?'ativa':'inativa'}),node('span',{class:'chip',text:r.channel}),node('span',{class:'chip',text:r.source==='dm'?'DM':'comentário'}),node('span',{class:'chip'+(r.mode==='automatico'?' warn':''),text:MODE[r.mode]}),
    node('p',{class:'muted',text:'Gatilhos: '+r.keywords.join(', ')}),node('div',{class:'actions'},[edit,toggle])]);
  }):[node('p',{class:'muted',text:'Nenhuma regra ainda.'})]));
  renderTabs();await loadEvents();
 }catch(e){$('status').textContent=e.message}
}
function renderTabs(){
 $('tabs').replaceChildren(...TABS.map(([id,label])=>{const n=id?state?.counts?.[id]||0:'';const b=node('button',{class:'ghost',type:'button',text:n!==''?`${label} (${n})`:label,'aria-pressed':String(tab===id)});b.onclick=()=>{tab=id;renderTabs();loadEvents()};return b}));
}
async function loadEvents(){
 try{
  const {events}=await api('/api/automations/events'+(tab?'?status='+tab:''));
  $('events').replaceChildren(...(events.length?events.map(eventCard):[node('p',{class:'muted',text:'Nada aqui.'})]));
 }catch(e){$('events').replaceChildren(node('p',{class:'muted',text:e.message}))}
}
function eventCard(ev){
 const sendable=['recebido','sem_regra','rascunho','pendente','permissao_ausente','falhou'].includes(ev.status);
 const pub=ev.source==='comentario'?node('textarea',{value:ev.publicReply,maxLength:1000,disabled:!sendable,'aria-label':'Resposta pública'}):null;
 const priv=node('textarea',{value:ev.privateReply,maxLength:1000,disabled:!sendable,'aria-label':'Resposta privada'});
 const msg=node('p',{class:'muted',role:'status'});
 const send=node('button',{type:'button',text:'Enviar',disabled:!sendable});
 send.onclick=async()=>{
  if(!confirmSend(ev,pub,priv))return;
  send.disabled=true;msg.textContent='Enviando…';
  try{const r=await api(`/api/automations/events/${encodeURIComponent(ev.id)}/send`,{publicReply:pub?pub.value:'',privateReply:priv.value});msg.textContent='Resultado: '+(STATUS[r.status]||r.status)+(r.error?' — '+r.error:'');await load()}
  catch(e){msg.textContent=e.message;send.disabled=false}
 };
 const ignore=node('button',{class:'ghost',type:'button',text:'Descartar',disabled:!sendable});
 ignore.onclick=async()=>{ignore.disabled=true;try{await api(`/api/automations/events/${encodeURIComponent(ev.id)}/ignore`,{});await load()}catch(e){msg.textContent=e.message;ignore.disabled=false}};
 return node('div',{class:'entry'},[
  node('h3',{text:`${ev.senderName||'Contato'} • ${ev.channel} • ${ev.source==='dm'?'DM':'comentário'}`}),
  node('span',{class:'chip'+(['falhou','incerto','permissao_ausente','bloqueado'].includes(ev.status)?' off':ev.status==='enviado'?' on':' warn'),text:STATUS[ev.status]||ev.status}),
  node('span',{class:'muted',text:' '+new Date(ev.receivedAt).toLocaleString('pt-BR')}),
  node('div',{class:'quote',text:ev.text}),
  ev.error?node('p',{class:'muted notice',text:ev.error}):null,
  pub?node('label',{text:'Resposta pública'}):null,pub,node('label',{text:'Resposta privada'}),priv,
  node('div',{class:'actions'},[send,ignore]),msg]);
}
function confirmSend(ev,pub,priv){
 const parts=[pub&&pub.value.trim()?'resposta pública':null,priv.value.trim()?'mensagem privada':null].filter(Boolean);
 if(!parts.length){alertMsg('Escreva ao menos uma resposta.');return false}
 return window.confirm(`Enviar ${parts.join(' e ')} para ${ev.senderName||'este contato'} agora? Esta ação não pode ser desfeita.`);
}
function alertMsg(text){$('status').textContent=text}

$('saveRule').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await api('/api/automations/rules',form());fill(r);$('formMsg').textContent='Regra salva.'+(r.active?'':' Ela está inativa: ative quando quiser.');await load()}catch(err){$('formMsg').textContent=err.message}finally{b.disabled=false}};
$('newRule').onclick=()=>{fill({});$('formMsg').textContent=''};
$('test').onclick=async()=>{try{const r=await api('/api/automations/preview',{...form(),sampleText:$('sample').value});$('testResult').textContent=r.matches?`Casou. Pública: "${r.publicReply||'—'}" • Privada: "${r.privateReply||'—'}"`:'Não casou com esta regra.'}catch(e){$('testResult').textContent=e.message}};
$('suggest').onclick=async e=>{
 const b=e.currentTarget;if(!$('ask').value.trim())return;b.disabled=true;$('formMsg').textContent='O Leonardo está montando a regra…';
 try{const r=await api('/api/assistant',{tarefa:'regra_automacao',entrada:{pedido:$('ask').value}});const g=r.resultado.regra;
  fill({name:g.name,channel:g.channel,source:g.source,keywords:g.keywords.split(', '),matchMode:g.matchMode,mode:'aprovacao',priority:g.priority,publicReply:g.publicReply,privateReply:g.privateReply,active:false});
  $('formMsg').textContent='Sugestão carregada (inativa, modo aprovação). Revise e salve. '+(r.resultado.observacoes||'');
 }catch(err){$('formMsg').textContent=err.message}finally{b.disabled=false}
};
fill({});load();
