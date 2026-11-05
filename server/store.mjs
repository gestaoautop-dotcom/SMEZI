import {fail,hash,random} from './security.mjs';
export const now=()=>new Date().toISOString();
export function database(env){if(!env.DB)fail(503,'Conecte o banco D1 DB e aplique a migração.');return env.DB;}
export const statement=(env,sql,...args)=>database(env).prepare(sql).bind(...args);
export async function audit(env,owner,action,id=''){await statement(env,'INSERT INTO audit(owner,action,record_id,at) VALUES(?,?,?,?)',owner,action,id,now()).run()}
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=200;
export function validateData(data){
 if(!data||typeof data!=='object')fail(400,'Dados inválidos.');let count=0;
 for(const kind of ['memories','ideas','posts']){
  if(!Array.isArray(data[kind]))fail(400,'Coleção ausente: '+kind);const ids=new Set();
  for(const item of data[kind]){
   if(!item||!validId(item.id)||ids.has(item.id)||typeof item.text!=='string'||item.text.length>50000)fail(400,'Registro inválido em '+kind);
   ids.add(item.id);count++;
   if(canonical(item).length>70000)fail(413,'Registro muito extenso.');
   if(item.rootId!==undefined&&!validId(item.rootId))fail(400,'Raiz inválida.');
   if(kind==='memories'&&typeof item.title!=='string')fail(400,'Memória sem título.');
   if(kind==='posts'&&(!['X','LinkedIn','Instagram','Threads'].includes(item.platform)||!['pt','en'].includes(item.lang)))fail(400,'Rede ou idioma inválido.');
  }
 }
 if(count>1000)fail(413,'Sincronize no máximo 1.000 registros por envio.');return data;
}
export async function snapshot(env,owner){
 const {results}=await statement(env,'SELECT collection,payload FROM records WHERE owner=? ORDER BY seq LIMIT 5001',owner).all();
 if(results.length>5000)fail(413,'A coleção excede o limite desta versão. Exporte pelo banco antes de continuar.');
 const data={version:2,memories:[],ideas:[],posts:[]};for(const row of results)data[row.collection].push(JSON.parse(row.payload));return data;
}
export async function sync(env,owner,data){
 validateData(data);const queries=[];
 const existing=(await statement(env,'SELECT collection,id,digest FROM records WHERE owner=?',owner).all()).results;
 const found=new Map(existing.map(x=>[x.collection+'\0'+x.id,x]));
 let inserted=0;
 for(const kind of ['memories','ideas','posts'])for(const item of data[kind]){
  const payload=canonical(item),digest=await hash(payload);
  const previous=found.get(kind+'\0'+item.id);
  if(previous){if(previous.digest!==digest)fail(409,'Conflito de versão: '+item.id+'. Crie uma nova versão, sem sobrescrever.');continue}
  inserted++;queries.push(statement(env,'INSERT INTO records(owner,collection,id,root_id,payload,digest,created_at) VALUES(?,?,?,?,?,?,?)',owner,kind,item.id,item.rootId||item.id,payload,digest,now()));
  // Pending jobs are invalidated by a new revision of the same post, before the next claim.
  if(kind==='posts')queries.push(statement(env,"UPDATE jobs SET status='cancelled',error='Conteúdo revisado; nova aprovação necessária.',updated_at=? WHERE owner=? AND root_id=? AND status='pending'",now(),owner,item.rootId||item.id));
 }
 if(queries.length)await database(env).batch(queries);
 let backup=false;if(queries.length&&env.BACKUPS){try{await createBackup(env,owner);backup=true}catch{/* D1 commit remains durable; report backup failure without discarding data. */}}
 return {inserted,backup,backupWarning:queries.length&&!backup?'Backup R2 não concluído. Seus registros estão preservados no D1.':null,data:await snapshot(env,owner)};
}
export async function createBackup(env,owner){
 if(!env.BACKUPS)fail(503,'Conecte o bucket R2 BACKUPS.');
 const clients=(await statement(env,'SELECT * FROM clients WHERE owner=? ORDER BY created_at',owner).all()).results;
 const payload={app:'smezi-content-engine',exportedAt:now(),data:await snapshot(env,owner),clients};
 const key=`backups/${owner}/${now().replaceAll(':','-')}-${random()}.json`;
 await env.BACKUPS.put(key,JSON.stringify(payload),{httpMetadata:{contentType:'application/json'}});return key;
}
export async function approve(env,owner,recordId){
 const record=await statement(env,"SELECT * FROM records WHERE owner=? AND collection='posts' AND id=?",owner,recordId).first();if(!record)fail(404,'Publicação não encontrada.');
 const latest=await statement(env,"SELECT id FROM records WHERE owner=? AND collection='posts' AND root_id=? ORDER BY seq DESC LIMIT 1",owner,record.root_id).first();
 if(latest.id!==recordId)fail(409,'Aprove a versão mais recente.');
 await statement(env,'INSERT INTO approvals(owner,record_id,digest,approved_at) VALUES(?,?,?,?) ON CONFLICT(owner,record_id) DO UPDATE SET digest=excluded.digest,approved_at=excluded.approved_at',owner,recordId,record.digest,now()).run();
 await audit(env,owner,'approve',recordId);return {ok:true,digest:record.digest};
}
export async function quota(env,owner,kind,limit){
 const bucket=new Date().toISOString().slice(0,10);
 const row=await statement(env,'INSERT INTO usage_limits(owner,kind,bucket,count) VALUES(?,?,?,1) ON CONFLICT(owner,kind,bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count',owner,kind,bucket,limit).first();
 if(!row)fail(429,'Limite diário atingido. Tente amanhã.');
}
export async function saveClient(env,owner,value){
 if(typeof value.name!=='string'||!value.name.trim()||value.name.length>200)fail(400,'Informe o nome (até 200 caracteres).');
 if(!['novo','conversa','proposta','cliente','encerrado'].includes(value.stage))fail(400,'Etapa inválida.');
 for(const key of ['email','sourcePostId','project','notes'])if(value[key]!==undefined&&(typeof value[key]!=='string'||value[key].length>(key==='notes'?5000:300)))fail(400,'Campo inválido: '+key);
 const id=value.id||random();if(!validId(id))fail(400,'ID inválido.');
 if(value.sourcePostId&&!await statement(env,"SELECT id FROM records WHERE owner=? AND collection='posts' AND id=?",owner,value.sourcePostId).first())fail(400,'A publicação de origem não existe.');
 const time=now();await database(env).batch([
  statement(env,'INSERT INTO clients(id,owner,name,email,stage,source_post_id,project,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET name=excluded.name,email=excluded.email,stage=excluded.stage,source_post_id=excluded.source_post_id,project=excluded.project,notes=excluded.notes,updated_at=excluded.updated_at',id,owner,value.name.trim(),value.email||'',value.stage,value.sourcePostId||'',value.project||'',value.notes||'',time,time),
  statement(env,'INSERT INTO client_history(owner,client_id,payload,created_at) VALUES(?,?,?,?)',owner,id,canonical(value),time)
 ]);return {id};
}
