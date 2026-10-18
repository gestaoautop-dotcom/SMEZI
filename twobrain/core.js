(function (root) {
  'use strict';
  const agents = [
    { id: 'martha', name: 'Martha', role: 'Chief of Staff', summary: 'Prioridades, organização e acompanhamento.', tools: [] },
    { id: 'pepper', name: 'Pepper', role: 'Inbox Manager', summary: 'Triagem de e-mails e rascunhos na sua voz.', tools: ['Gmail'] },
    { id: 'sugar', name: 'Sugar', role: 'Partnerships & Calendar', summary: 'Parcerias, compromissos e agenda.', tools: ['Google Calendar', 'Google Contacts'] },
    { id: 'olive', name: 'Olive', role: 'Business Operations', summary: 'Relatórios, indicadores e acompanhamento.', tools: ['Google Drive', 'GitHub'] },
    { id: 'basil', name: 'Basil', role: 'Personal Brand / Creative', summary: 'Ideias, conteúdo e direção criativa.', tools: ['Canva'] },
    { id: 'x-growing', name: 'X Growing', role: 'Crescimento no X', summary: 'Pautas, análise editorial e crescimento.', tools: ['X'] }
  ];
  const integrations = ['OpenAI', 'Grok / xAI', 'Claude', 'Gemini', 'Gmail', 'Google Calendar', 'Google Contacts', 'Google Drive', 'Canva', 'GitHub', 'X'];
  function empty() { return { version: 1, tasks: [], memories: [], events: [] }; }
  function id() { return globalThis.crypto.randomUUID(); }
  function capture(state, text, agent, project, now = new Date().toISOString()) {
    if (!text.trim() || text.length > 12000) throw Error('Escreva um pedido de até 12.000 caracteres.');
    if (!agents.some(a => a.id === agent)) throw Error('Escolha um agente válido.');
    const task = { id: id(), text: text.trim(), agent, project: project.trim(), status: 'queued', createdAt: now };
    return { ...state, tasks: [task, ...state.tasks], events: [{ id: id(), text: 'Pedido registrado para ' + agents.find(a => a.id === agent).name, createdAt: now }, ...state.events].slice(0, 100) };
  }
  function addMemory(state, text, kind, project, source, now = new Date().toISOString()) {
    if (!text.trim() || text.length > 12000) throw Error('Escreva uma memória de até 12.000 caracteres.');
    if (!['decision', 'person', 'learning', 'reference'].includes(kind)) throw Error('Tipo de memória inválido.');
    return { ...state, memories: [{ id: id(), text: text.trim(), kind, project: project.trim(), source: source.trim(), createdAt: now }, ...state.memories] };
  }
  function search(state, query, project = '') {
    const q = query.toLocaleLowerCase('pt-BR');
    return state.memories.filter(m => (!project || m.project === project) && [m.text, m.source, m.project].join(' ').toLocaleLowerCase('pt-BR').includes(q));
  }
  function updateTask(state, taskId, status) {
    if (!['queued', 'review', 'done'].includes(status)) throw Error('Status inválido.');
    if (!state.tasks.some(t => t.id === taskId)) throw Error('Pedido não encontrado.');
    return { ...state, tasks: state.tasks.map(t => t.id === taskId ? { ...t, status } : t) };
  }
  function validate(raw) {
    if (!raw || raw.version !== 1 || !Array.isArray(raw.tasks) || !Array.isArray(raw.memories) || !Array.isArray(raw.events)) throw Error('Arquivo TwoBrain inválido.');
    for (const list of [raw.tasks, raw.memories, raw.events]) {
      if (list.length > 10000 || new Set(list.map(x => x.id)).size !== list.length) throw Error('Arquivo muito grande ou com identificadores repetidos.');
      for (const x of list) if (!x || typeof x.id !== 'string' || typeof x.text !== 'string' || x.text.length > 12000 || typeof x.createdAt !== 'string' || !Number.isFinite(Date.parse(x.createdAt))) throw Error('Registro inválido.');
    }
    for (const t of raw.tasks) if (!agents.some(a => a.id === t.agent) || typeof t.project !== 'string' || !['queued', 'review', 'done'].includes(t.status)) throw Error('Pedido inválido.');
    for (const m of raw.memories) if (typeof m.project !== 'string' || typeof m.source !== 'string' || !['decision', 'person', 'learning', 'reference'].includes(m.kind)) throw Error('Memória inválida.');
    return { version: 1, tasks: raw.tasks.map(({id,text,agent,project,status,createdAt}) => ({id,text,agent,project,status,createdAt})), memories: raw.memories.map(({id,text,kind,project,source,createdAt}) => ({id,text,kind,project,source,createdAt})), events: raw.events.map(({id,text,createdAt})=>({id,text,createdAt})) };
  }
  const api = { agents, integrations, empty, capture, addMemory, search, updateTask, validate };
  if (typeof module !== 'undefined') module.exports = api;
  else root.TwoBrain = api;
})(typeof window === 'undefined' ? globalThis : window);
