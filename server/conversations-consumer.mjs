// Consumidor da fila leonardo-conversations: recebe os eventos já verificados (HMAC) pelo webhook
// e aplica as regras de automação (comentários e DMs por palavra-gatilho).
// Nada é enviado sem regra ativa; o modo automático ainda depende de CONVERSATIONS_AUTO_REPLY_ENABLED=true.
import {statement} from './store.mjs';
import {parseWebhook} from './automation-core.mjs';
import {processEvent} from './automations.mjs';

// Fase atual: uma única conta proprietária (mesma do login do painel).
async function ownerFor(env,event){
 const owner=String(env.GITHUB_ALLOWED_ID||'');
 if(!owner||!env.DB)throw Error('Missing owner or database binding');
 const row=await statement(env,'SELECT account_id FROM connections WHERE owner=? AND provider=?',owner,event.channel).first();
 // Eventos de contas não conectadas são descartados sem registro.
 return row&&String(row.account_id)===String(event.accountId)?owner:null;
}

export async function consumeConversationBatch(batch,env){
 for(const msg of batch.messages){
  try{
   for(const event of parseWebhook(msg.body)){
    const owner=await ownerFor(env,event);
    if(owner)await processEvent(env,owner,event);
   }
   msg.ack();
  }catch{msg.retry()}
 }
}
