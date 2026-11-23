// Automação de comentários e DMs por palavra-gatilho (Instagram e Facebook).
//
// Segurança por padrão:
// - Regras nascem DESATIVADAS e no modo "aprovacao" (nada sai sem um clique humano).
// - O modo "automatico" só envia com CONVERSATIONS_AUTO_REPLY_ENABLED=true (chave geral de emergência).
// - Cada evento da Meta é registrado uma única vez (id da Meta): nunca há resposta duplicada.
// - O envio é "reivindicado" por UPDATE condicional antes de chamar a Meta; nenhum reenvio automático.
// - Limite diário de envios automáticos e intervalo de 24 h por contato e regra.
// - Permissões são conferidas antes de cada envio; sem permissão, o evento fica registrado e nada é enviado.
import {fail,random,externalJSON,AppError} from './security.mjs';
import {statement,database,now,audit,quota,canonical} from './store.mjs';
import {connection,pageToken,requireScopes} from './social.mjs';
import {parseKeywords,findRule,renderReply,withinWindow} from './automation-core.mjs';

const CHANNELS=['instagram','facebook'],SOURCES=['comentario','dm'],MODES=['rascunho','aprovacao','automatico'],MATCH=['contem','exata'];
const str=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const SENDABLE=['recebido','sem_regra','rascunho','pendente','permissao_ausente','falhou'];

function ruleView(r){return {id:r.id,name:r.name,channel:r.channel,source:r.source,keywords:parseKeywords(r.keywords),matchMode:r.match_mode,publicReply:r.public_reply,privateReply:r.private_reply,mode:r.mode,active:!!r.active,priority:r.priority,createdAt:r.created_at,updatedAt:r.updated_at}}

export function validateRule(input){
 const name=str(input?.name,120);if(!name)fail(400,'Dê um nome à regra.');
 if(!CHANNELS.includes(input?.channel))fail(400,'Canal inválido (instagram ou facebook).');
 if(!SOURCES.includes(input?.source))fail(400,'Origem inválida (comentario ou dm).');
 const keywords=parseKeywords(input?.keywords);if(!keywords.length)fail(400,'Informe ao menos uma palavra-gatilho com 2 ou mais letras.');
 const matchMode=input?.matchMode===undefined?'contem':input.matchMode;if(!MATCH.includes(matchMode))fail(400,'Tipo de correspondência inválido.');
 const publicReply=str(input?.publicReply,1000),privateReply=str(input?.privateReply,1000);
 if(input?.source==='dm'&&publicReply)fail(400,'Em DMs só existe resposta privada.');
 if(!publicReply&&!privateReply)fail(400,'Escreva a resposta pública, a privada, ou ambas.');
 const mode=input?.mode===undefined?'aprovacao':input.mode;if(!MODES.includes(mode))fail(400,'Modo inválido.');
 const priority=input?.priority===undefined?100:Number(input.priority);if(!Number.isInteger(priority)||priority<1||priority>1000)fail(400,'Prioridade entre 1 e 1000.');
 return {name,channel:input.channel,source:input.source,keywords:keywords.join(', '),matchMode,publicReply,privateReply,mode,active:input?.active===true,priority};
}

export async function listRules(env,owner){
 return (await statement(env,'SELECT * FROM automation_rules WHERE owner=? ORDER BY priority,created_at',owner).all()).results.map(ruleView);
}
export async function saveRule(env,owner,input){
 const r=validateRule(input),time=now();
 if(input?.id!==undefined){
  const prev=await statement(env,'SELECT * FROM automation_rules WHERE owner=? AND id=?',owner,input.id).first();
  if(!prev)fail(404,'Regra não encontrada.');
  // A versão anterior é preservada antes da alteração.
  await database(env).batch([
   statement(env,'INSERT INTO automation_rule_versions(owner,rule_id,payload,created_at) VALUES(?,?,?,?)',owner,prev.id,canonical(ruleView(prev)),time),
   statement(env,'UPDATE automation_rules SET name=?,channel=?,source=?,keywords=?,match_mode=?,public_reply=?,private_reply=?,mode=?,active=?,priority=?,updated_at=? WHERE owner=? AND id=?',r.name,r.channel,r.source,r.keywords,r.matchMode,r.publicReply,r.privateReply,r.mode,r.active?1:0,r.priority,time,owner,prev.id)
  ]);
  await audit(env,owner,'automation_rule_update',prev.id);
  return ruleView(await statement(env,'SELECT * FROM automation_rules WHERE owner=? AND id=?',owner,prev.id).first());
 }
 const id=random();
 await statement(env,'INSERT INTO automation_rules(owner,id,name,channel,source,keywords,match_mode,public_reply,private_reply,mode,active,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',owner,id,r.name,r.channel,r.source,r.keywords,r.matchMode,r.publicReply,r.privateReply,r.mode,r.active?1:0,r.priority,time,time).run();
 await audit(env,owner,'automation_rule_create',id);
 return ruleView(await statement(env,'SELECT * FROM automation_rules WHERE owner=? AND id=?',owner,id).first());
}
export async function ruleHistory(env,owner,id){
 return (await statement(env,'SELECT payload,created_at FROM automation_rule_versions WHERE owner=? AND rule_id=? ORDER BY id DESC LIMIT 50',owner,id).all()).results.map(x=>({...JSON.parse(x.payload),replacedAt:x.created_at}));
}

