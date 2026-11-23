// Calendário editorial e postagem em lote.
// Um lote = uma peça (foto + legenda) para várias redes no mesmo horário.
// Cada rede vira um post versionado próprio, com aprovação e agendamento independentes,
// reaproveitando as garantias existentes: versão imutável, aprovação pelo digest exato,
// fila sem duplicidade e nenhum reenvio automático de entrega incerta.
import {fail,random} from './security.mjs';
import {statement,database,now,sync,approve,audit} from './store.mjs';
import {schedule,validatePost} from './queue.mjs';
import {mediaById} from './media.mjs';
import {PLATFORMS,MEDIA_PLATFORMS} from './platforms.mjs';

const str=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
function isoDate(value,label){
 const time=Date.parse(value);if(typeof value!=='string'||!Number.isFinite(time))fail(400,`Informe ${label} válida.`);
 return new Date(time).toISOString();
}
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(id);

export async function createBatch(env,owner,input){
 const caption=typeof input?.caption==='string'?input.caption.trim():'';
 const networks=Array.isArray(input?.networks)?[...new Set(input.networks)]:[];
 if(!networks.length||networks.some(n=>!PLATFORMS.includes(n)))fail(400,'Escolha ao menos uma rede válida.');
 const overrides=input?.overrides&&typeof input.overrides==='object'?input.overrides:{};
 const lang=input?.lang===undefined?'pt':input.lang;if(!['pt','en'].includes(lang))fail(400,'Idioma inválido.');
 const plannedAt=isoDate(input?.plannedAt,'a data e o horário');
 const media=input?.mediaId?await mediaById(env,owner,input.mediaId):null;
 const title=str(input?.title,200)||caption.split('\n')[0].slice(0,80)||'Post sem título';
 const batchId=random(),time=now();
 const posts=networks.map(platform=>{
  const text=typeof overrides[platform]==='string'&&overrides[platform].trim()?overrides[platform].trim():caption;
  const id=random();
  const post={id,rootId:id,text,platform,lang,status:'draft',at:time,revision:1,batchId,title,
   ...(media&&MEDIA_PLATFORMS.includes(platform)?{mediaId:media.id,mediaURL:media.publicURL}:{})};
  validatePost(post);return post;
 });
 await sync(env,owner,{memories:[],ideas:[],posts});
 await database(env).batch([
  statement(env,'INSERT INTO post_batches(owner,id,title,planned_at,media_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',owner,batchId,title,plannedAt,media?.id||null,time,time),
  ...posts.map(p=>statement(env,'INSERT INTO post_batch_items(owner,batch_id,platform,root_id,created_at) VALUES(?,?,?,?,?)',owner,batchId,p.platform,p.rootId,time))
 ]);
 await audit(env,owner,'batch_create',batchId);
 return batchDetail(env,owner,batchId);
}

async function batchRow(env,owner,id){
 if(!validId(id))fail(400,'Lote inválido.');
 const row=await statement(env,'SELECT * FROM post_batches WHERE owner=? AND id=?',owner,id).first();
 if(!row)fail(404,'Lote não encontrado.');return row;
}
async function latestRecord(env,owner,rootId){
 const row=await statement(env,"SELECT * FROM records WHERE owner=? AND collection='posts' AND root_id=? ORDER BY seq DESC LIMIT 1",owner,rootId).first();
 if(!row)fail(404,'Post do lote não encontrado.');return row;
}

// Monta lotes com o estado real de cada rede (versão vigente, aprovação e fila).
async function hydrate(env,owner,batches){
 if(!batches.length)return [];
 const ids=batches.map(b=>b.id);
 // D1 limita parâmetros por consulta: listas vão como um único JSON (json_each).
 const items=(await statement(env,'SELECT * FROM post_batch_items WHERE owner=? AND batch_id IN (SELECT value FROM json_each(?))',owner,JSON.stringify(ids)).all()).results;
 const roots=items.map(i=>i.root_id);
 if(!roots.length)return batches.map(b=>({...view(b),items:[]}));
 const rootList=JSON.stringify(roots);
 const records=(await statement(env,"SELECT id,root_id,payload,digest,seq FROM records WHERE owner=? AND collection='posts' AND root_id IN (SELECT value FROM json_each(?)) ORDER BY seq",owner,rootList).all()).results;
 const latest=new Map();for(const r of records)latest.set(r.root_id,r);
 const current=[...latest.values()].map(r=>r.id);
 const approvals=new Map(current.length?(await statement(env,'SELECT record_id,digest FROM approvals WHERE owner=? AND record_id IN (SELECT value FROM json_each(?))',owner,JSON.stringify(current)).all()).results.map(a=>[a.record_id,a.digest]):[]);
 const jobs=new Map();
 for(const j of (await statement(env,'SELECT id,root_id,record_id,status,scheduled_at,remote_id,error,updated_at FROM jobs WHERE owner=? AND root_id IN (SELECT value FROM json_each(?)) ORDER BY updated_at',owner,rootList).all()).results)jobs.set(j.root_id,j);
 return batches.map(b=>({...view(b),items:items.filter(i=>i.batch_id===b.id).sort((x,y)=>x.platform.localeCompare(y.platform)).map(i=>{
  const r=latest.get(i.root_id);const post=r?JSON.parse(r.payload):null;const job=jobs.get(i.root_id)||null;
  return {platform:i.platform,rootId:i.root_id,recordId:r?.id||null,text:post?.text||'',revision:post?.revision||1,
   hasMedia:!!post?.mediaURL,approved:!!r&&approvals.get(r.id)===r.digest,
   job:job?{id:job.id,status:job.status,scheduledAt:job.scheduled_at,remoteId:job.remote_id,error:job.error,forCurrentVersion:job.record_id===r?.id}:null};
 })}));
}
function view(b){return {id:b.id,title:b.title,plannedAt:b.planned_at,mediaId:b.media_id,previewURL:b.media_id?'/api/media/'+b.media_id:null,createdAt:b.created_at,updatedAt:b.updated_at}}

