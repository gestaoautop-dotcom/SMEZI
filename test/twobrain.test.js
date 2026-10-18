const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../twobrain/core.js');
test('capture keeps selected responsibility, queues without execution and round-trips backup',()=>{
 const original=B.empty();const s=B.capture(original,'Preparar relatório','olive','SMEZI');
 assert.equal(original.tasks.length,0);assert.equal(s.tasks[0].agent,'olive');assert.equal(s.tasks[0].status,'queued');assert.equal(s.events.length,1);assert.deepEqual(B.validate(JSON.parse(JSON.stringify(s))),s);
 assert.throws(()=>B.capture(s,'','martha',''));assert.throws(()=>B.capture(s,'Pedido','unknown',''));
});
test('memory search includes source and project and respects project boundaries',()=>{
 let s=B.addMemory(B.empty(),'Identidade limpa','decision','Marca A','Reunião');s=B.addMemory(s,'Identidade ousada','reference','Marca B','Documento');
 assert.equal(B.search(s,'identidade','Marca A').length,1);assert.equal(B.search(s,'reunião').length,1);assert.equal(B.search(s,'MARCA B').length,1);
});
test('manual completion updates only the selected request',()=>{
 let s=B.capture(B.empty(),'Primeiro','martha','');s=B.capture(s,'Segundo','basil','');const next=B.updateTask(s,s.tasks[0].id,'done');assert.equal(next.tasks[0].status,'done');assert.equal(next.tasks[1].status,'queued');assert.equal(s.tasks[0].status,'queued');assert.throws(()=>B.updateTask(s,'missing','done'));assert.throws(()=>B.updateTask(s,s.tasks[0].id,'running'));
});
test('backup rejects malformed records, duplicates and invalid dates; strips unknown fields',()=>{
 const s=B.capture(B.empty(),'Teste','pepper','');assert.throws(()=>B.validate({version:1,tasks:[]}));assert.throws(()=>B.validate({...s,tasks:[{...s.tasks[0],agent:'bad'}]}));assert.throws(()=>B.validate({...s,tasks:[s.tasks[0],s.tasks[0]]}));assert.throws(()=>B.validate({...s,tasks:[{...s.tasks[0],createdAt:'bad'}]}));assert.equal(B.validate({...s,token:'secret'}).token,undefined);
});