function eventView(e){return {id:e.id,channel:e.channel,source:e.source,senderName:e.sender_name,text:e.text,receivedAt:e.received_at,ruleId:e.rule_id,status:e.status,publicReply:e.public_reply,privateReply:e.private_reply,publicReplyId:e.public_reply_id,privateReplyId:e.private_reply_id,error:e.error,decidedAt:e.decided_at,mediaId:e.media_id}}
const setStatus=(env,owner,id,status,extra={})=>statement(env,'UPDATE automation_events SET status=?,error=?,public_reply_id=COALESCE(?,public_reply_id),private_reply_id=COALESCE(?,private_reply_id),decided_at=COALESCE(?,decided_at),updated_at=? WHERE owner=? AND id=?',status,extra.error??null,extra.publicId??null,extra.privateId??null,extra.decided?now():null,now(),owner,id).run();

// Chamado pelo consumidor da fila para cada evento verificado do webhook.
export async function processEvent(env,owner,event){
 const time=now();
 const inserted=await statement(env,"INSERT INTO automation_events(owner,id,channel,source,account_id,sender_id,sender_name,media_id,text,received_at,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'recebido',?) ON CONFLICT(owner,id) DO NOTHING RETURNING id",owner,event.id,event.channel,event.source,event.accountId,event.senderId,event.senderName||'',event.mediaId||'',event.text,new Date(event.timestamp||Date.now()).toISOString(),time).first();
 if(!inserted){
  // Reentrega da Meta ou da fila: só continua se o processamento anterior foi interrompido.
  const prior=await statement(env,'SELECT status FROM automation_events WHERE owner=? AND id=?',owner,event.id).first();
  if(prior?.status!=='recebido')return {duplicate:true,status:prior?.status};
 }
 const rules=(await statement(env,'SELECT * FROM automation_rules WHERE owner=? AND active=1',owner).all()).results;
 const rule=findRule(rules,event);
 if(!rule){await setStatus(env,owner,event.id,'sem_regra');return {status:'sem_regra'}}
 const publicReply=event.source==='comentario'?renderReply(rule.public_reply,event):'';
 const privateReply=renderReply(rule.private_reply,event);
 await statement(env,'UPDATE automation_events SET rule_id=?,public_reply=?,private_reply=?,updated_at=? WHERE owner=? AND id=?',rule.id,publicReply,privateReply,now(),owner,event.id).run();
 if(rule.mode==='rascunho'){await setStatus(env,owner,event.id,'rascunho');return {status:'rascunho',ruleId:rule.id}}
 if(rule.mode==='aprovacao'){await setStatus(env,owner,event.id,'pendente');return {status:'pendente',ruleId:rule.id}}
 // Modo automático: três travas antes de qualquer envio.
 if(env.CONVERSATIONS_AUTO_REPLY_ENABLED!=='true'){await setStatus(env,owner,event.id,'pendente',{error:'Envio automático desligado na configuração geral. Aguardando aprovação.'});return {status:'pendente',ruleId:rule.id}}
 const recent=await statement(env,"SELECT id FROM automation_events WHERE owner=? AND sender_id=? AND rule_id=? AND id<>? AND status IN ('enviando','enviado','parcial','incerto') AND received_at>? LIMIT 1",owner,event.senderId,rule.id,event.id,new Date(Date.now()-24*3600000).toISOString()).first();
 if(recent){await setStatus(env,owner,event.id,'ignorado',{error:'Este contato já recebeu esta resposta nas últimas 24 horas.'});return {status:'ignorado',ruleId:rule.id}}
 try{await quota(env,owner,'automation-auto',Number(env.AUTOMATION_DAILY_LIMIT||100))}
 catch{await setStatus(env,owner,event.id,'pendente',{error:'Limite diário de respostas automáticas atingido. Aguardando aprovação.'});return {status:'pendente',ruleId:rule.id}}
 return sendEvent(env,owner,event.id,{});
}