export async function batchDetail(env,owner,id){return (await hydrate(env,owner,[await batchRow(env,owner,id)]))[0]}

export async function calendar(env,owner,{from,to}){
 const start=isoDate(from,'o início do período'),end=isoDate(to,'o fim do período');
 if(Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>62*86400000)fail(400,'Consulte no máximo 62 dias por vez.');
 const batches=(await statement(env,'SELECT * FROM post_batches WHERE owner=? AND planned_at>=? AND planned_at<? ORDER BY planned_at LIMIT 300',owner,start,end).all()).results;
 return {from:start,to:end,batches:await hydrate(env,owner,batches)};
}

// Nova versão do texto de uma rede. A aprovação anterior deixa de valer e agendamentos pendentes são cancelados.
export async function reviseBatchItem(env,owner,batchId,input){
 await batchRow(env,owner,batchId);
 const item=await statement(env,'SELECT * FROM post_batch_items WHERE owner=? AND batch_id=? AND platform=?',owner,batchId,input?.platform).first();
 if(!item)fail(404,'Rede não faz parte deste lote.');
 const current=await latestRecord(env,owner,item.root_id),previous=JSON.parse(current.payload);
 const text=typeof input?.text==='string'?input.text.trim():'';
 if(text===previous.text)return batchDetail(env,owner,batchId);
 const post={...previous,id:random(),text,revision:(previous.revision||1)+1,parentId:current.id,at:now(),status:'draft'};
 validatePost(post);
 await sync(env,owner,{memories:[],ideas:[],posts:[post]});
 await audit(env,owner,'batch_revise',batchId);
 return batchDetail(env,owner,batchId);
}

export async function moveBatch(env,owner,batchId,input){
 await batchRow(env,owner,batchId);
 const plannedAt=isoDate(input?.plannedAt,'a nova data');
 const roots=(await statement(env,'SELECT root_id FROM post_batch_items WHERE owner=? AND batch_id=?',owner,batchId).all()).results.map(r=>r.root_id);
 const time=now();
 await database(env).batch([
  statement(env,'UPDATE post_batches SET planned_at=?,updated_at=? WHERE owner=? AND id=?',plannedAt,time,owner,batchId),
  // Mudar a data invalida o agendamento pendente: é preciso agendar de novo, conscientemente.
  ...roots.map(root=>statement(env,"UPDATE jobs SET status='cancelled',error='Data alterada no calendário; agende novamente.',updated_at=? WHERE owner=? AND root_id=? AND status='pending'",time,owner,root))
 ]);
 await audit(env,owner,'batch_move',batchId);
 return batchDetail(env,owner,batchId);
}

export async function approveBatch(env,owner,batchId,input={}){
 const detail=await batchDetail(env,owner,batchId);
 const only=Array.isArray(input.platforms)?new Set(input.platforms):null;
 const results=[];
 for(const item of detail.items){
  if(only&&!only.has(item.platform))continue;
  try{await approve(env,owner,item.recordId);results.push({platform:item.platform,ok:true})}
  catch(error){results.push({platform:item.platform,ok:false,error:error.status?error.message:'Falha ao aprovar.'})}
 }
 return {results,batch:await batchDetail(env,owner,batchId)};
}

// Agenda todas as redes aprovadas no horário do lote. Cada rede é independente:
// uma falha não cancela as outras, e o resultado informa rede por rede.
export async function scheduleBatch(env,owner,batchId,input={}){
 const detail=await batchDetail(env,owner,batchId);
 const only=Array.isArray(input.platforms)?new Set(input.platforms):null;
 const results=[];
 for(const item of detail.items){
  if(only&&!only.has(item.platform))continue;
  if(item.job&&['pending','preparing','publishing','published'].includes(item.job.status)&&item.job.forCurrentVersion){results.push({platform:item.platform,ok:true,jobId:item.job.id,already:true});continue}
  try{const job=await schedule(env,owner,{recordId:item.recordId,scheduledAt:detail.plannedAt});results.push({platform:item.platform,ok:true,jobId:job.id})}
  catch(error){results.push({platform:item.platform,ok:false,error:error.status?error.message:'Falha ao agendar.'})}
 }
 return {results,batch:await batchDetail(env,owner,batchId)};
}

export async function calendarRoute(env,owner,request,url,path,method,body){
 if(path==='/api/calendar'&&method==='GET')return calendar(env,owner,{from:url.searchParams.get('from'),to:url.searchParams.get('to')});
 if(path==='/api/batches'&&method==='POST')return createBatch(env,owner,await body(request,60000));
 const m=path.match(/^\/api\/batches\/([A-Za-z0-9-]{1,80})(?:\/(revise|move|approve|schedule))?$/);
 if(!m)return null;
 const [,id,action]=m;
 if(!action&&method==='GET')return batchDetail(env,owner,id);
 if(method!=='POST')return null;
 const input=await body(request,30000);
 if(action==='revise')return reviseBatchItem(env,owner,id,input);
 if(action==='move')return moveBatch(env,owner,id,input);
 if(action==='approve')return approveBatch(env,owner,id,input);
 if(action==='schedule')return scheduleBatch(env,owner,id,input);
 return null;
}
