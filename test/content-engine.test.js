const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../engine/core');
const empty = () => ({memories:[],ideas:[],posts:[]});
test('invalid backup is rejected atomically; ID collisions preserve local records', () => {
  const db=empty(); db.ideas.push({id:'a',text:'Original'});
  const invalid=empty(); invalid.ideas.push({id:'b',text:'Valid'}); invalid.posts.push({id:'bad',text:42});
  assert.throws(()=>core.merge(db,invalid)); assert.equal(db.ideas.length,1);
  const incoming=empty(); incoming.ideas.push({id:'a',text:'Replacement'}, {id:'b',text:'New'});
  const result=core.merge(db,incoming);
  assert.deepEqual(result.ideas.map(x=>x.text),['Original','New']); assert.equal(db.ideas.length,1);
});
test('corrections link revisions without mutating or approving the original', () => {
  const original=core.revision(null,{text:'Original',status:'draft'},'a','2026-10-31');
  const approved=core.revision(original,{text:'Original',status:'approved'},'b','2026-11-01');
  const edited=core.revision(approved,{text:'Correction',status:'draft'},'c','2026-11-02');
  assert.equal(edited.rootId,'a'); assert.equal(edited.parentId,'b'); assert.equal(edited.revision,3);
  assert.equal(original.status,'draft'); assert.equal(edited.status,'draft');
});
test('app saves author sources, revisions, memory corrections and backups', () => {
  const elements=new Map(), storage=new Map(); let handlers={};
  const element=id=> { if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',dataset:{},classList:{remove(){},toggle(){}},setAttribute(){},append(){}});return elements.get(id)};
  const document={getElementById:element,querySelectorAll:selector=>handlers[selector]||[],createElementNS:()=>element(Math.random())};
  const context={document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},ContentEngine:core,crypto:require('node:crypto').webcrypto,Date,JSON,navigator:{},setTimeout};
  vm.runInNewContext(fs.readFileSync(require.resolve('../engine/app.js'),'utf8'),context);
  const click=id=>element(id).onclick(); const read=()=>JSON.parse(storage.get('smezi-content-engine-caroline-v1'));
  element('idea').value='Minha criação';click('saveIdea');
  element('platform').value='LinkedIn';element('lang').value='pt';click('compose');click('saveDraft');
  assert.match(read().posts[0].text,/Minha criação/); assert.equal(read().ideas[0].text,'Minha criação');
  const postId=read().posts[0].id;
  handlers['[data-edit]']=[{dataset:{edit:postId}}];click('saveIdea');handlers['[data-edit]'][0].onclick();
  element('draft').value='Revisão pessoal';click('saveDraft');assert.equal(read().posts[1].parentId,postId);
  handlers['[data-approve]']=[{dataset:{approve:read().posts[1].id}}];click('saveIdea');handlers['[data-approve]'][0].onclick();
  assert.equal(read().posts[2].status,'approved');assert.equal(read().posts[1].status,'draft');
  element('memoTitle').value='Voz';element('memoText').value='Humana';element('memoKind').value='preferencia';click('saveMemo');
  const memo=read().memories.at(-1);handlers['[data-correct]']=[{dataset:{correct:memo.id}}];click('saveIdea');handlers['[data-correct]'][0].onclick();
  element('memoText').value='Humana e objetiva';click('saveMemo');assert.equal(read().memories.at(-1).parentId,memo.id);
  assert.ok(storage.has('smezi-content-engine-caroline-v1-backup'));
});
test('Pages artifact isolates the engine and excludes Git, tests and credentials', () => {
  const path=require('node:path');const root=path.resolve(__dirname,'..');
  require('../scripts/build-content-engine');
  assert.equal(fs.readFileSync(path.join(root,'dist/studio/index.html'),'utf8'),fs.readFileSync(path.join(root,'index.html'),'utf8'));
  assert.match(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),/Content Engine/);
  for(const name of ['.git','.env','.github','test','package.json'])assert.equal(fs.existsSync(path.join(root,'dist',name)),false);
  assert.ok(fs.existsSync(path.join(root,'dist/engine/core.js')));
});
