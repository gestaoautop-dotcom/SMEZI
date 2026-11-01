(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ContentEngine = api;
})(globalThis, function() {
  const collections = ['memories', 'ideas', 'posts'];
  function validate(db) {
    if (!db || typeof db !== 'object') throw Error('Banco inválido.');
    for (const key of collections) {
      if (!Array.isArray(db[key])) throw Error('Coleção inválida: ' + key);
      const ids = new Set();
      for (const item of db[key]) {
        if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.text !== 'string') throw Error('Registro inválido em ' + key);
        if (key === 'posts' && (!['X','LinkedIn','Instagram','Threads'].includes(item.platform) || !['pt','en'].includes(item.lang))) throw Error('Publicação inválida.');
        if (key === 'memories' && typeof item.title !== 'string') throw Error('Memória sem título.');
        ids.add(item.id);
      }
    }
    return db;
  }
  // Validate the entire backup before any state changes. ID conflicts never overwrite local records.
  function merge(current, incoming) {
    validate(current); validate(incoming);
    const result = JSON.parse(JSON.stringify(current));
    for (const key of collections) {
      const ids = new Set(result[key].map(x => x.id));
      for (const item of incoming[key]) if (!ids.has(item.id)) {
        result[key].push(JSON.parse(JSON.stringify(item))); ids.add(item.id);
      }
    }
    return result;
  }
  function revision(previous, values, id, at) {
    return { ...values, id, at, parentId: previous?.id || null, rootId: previous?.rootId || previous?.id || id, revision: (previous?.revision || (previous ? 1 : 0)) + 1 };
  }
  return {validate, merge, revision};
});
