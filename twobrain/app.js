(function () {
  'use strict';
  const B = window.TwoBrain, key = 'smezi-twobrain-v1';
  let state = B.empty(), current = 'command', query = '', filter = '';
  const view = document.querySelector('#view');
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = s => new Date(s).toLocaleDateString('pt-BR');
  function notify(text) { document.querySelector('#notice').textContent = text; }
  function warning(text) { const el = document.querySelector('#storage-warning'); el.hidden = false; el.textContent = text; }
  try { const raw = localStorage.getItem(key); if (raw) state = B.validate(JSON.parse(raw)); }
  catch { warning('Não foi possível carregar os dados salvos. O conteúdo anterior não será sobrescrito automaticamente. Exporte ou recupere seu backup antes de registrar novos dados.'); }
  function save(next) {
    if (!document.querySelector('#storage-warning').hidden) throw Error('Armazenamento indisponível: recupere o backup antes de continuar.');
    localStorage.setItem(key, JSON.stringify(next)); state = next;
  }
  function act(fn) { try { fn(); } catch (e) { notify(e.message || 'Não foi possível salvar. Exporte seus dados e tente novamente.'); } }
  const titles = { command: ['SEU SEGUNDO CÉREBRO, COM UM TIME','Menos no meio de tudo.<br><em>Mais na direção.</em>'], memory: ['BRAIN TWO','Contexto que permanece.'], team: ['SEU TIME PESSOAL','Cada agente, um papel.'], tasks: ['PEDIDOS E ENTREGAS','Do pedido à conclusão.'], connections: ['FERRAMENTAS E MODELOS','Um lugar para conectar tudo.'], history: ['HISTÓRICO','Os passos ficam registrados.'] };
  function empty(text) { return '<p class="empty">' + esc(text) + '</p>'; }
  function tasks(items) {
    return items.length ? items.map(t => `<article class="task"><small>${esc(B.agents.find(a=>a.id===t.agent).name)} → Martha · ${esc(t.project || 'Sem projeto')} · ${date(t.createdAt)}</small><p>${esc(t.text)}</p><label>Andamento manual<select data-task="${esc(t.id)}"><option value="queued" ${t.status==='queued'?'selected':''}>Na fila</option><option value="review" ${t.status==='review'?'selected':''}>Em revisão</option><option value="done" ${t.status==='done'?'selected':''}>Concluído manualmente</option></select></label></article>`).join('') : empty('Nenhum pedido por aqui. Capture sua primeira demanda na central.');
  }
  function options() { return B.agents.map(a=>`<option value="${a.id}">${a.name} — ${a.role}</option>`).join(''); }
  function render() {
    const [eye, title] = titles[current];
    let html = `<span class="eyebrow">${eye}</span><h1>${title}</h1>`;
    if (current === 'command') html += `<p class="intro">Capture uma ideia, organize o contexto e escolha quem cuida do próximo passo.</p><div class="banner">Versão local de organização. Os agentes ainda não executam tarefas nem acessam suas contas. A memória fica salva somente neste navegador; use a exportação para guardar um backup.</div><div class="grid"><div class="metric"><small>Demandas em aberto</small><strong>${state.tasks.filter(t=>t.status!=='done').length}</strong><span>Registradas por você</span></div><div class="metric"><small>Memórias capturadas</small><strong>${state.memories.length}</strong><span>Contexto pesquisável</span></div><div class="metric"><small>Conexões ativas</small><strong>0</strong><span>Autenticação pendente</span></div></div><form id="capture" class="composer"><h2>O que vamos tirar da sua cabeça?</h2><label>Seu pedido<textarea name="text" maxlength="12000" required placeholder="Martha, organize os próximos passos do meu projeto…"></textarea></label><div class="form-grid"><label>Responsável<select name="agent">${options()}</select></label><label>Projeto<input name="project" maxlength="160" placeholder="Ex.: SMEZI"></label></div><button class="primary">Registrar pedido →</button></form><div class="split"><section><h2>Próximos passos</h2>${tasks(state.tasks.filter(t=>t.status!=='done').slice(0,4))}</section><section class="card"><span class="eyebrow">COMO O TIME VAI TRABALHAR</span><h3>Você fala com Martha.</h3><p>Ela consulta a memória, distribui as demandas e reúne as entregas. Pepper, Sugar, Olive, Basil e X Growing cuidam das suas especialidades.</p><p>Execução por IA, sincronização e rotinas automáticas dependem da próxima etapa de servidor e conexões.</p><button class="secondary" data-go="team">Conhecer meu time ↗</button></section></div>`;
    if (current === 'team') html += `<p class="intro">Martha coordena os especialistas e consolida o que precisa da sua atenção. Os perfis abaixo definem a organização; execução por IA ainda não está ativa.</p><div class="grid">${B.agents.map(a=>`<article class="card"><div class="agent-icon">${a.name[0]}</div><h3>${a.name}</h3><small>${a.role}</small><p>${a.summary}</p><span class="tag">${a.id==='martha'?'Reporta a Caroline':'Reporta a Martha'}</span><p class="tools">${esc(a.tools.join(' · ') || 'Coordenação do time')}</p><button class="secondary" data-agent="${a.id}">Registrar pedido</button></article>`).join('')}</div>`;
    if (current === 'tasks') html += `<div class="banner">Atualizações manuais de andamento. Marcar como concluído registra sua decisão; não executa ações externas.</div><label>Filtrar andamento<select id="task-filter"><option value="">Todos</option><option value="queued">Na fila</option><option value="review">Em revisão</option><option value="done">Concluídos</option></select></label><div id="task-list">${tasks(state.tasks)}</div>`;
    if (current === 'memory') {
      const projects = [...new Set(state.memories.map(m=>m.project).filter(Boolean))];
      html += `<p class="intro">Decisões, pessoas, aprendizados e referências com fonte e projeto. O contexto pode ser pesquisado e exportado para acompanhar você.</p><form id="memory" class="composer"><h2>Guardar contexto</h2><label>O que precisamos lembrar?<textarea name="text" required maxlength="12000"></textarea></label><div class="form-grid"><label>Tipo<select name="kind"><option value="decision">Decisão</option><option value="person">Pessoa</option><option value="learning">Aprendizado</option><option value="reference">Referência</option></select></label><label>Projeto<input name="project" maxlength="160"></label></div><label>Fonte / referência<input name="source" maxlength="500" placeholder="Ex.: reunião de hoje, documento ou URL"></label><button class="primary">Guardar memória +</button></form><div class="toolbar"><label>Pesquisar<input id="search" type="search" placeholder="Uma pessoa, decisão ou assunto…" value="${esc(query)}"></label><label>Projeto<select id="project-filter"><option value="">Todos os projetos</option>${projects.map(p=>`<option ${filter===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label></div><h2>Contextos por projeto</h2><div class="relations">${projects.map(p=>`<div class="relation">${esc(p)} → ${state.memories.filter(m=>m.project===p).length} memórias</div>`).join('') || empty('Ao vincular memórias a projetos, as relações aparecerão aqui.')}</div><div id="memories"></div>`;
    }
    if (current === 'connections') html += `<p class="intro">Modelos de IA e ferramentas ficam organizados nesta central. Cada serviço terá sua própria autorização e permissões por agente.</p><div class="banner">Nenhuma conta conectada nesta versão. As conexões do ChatGPT não são transferidas para este site. Chaves de API e tokens deverão ser mantidos no servidor, nunca nesta tela ou no navegador.</div><section class="card">${B.integrations.map(x=>`<div class="integration"><span>${esc(x)}</span><span>Aguardando integração</span></div>`).join('')}</section>`;
    if (current === 'history') html += `<p class="intro">Últimos registros de captura, mantidos neste navegador.</p><section class="card">${state.events.map(e=>`<div class="task"><small>${date(e.createdAt)}</small><p>${esc(e.text)}</p></div>`).join('') || empty('Seu histórico começa com o primeiro pedido.')}</section><div class="banner">Backup local: exporte seus dados para transferir para outro dispositivo. Importar substitui o conteúdo atual depois da sua confirmação.</div><button class="secondary" id="export-mobile">Exportar backup ↓</button><label>Importar backup JSON<input type="file" id="import-mobile" accept="application/json,.json"></label>`;
    view.innerHTML = html;
    document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===current));
    bind();
  }
  function renderMemories() { document.querySelector('#memories').innerHTML = B.search(state,query,filter).map(m=>`<article class="task"><small>${esc({decision:'Decisão',person:'Pessoa',learning:'Aprendizado',reference:'Referência'}[m.kind])} · ${esc(m.project || 'Sem projeto')} · ${date(m.createdAt)}</small><p class="memory-text">${esc(m.text)}</p><small>Fonte: ${esc(m.source || 'Registro manual')}</small></article>`).join('') || empty('Nenhuma memória encontrada.'); }
  function bind() {
    view.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{current=b.dataset.go;render();});
    view.querySelectorAll('[data-agent]').forEach(b=>b.onclick=()=>{current='command';render();view.querySelector('[name=agent]').value=b.dataset.agent;view.querySelector('textarea').focus();});
    view.querySelectorAll('[data-task]').forEach(s=>s.onchange=()=>act(()=>{save(B.updateTask(state,s.dataset.task,s.value));notify('Andamento atualizado manualmente.');render();}));
    const capture = view.querySelector('#capture');
    if(capture) capture.onsubmit=e=>{e.preventDefault();act(()=>{const f=new FormData(capture);save(B.capture(state,f.get('text'),f.get('agent'),f.get('project')));render();notify('Pedido registrado na fila. A execução por IA ainda não está ativa.');});};
    const memory=view.querySelector('#memory');
    if(memory) { memory.onsubmit=e=>{e.preventDefault();act(()=>{const f=new FormData(memory);save(B.addMemory(state,f.get('text'),f.get('kind'),f.get('project'),f.get('source')));render();notify('Memória salva neste navegador.');});};view.querySelector('#search').oninput=e=>{query=e.target.value;renderMemories();};view.querySelector('#project-filter').onchange=e=>{filter=e.target.value;renderMemories();};renderMemories(); }
    const tf=view.querySelector('#task-filter');if(tf) tf.onchange=()=>{document.querySelector('#task-list').innerHTML=tasks(state.tasks.filter(t=>!tf.value||t.status===tf.value));document.querySelectorAll('[data-task]').forEach(s=>s.onchange=()=>act(()=>{save(B.updateTask(state,s.dataset.task,s.value));notify('Andamento atualizado.');tf.onchange();}));};
    const ex=view.querySelector('#export-mobile');if(ex) ex.onclick=exportData;
    const im=view.querySelector('#import-mobile');if(im) im.onchange=importData;
  }
  function exportData() { act(()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='twobrain-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Backup exportado.');}); }
  async function importData(e) {
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>5*1024*1024)throw Error('Importe um JSON de até 5 MB.');const next=B.validate(JSON.parse(await file.text()));if(!confirm(`Substituir os dados atuais por ${next.tasks.length} pedidos e ${next.memories.length} memórias? Exporte um backup antes de continuar.`))return;localStorage.setItem(key,JSON.stringify(next));state=next;document.querySelector('#storage-warning').hidden=true;render();notify('Backup importado.');}catch(err){notify(err.message||'Não foi possível importar.');}finally{e.target.value='';}
  }
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{current=b.dataset.view;notify('');render();});
  document.querySelector('#export').onclick=exportData;document.querySelector('#import').onchange=importData;
  render();
})();
