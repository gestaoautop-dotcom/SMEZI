/* Same-origin APIs only. Tokens and client secrets never enter the browser. */
(()=>{'use strict';
 const el=id=>document.getElementById(id),engine=globalThis.SmeziEngine;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={x:'X',linkedin:'LinkedIn',instagram:'Instagram',threads:'Threads'};
 let status=null,state=null,syncing=false,syncTimer=null,cloudEnabled=false,merging=false,dirty=false;
 const notify=text=>engine.message(text);
 async function api(path,data){
  const response=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const type=response.headers.get('Content-Type')||'';if(!type.includes('application/json'))throw Error('O serviço do servidor não está disponível nesta origem. Use o endereço Cloudflare Pages.');
  const value=await response.json();if(!response.ok)throw Error(value.error||'Não foi possível concluir a operação.');return value;
 }
 async function action(button,task){button.disabled=true;try{await task()}catch(e){notify(e.message)}finally{refreshActions();button.disabled=false}}
 function refreshActions(){
  const signed=!!status?.user,db=signed&&status.features.database;
  for(const id of ['syncCloud','saveClient','createLink','listBackups','backupCloud'])el(id).disabled=!db;
  el('generateAI').disabled=!(db&&status.features.ai);el('logoutBtn').disabled=!signed;
  document.querySelectorAll('[data-cloud-act]').forEach(b=>b.disabled=!db);
 }
 function renderStatus(){
  const f=status.features;if(status.user)cloudEnabled=localStorage.getItem('smezi-cloud-sync-owner')===status.user.id;el('cloudBadge').textContent=status.user?'Conectada · '+status.user.login:'Modo local · entrar para usar a nuvem';
  el('accountState').textContent=status.user?'Conta autorizada: '+status.user.login+'. Sincronize para transferir suas versões locais.':f.authentication?'Entre com a conta GitHub autorizada. Seus dados locais permanecem neste navegador.':'O código do servidor está publicado. O login aguarda a configuração do aplicativo GitHub no Cloudflare.';
  el('loginBtn').classList.toggle('hidden',!!status.user||!f.authentication);
  el('servicesList').innerHTML=Object.entries({Login:f.authentication,'Banco D1':f.database,'Backup R2':f.backups,'Geração com IA':f.ai,'Publicação habilitada':f.publishing,'Agendador configurado':f.scheduler}).map(([label,ready])=>'<div class="entry">'+esc(label)+' <span class="tag">'+(ready?'Configurado':'Aguardando configuração')+'</span></div>').join('');
  renderConnections();refreshActions();
 }
 function renderConnections(){
  el('connectionsList').innerHTML=Object.entries(labels).map(([provider,label])=>{const conn=state?.connections.find(c=>c.provider===provider);return '<div class="entry row"><div><strong>'+label+'</strong><span class="hint">'+(conn?esc(conn.label)+' · validade: '+esc(new Date(conn.expires_at).toLocaleString('pt-BR')):status?.features.providers[provider]?'Aplicativo configurado; autorize sua conta.':'Aplicativo oficial ainda não configurado.')+'</span></div><div class="actions"><button class="btn" data-connect="'+provider+'" '+(!status?.user||!status.features.providers[provider]?'disabled':'')+'>'+(conn?'Reconectar':'Conectar conta')+'</button>'+(conn?'<button class="btn" data-disconnect="'+provider+'">Desconectar</button>':'')+'</div></div>'}).join('');
 }

 const metaFormat=(value,style='decimal',currency='BRL')=>{
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';
  return new Intl.NumberFormat('pt-BR',style==='currency'?{style:'currency',currency}:{maximumFractionDigits:0}).format(Number(value));
 };
 let metaLoaded=false;
 async function refreshMeta(){
  const button=el('metaRefresh'),message=el('metaStatus');
  if(!status?.user){message.textContent='Entre com GitHub para consultar a Meta Ads.';return}
  if(!status.features.metaAds?.configured){message.textContent='A conexão Meta Ads ainda não está configurada no servidor.';return}
  button.disabled=true;message.textContent='Consultando a Meta Ads…';
  el('metaKpis').replaceChildren();el('metaCampaigns').replaceChildren();el('metaDisclosure').textContent='';
  try{
   const [account,campaigns,insights]=await Promise.all([
    api('meta/account'),api('meta/campaigns'),api('meta/insights?days='+encodeURIComponent(el('metaPeriod').value))
   ]);
   const rows=Array.isArray(insights.rows)?insights.rows:[];
   const currency=account.currency||'BRL';
   el('metaAccount').textContent=(account.name||'Conta Meta')+' · '+(account.id||'')+' · '+currency+' · '+(account.timezone_name||'Fuso não informado');
   const total=key=>rows.reduce((sum,row)=>sum+(Number.isFinite(Number(row[key]))&&row[key]!==null?Number(row[key]):0),0);
   const reach=rows.length===1?metaFormat(rows[0].reach):'—';
   const metrics=[
    ['Investimento',metaFormat(total('spend'),'currency',currency)],
    ['Impressões',metaFormat(total('impressions'))],
    ['Cliques',metaFormat(total('clicks'))],
    ['Alcance',reach],
    ['Leads reportados',rows.some(row=>row.leads!==null)?metaFormat(total('leads')):'—']
   ];
   el('metaKpis').innerHTML=metrics.map(([name,value])=>'<div class="card"><div class="muted small">'+esc(name)+'</div><div class="stat">'+esc(value)+'</div></div>').join('');
   const byId=new Map(rows.map(x=>[String(x.campaign_id),x]));
   const list=Array.isArray(campaigns.campaigns)?campaigns.campaigns:[];
   el('metaCampaigns').innerHTML='<h2>Campanhas ('+list.length+')</h2>'+
    (list.length?list.map(c=>{
     const m=byId.get(String(c.id));
     return '<div class="entry"><div class="row"><strong>'+esc(c.name||'Campanha sem nome')+'</strong><span class="tag">'+esc(c.effective_status||c.status||'Não informado')+'</span></div>'+
      '<p class="hint">Objetivo: '+esc(c.objective||'Não informado')+' · ID '+esc(c.id)+'</p>'+
      '<p class="small">Investimento: '+esc(m?metaFormat(m.spend,'currency',currency):'Sem dados')+' · Impressões: '+esc(m?metaFormat(m.impressions):'—')+' · Cliques: '+esc(m?metaFormat(m.clicks):'—')+' · Leads: '+esc(m?metaFormat(m.leads):'—')+'</p></div>'
    }).join(''):'<p class="muted">Nenhuma campanha retornada pela Meta.</p>');
   el('metaDisclosure').textContent='Período '+insights.range.since+' a '+insights.range.until+'. '+(insights.note||'')+
     (insights.hasMore||campaigns.hasMore?' Há mais páginas de dados na API; este painel mostra apenas a primeira página.':'');
   message.textContent='Leitura concluída · '+new Date().toLocaleString('pt-BR')+'. Métricas ausentes permanecem sem valor.';
   metaLoaded=true;
  }catch(error){message.textContent='Não foi possível atualizar: '+error.message}
  finally{button.disabled=false}
 }
 el('metaRefresh').onclick=refreshMeta;
 document.querySelector('[data-view="analytics"]').addEventListener('click',()=>{
  if(!metaLoaded&&status?.user)refreshMeta();
 });
 function postOptions(){return '<option value="">Sem atribuição</option>'+engine.snapshot().posts.slice().reverse().map(p=>'<option value="'+esc(p.id)+'">'+esc(p.platform+' · '+p.text.slice(0,70))+'</option>').join('')}
 function renderState(){
  renderConnections();
  const old=el('clientSource').value;el('clientSource').innerHTML=postOptions();el('clientSource').value=old;el('linkPost').innerHTML=postOptions();
  el('clientsList').innerHTML=state.clients.length?state.clients.map(c=>'<div class="entry"><strong>'+esc(c.name)+'</strong><span class="tag">'+esc(c.stage)+'</span><p class="hint">'+esc(c.project)+' · '+esc(c.email)+'</p><p class="small">'+esc(c.notes)+'</p><button class="btn" data-client="'+esc(c.id)+'">Editar contato</button> <button class="btn" data-history="'+esc(c.id)+'">Ver histórico</button></div>').join(''):'<p class="muted">Nenhum contato registrado. Comece por uma conversa real.</p>';
  const states={pending:'Na fila',preparing:'Preparando mídia',publishing:'Enviando',published:'Publicado',uncertain:'Entrega não confirmada · verificar na rede',failed:'Falhou',cancelled:'Cancelado'};
  el('jobsList').innerHTML='<h2>Fila no servidor</h2><p class="hint">Último sinal do agendador: '+esc(state.schedulerLastSeen?new Date(state.schedulerLastSeen).toLocaleString('pt-BR'):'ainda não recebido')+'</p>'+(state.jobs.length?state.jobs.map(j=>'<div class="entry"><strong>'+esc(labels[j.provider])+' · '+esc(states[j.status]||j.status)+'</strong><div class="hint">'+esc(new Date(j.scheduled_at).toLocaleString('pt-BR'))+' · '+esc(j.error||j.remote_id||'Aguardando envio')+'</div>'+(j.status==='pending'?'<button class="btn" data-cancel-job="'+esc(j.id)+'">Cancelar envio</button>':'')+(j.status==='published'?'<button class="btn" data-metrics="'+esc(j.id)+'">Atualizar métricas</button>':'')+'</div>').join(''):'<p class="hint">Nenhum envio automático agendado.</p>');
  el('linksList').innerHTML=state.links.map(l=>'<div class="entry"><strong>'+esc(l.clicks)+' acesso(s)</strong><div class="hint">'+esc(l.target)+'</div></div>').join('');
  el('metricsList').innerHTML='<h2>Métricas coletadas</h2>'+(state.metrics.length?state.metrics.map(m=>'<div class="entry"><span class="hint">Coleta: '+esc(new Date(m.collected_at).toLocaleString('pt-BR'))+'</span><pre class="post small">'+esc(JSON.stringify(JSON.parse(m.payload),null,2))+'</pre></div>').join(''):'<p class="hint">Nenhuma métrica coletada. Os números serão lidos das APIs após uma publicação real.</p>');
  refreshActions();
 }
 async function loadState(){state=await api('state');merging=true;try{engine.mergeCloud(state.data)}finally{merging=false}renderState();const rec=await api('recommendations');el('recommendations').textContent=rec.recommendations.map(x=>x.text).join('\n')||rec.note}
 async function refresh(){try{status=await api('status');renderStatus();if(status.user&&status.features.database){if(cloudEnabled)await syncNow();else await loadState()}}catch(e){el('cloudBadge').textContent='Modo local · servidor aguardando ativação';el('accountState').textContent=e.message;notify(e.message)}}
 async function syncNow(){syncing=true;dirty=false;try{const result=await api('sync',engine.snapshot());merging=true;try{engine.mergeCloud(result.data)}finally{merging=false}await loadState();cloudEnabled=true;localStorage.setItem('smezi-cloud-sync-owner',status.user.id);if(result.backupWarning)notify(result.backupWarning);return result}finally{syncing=false;if(dirty)changed()}}
 function changed(){if(!cloudEnabled||merging||!status?.user)return;dirty=true;if(syncing)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>{syncNow().catch(e=>notify('Alteração salva localmente; sincronização pendente: '+e.message))},1000)}
 el('refreshCloud').onclick=()=>action(el('refreshCloud'),refresh);
 el('syncCloud').onclick=()=>action(el('syncCloud'),async()=>{const result=await syncNow();notify(result.backupWarning||'Memória e versões sincronizadas. Os dados locais foram preservados.')});
 el('logoutBtn').onclick=()=>action(el('logoutBtn'),async()=>{await api('auth/logout',{});state=null;status=null;location.reload()});
 el('generateAI').onclick=()=>action(el('generateAI'),async()=>{await syncNow();const result=await api('generate',{idea:el('idea').value,angle:el('angle').value,platform:el('platform').value,lang:el('lang').value});await loadState();engine.setDraft(result.post);notify('Rascunho gerado com as memórias disponíveis. Revise: a IA pode errar. Nenhuma aprovação foi concedida.')});
 el('saveClient').onclick=()=>action(el('saveClient'),async()=>{await api('clients',{id:el('clientId').value||undefined,name:el('clientName').value,email:el('clientEmail').value,stage:el('clientStage').value,sourcePostId:el('clientSource').value,project:el('clientProject').value,notes:el('clientNotes').value});await loadState();notify('Contato e histórico salvos no CRM.')});
 el('newClient').onclick=()=>{for(const id of ['clientId','clientName','clientEmail','clientProject','clientNotes'])el(id).value='';el('clientStage').value='novo';el('clientSource').value='';el('clientHistory').textContent=''};
 el('backupCloud').onclick=()=>action(el('backupCloud'),async()=>{await syncNow();await api('backups',{});notify('Backup criado em R2 com as versões e o CRM.')});
 el('listBackups').onclick=()=>action(el('listBackups'),async()=>{const backups=await api('backups');el('backupsList').innerHTML=backups.length?backups.slice().reverse().map(b=>'<div class="entry"><span class="small">'+esc(b.uploaded)+' · '+esc(b.size)+' bytes</span> <button class="btn" data-restore-cloud="'+esc(b.key)+'">Recuperar conteúdo sem substituir versões atuais</button></div>').join(''):'Nenhum backup encontrado.'});
 el('createLink').onclick=()=>action(el('createLink'),async()=>{const input={recordId:el('linkPost').value,target:el('linkTarget').value};await syncNow();const result=await api('links',input);el('newLink').textContent=result.url;await loadState()});
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.cloudAct)action(button,async()=>{
   if(!status?.user)throw Error('Entre antes de usar a nuvem.');
   const date=button.parentElement.querySelector('[data-cloud-date]')?.value;
   await syncNow();
   if(button.dataset.cloudAct==='approve'){await api('approve',{recordId:button.dataset.record});notify('Versão exata aprovada no servidor. Escolha uma data para enviá-la à fila.')}
   if(button.dataset.cloudAct==='schedule'){if(!date)throw Error('Escolha a data e o horário junto ao conteúdo.');await api('jobs',{recordId:button.dataset.record,scheduledAt:new Date(date).toISOString()});notify('Publicação aprovada incluída na fila automática.')}
   await loadState();
  });
  if(button.dataset.connect)action(button,async()=>{const result=await api('social/'+button.dataset.connect+'/connect',{});location.assign(result.url)});
  if(button.dataset.disconnect)action(button,async()=>{await api('social/'+button.dataset.disconnect+'/disconnect',{});await loadState();notify('Conexão removida e envios pendentes cancelados. Você também pode revogar o aplicativo na rede social.')});
  if(button.dataset.cancelJob)action(button,async()=>{await api('jobs/'+button.dataset.cancelJob+'/cancel',{});await loadState()});
  if(button.dataset.metrics)action(button,async()=>{await api('metrics',{jobId:button.dataset.metrics});await loadState();notify('Métricas oficiais atualizadas.')});
  if(button.dataset.restoreCloud)action(button,async()=>{const result=await api('backups/restore',{key:button.dataset.restoreCloud});engine.mergeCloud(result.data);await loadState();notify('Conteúdo recuperado sem apagar versões atuais.')});
  if(button.dataset.client){const c=state.clients.find(x=>x.id===button.dataset.client);if(!c)return;for(const [id,key] of Object.entries({clientId:'id',clientName:'name',clientEmail:'email',clientStage:'stage',clientSource:'source_post_id',clientProject:'project',clientNotes:'notes'}))el(id).value=c[key]||'';}
  if(button.dataset.history)action(button,async()=>{const history=await api('clients/'+encodeURIComponent(button.dataset.history)+'/history');el('clientHistory').textContent=history.map(x=>new Date(x.created_at).toLocaleString('pt-BR')+'\n'+JSON.stringify(JSON.parse(x.payload),null,2)).join('\n\n')});
 });
 globalThis.SmeziCloud={refreshActions,changed};refresh();
})();