async function metaPost(env,path,token,payload){
 return externalJSON('https://graph.facebook.com/'+env.META_API_VERSION+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
// Conta conectada que corresponde exatamente à conta que recebeu o evento.
async function accountsFor(env,owner,row){
 if(!/^v\d+\.\d+$/.test(env.META_API_VERSION||''))fail(503,'Configure META_API_VERSION.');
 const main=await connection(env,owner,row.channel);
 if(String(main.accountId)!==String(row.account_id))throw new AppError(409,'BLOQUEADO: o evento é de uma conta diferente da conectada.');
 const page=row.channel==='facebook'?main:await connection(env,owner,'facebook').catch(()=>null);
 return {main,page};
}

// Envia a resposta pública e/ou privada de um evento. Usado pela aprovação humana e pelo modo automático.
export async function sendEvent(env,owner,id,input){
 const row=await statement(env,'SELECT * FROM automation_events WHERE owner=? AND id=?',owner,id).first();
 if(!row)fail(404,'Evento não encontrado.');
 const publicReply=input.publicReply===undefined?row.public_reply:str(input.publicReply,1000);
 const privateReply=input.privateReply===undefined?row.private_reply:str(input.privateReply,1000);
 if(row.source==='dm'&&publicReply)fail(400,'Em DMs só existe resposta privada.');
 if(!publicReply&&!privateReply)fail(400,'Não há resposta para enviar.');
 if(!withinWindow(row)){await setStatus(env,owner,id,'fora_do_prazo',{decided:true,error:row.source==='dm'?'A Meta só permite responder DMs em até 24 horas.':'A Meta só permite resposta privada a comentários em até 7 dias.'});fail(409,'Fora do prazo permitido pela Meta.')}
 // Reivindicação atômica: impede envio duplo por clique repetido ou processamento concorrente.
 const claimed=await statement(env,`UPDATE automation_events SET status='enviando',public_reply=?,private_reply=?,updated_at=? WHERE owner=? AND id=? AND status IN (${SENDABLE.map(()=>'?').join(',')}) RETURNING id`,publicReply,privateReply,now(),owner,id,...SENDABLE).first();
 if(!claimed)fail(409,'Este evento já foi enviado, está em envio ou foi descartado.');
 let accounts;
 try{accounts=await accountsFor(env,owner,row)}
 catch(error){
  const blocked=String(error.message||'').startsWith('BLOQUEADO');
  await setStatus(env,owner,id,blocked?'bloqueado':'permissao_ausente',{decided:true,error:blocked?'Evento de outra conta.':error.status?error.message:'Conexão indisponível.'});
  return {status:blocked?'bloqueado':'permissao_ausente'};
 }
 const {main,page}=accounts;
 // Confere permissões de tudo o que será enviado ANTES de enviar qualquer parte.
 try{
  if(publicReply)requireScopes(main,row.channel==='instagram'?['instagram_basic','instagram_manage_comments']:['pages_manage_engagement'],'responder comentários');
  if(privateReply){
   if(!page)fail(409,'Conecte a Página do Facebook vinculada ao Instagram para enviar mensagens privadas.');
   requireScopes(page,row.source==='dm'&&row.channel==='instagram'?['instagram_manage_messages','pages_messaging']:row.channel==='instagram'?['instagram_manage_comments','pages_messaging']:['pages_messaging'],'enviar mensagens privadas');
  }
 }catch(error){await setStatus(env,owner,id,'permissao_ausente',{decided:true,error:error.message});return {status:'permissao_ausente',error:error.message}}

 const sent={};let failure=null,uncertain=false;
 const commentId=row.id.replace(/^(ig|fb):/,'');
 if(publicReply){
  try{
   const result=row.channel==='instagram'
    ?await metaPost(env,'/'+encodeURIComponent(commentId)+'/replies',main.token,{message:publicReply})
    :await metaPost(env,'/'+encodeURIComponent(commentId)+'/comments',await pageToken(env,main),{message:publicReply});
   sent.publicId=String(result.id||'');
  }catch(error){failure=error.status?error.message:'Falha na resposta pública.';uncertain=!!error.uncertain}
 }
 if(privateReply&&!uncertain){
  try{
   const token=await pageToken(env,page);
   const recipient=row.source==='dm'?{id:row.sender_id}:{comment_id:commentId};
   const result=await metaPost(env,'/'+encodeURIComponent(page.accountId)+'/messages',token,{recipient,message:{text:privateReply},...(row.source==='dm'?{messaging_type:'RESPONSE'}:{})});
   sent.privateId=String(result.message_id||result.recipient_id||'');
  }catch(error){failure=failure||(error.status?error.message:'Falha na resposta privada.');uncertain=uncertain||!!error.uncertain}
 }
 const anySent=!!(sent.publicId||sent.privateId);
 // Resposta sem confirmação nunca é reenviada automaticamente: pode ter chegado.
 const status=uncertain?'incerto':failure?(anySent?'parcial':'falhou'):'enviado';
 await setStatus(env,owner,id,status,{decided:true,error:uncertain?'Envio sem confirmação da Meta. Confira na rede antes de reenviar.':failure,publicId:sent.publicId||null,privateId:sent.privateId||null});
 await audit(env,owner,'automation_send_'+status,id);
 return {status,...sent};
}

export async function ignoreEvent(env,owner,id){
 const row=await statement(env,`UPDATE automation_events SET status='ignorado',decided_at=?,updated_at=? WHERE owner=? AND id=? AND status IN ('recebido','sem_regra','rascunho','pendente','permissao_ausente','falhou') RETURNING id`,now(),now(),owner,id).first();
 if(!row)fail(409,'Este evento não pode mais ser descartado.');
 await audit(env,owner,'automation_ignore',id);return {ok:true};
}
export async function listEvents(env,owner,status){
 const valid=['recebido','sem_regra','rascunho','pendente','enviando','enviado','parcial','incerto','falhou','ignorado','bloqueado','permissao_ausente','fora_do_prazo'];
 const rows=status&&valid.includes(status)
  ?(await statement(env,'SELECT * FROM automation_events WHERE owner=? AND status=? ORDER BY received_at DESC LIMIT 200',owner,status).all()).results
  :(await statement(env,'SELECT * FROM automation_events WHERE owner=? ORDER BY received_at DESC LIMIT 200',owner).all()).results;
 return rows.map(eventView);
}

// Testa uma regra contra um texto, sem enviar nada.
export async function previewRule(env,owner,input){
 const r=validateRule({...input,active:true});
 const rule={...r,id:'teste',keywords:r.keywords,match_mode:r.matchMode,public_reply:r.publicReply,private_reply:r.privateReply,active:1,created_at:''};
 const event={channel:r.channel,source:r.source,text:str(input?.sampleText,1000),senderName:'@exemplo'};
 const match=findRule([rule],event);
 return {matches:!!match,publicReply:match&&r.source==='comentario'?renderReply(r.publicReply,event):'',privateReply:match?renderReply(r.privateReply,event):''};
}

export async function automationsRoute(env,owner,request,url,path,method,body){
 if(path==='/api/automations'&&method==='GET'){
  const conn=(await statement(env,"SELECT provider,label,expires_at FROM connections WHERE owner=? AND provider IN ('instagram','facebook')",owner).all()).results;
  const counts=Object.fromEntries((await statement(env,'SELECT status,COUNT(*) AS total FROM automation_events WHERE owner=? GROUP BY status',owner).all()).results.map(r=>[r.status,r.total]));
  return {rules:await listRules(env,owner),autoReplyEnabled:env.CONVERSATIONS_AUTO_REPLY_ENABLED==='true',dailyAutoLimit:Number(env.AUTOMATION_DAILY_LIMIT||100),connections:conn.map(c=>({provider:c.provider,label:c.label,expired:Number(c.expires_at)<=Date.now()})),counts};
 }
 if(path==='/api/automations/rules'&&method==='POST')return saveRule(env,owner,await body(request,20000));
 if(path==='/api/automations/rules/history'&&method==='GET')return {versions:await ruleHistory(env,owner,url.searchParams.get('id'))};
 if(path==='/api/automations/preview'&&method==='POST')return previewRule(env,owner,await body(request,20000));
 if(path==='/api/automations/events'&&method==='GET')return {events:await listEvents(env,owner,url.searchParams.get('status'))};
 const m=path.match(/^\/api\/automations\/events\/([A-Za-z0-9%:_.-]{1,300})\/(send|ignore)$/);
 if(m&&method==='POST'){
  let id;try{id=decodeURIComponent(m[1])}catch{fail(400,'Evento inválido.')}
  if(m[2]==='ignore')return ignoreEvent(env,owner,id);
  return sendEvent(env,owner,id,await body(request,8000));
 }
 return null;
}
