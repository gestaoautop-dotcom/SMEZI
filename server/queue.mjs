import {fail,random} from './security.mjs';
import {statement,now,audit} from './store.mjs';
import {platformProvider,connection,prepareMedia,mediaReady,publish,providerConfig} from './social.mjs';
export function validatePost(post){
 const limits={X:280,LinkedIn:3000,Instagram:2200,Threads:500};
 if(!limits[post.platform]||typeof post.text!=='string'||!post.text.trim()||Array.from(post.text).length>limits[post.platform])fail(400,'Texto vazio ou acima do limite conservador da rede.');
 if(post.mediaURL){let u;try{u=new URL(post.mediaURL)}catch{fail(400,'URL de mídia inválida.')}if(u.protocol!=='https:'||u.username||u.password)fail(400,'A mídia precisa de URL HTTPS pública.');if(post.platform!=='Instagram')fail(400,'Anexos desta etapa são suportados apenas no Instagram.');}
 if(post.platform==='Instagram'&&!post.mediaURL)fail(400,'Instagram precisa de uma imagem JPEG em URL HTTPS pública nesta versão.');
}
export async function schedule(env,owner,input){
 if(env.PUBLISHING_ENABLED!=='true'||!env.CRON_SECRET?.length||env.SCHEDULER_ENABLED!=='true')fail(503,'Ative a publicação e configure o Worker de agendamento primeiro.');
 const scheduled=Date.parse(input.scheduledAt);if(!Number.isFinite(scheduled)||scheduled<Date.now()+60000)fail(400,'Agende com pelo menos um minuto de antecedência.');
 const heartbeat=await statement(env,"SELECT updated_at FROM scheduler_heartbeat WHERE id='scheduler'").first();if(!heartbeat||Date.parse(heartbeat.updated_at)<Date.now()-300000)fail(503,'O agendador não respondeu nos últimos cinco minutos. Verifique o Worker antes de agendar.');
 const record=await statement(env,"SELECT * FROM records WHERE owner=? AND collection='posts' AND id=?",owner,input.recordId).first();if(!record)fail(404,'Sincronize esta versão antes de agendar.');
 const post=JSON.parse(record.payload);validatePost(post);const provider=platformProvider[post.platform];providerConfig(env,provider);
 const account=await connection(env,owner,provider),time=now(),id=random();
 // INSERT SELECT closes the race with a concurrent revision/approval transaction.
 const row=await statement(env,`INSERT INTO jobs(id,owner,record_id,root_id,provider,account_id,snapshot,digest,scheduled_at,status,updated_at)
 SELECT ?,?,?,?,?,?,?,?,?, 'pending',? WHERE EXISTS (SELECT 1 FROM approvals WHERE owner=? AND record_id=? AND digest=?)
 AND ?=(SELECT id FROM records WHERE owner=? AND collection='posts' AND root_id=? ORDER BY seq DESC LIMIT 1)
 ON CONFLICT(owner,record_id) DO NOTHING RETURNING id`,id,owner,record.id,record.root_id,provider,account.accountId,record.payload,record.digest,new Date(scheduled).toISOString(),time,owner,record.id,record.digest,record.id,owner,record.root_id).first();
 if(!row)fail(409,'Aprove a versão mais recente. Esta versão também pode já estar na fila; não será duplicada.');
 await audit(env,owner,'schedule',id);return {id,status:'pending'};
}
export async function cancel(env,owner,id){const row=await statement(env,"UPDATE jobs SET status='cancelled',error='Cancelado pela autora.',updated_at=? WHERE owner=? AND id=? AND status='pending' RETURNING id",now(),owner,id).first();if(!row)fail(409,'Só é possível cancelar itens ainda pendentes.');await audit(env,owner,'cancel',id);return {ok:true}}
export async function tick(env){
 if(env.PUBLISHING_ENABLED!=='true')return {paused:true};
 // Never retry a delivery whose acknowledgement may have been lost.
 await statement(env,"UPDATE jobs SET status='uncertain',error='Execução interrompida. Confira a rede antes de tentar qualquer nova publicação.',updated_at=? WHERE status IN ('preparing','publishing') AND updated_at < ?",now(),new Date(Date.now()-300000).toISOString()).run();
 const due=(await statement(env,"SELECT id FROM jobs WHERE status='pending' AND scheduled_at <= ? ORDER BY scheduled_at LIMIT 5",now()).all()).results;
 let handled=0;
 for(const candidate of due){
  const job=await statement(env,"UPDATE jobs SET status='preparing',attempts=attempts+1,updated_at=? WHERE id=? AND status='pending' RETURNING *",now(),candidate.id).first();if(!job)continue;
  let delivering=false;
  try{
   const approved=await statement(env,'SELECT record_id FROM approvals WHERE owner=? AND record_id=? AND digest=?',job.owner,job.record_id,job.digest).first();
   const latest=await statement(env,"SELECT id FROM records WHERE owner=? AND collection='posts' AND root_id=? ORDER BY seq DESC LIMIT 1",job.owner,job.root_id).first();
   if(!approved||latest?.id!==job.record_id)fail(409,'A publicação foi revisada ou não está aprovada.');
   const account=await connection(env,job.owner,job.provider);if(account.accountId!==job.account_id)fail(409,'A conta conectada mudou. Revise o agendamento.');
   const post=JSON.parse(job.snapshot);validatePost(post);
   if(['threads','instagram'].includes(job.provider)){
    if(!job.container_id){job.container_id=await prepareMedia(env,job.provider,account,post.text,post.mediaURL);await statement(env,'UPDATE jobs SET container_id=?,updated_at=? WHERE id=?',job.container_id,now(),job.id).run()}
    if(!await mediaReady(env,job.provider,account,job.container_id)){
     if(job.attempts>=20)fail(422,'A mídia não ficou pronta. Confira a rede.');
     await statement(env,"UPDATE jobs SET status='pending',scheduled_at=?,updated_at=? WHERE id=?",new Date(Date.now()+60000).toISOString(),now(),job.id).run();continue;
    }
   }
   await statement(env,"UPDATE jobs SET status='publishing',updated_at=? WHERE id=?",now(),job.id).run();delivering=true;
   const remoteId=await publish(env,job.provider,account,post,job.container_id);
   if(!remoteId)throw Error('A rede não confirmou o identificador da publicação.');
   await statement(env,"UPDATE jobs SET status='published',remote_id=?,error=NULL,updated_at=? WHERE id=?",String(remoteId),now(),job.id).run();
  }catch(error){
   const retry=error.externalStatus===429&&job.attempts<6;
   const uncertain=delivering&&(error.uncertain||!error.externalStatus||error.externalStatus>=500);
   await statement(env,'UPDATE jobs SET status=?,error=?,scheduled_at=?,updated_at=? WHERE id=?',retry?'pending':uncertain?'uncertain':'failed',uncertain?'Entrega sem confirmação. Confira a rede; não haverá reenvio automático.':error.status?error.message:'Falha de execução. Confira os serviços conectados.',retry?new Date(Date.now()+Math.min(3600000,60000*2**job.attempts)).toISOString():job.scheduled_at,now(),job.id).run();
  }
  handled++;
 }
 return {handled};
}
