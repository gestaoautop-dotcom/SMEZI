import {unseal} from './security.mjs';
import {statement} from './store.mjs';
const now=()=>new Date().toISOString();
function items(payload){
 const result=[];
 for(const entry of payload.entry||[])for(const event of entry.messaging||[]){
  if(!event.message?.mid||!event.message?.text||event.message.is_echo||!event.sender?.id||!event.recipient?.id)continue;
  result.push({id:String(event.message.mid),accountId:String(entry.id||event.recipient.id),senderId:String(event.sender.id),text:String(event.message.text).slice(0,4000),timestamp:Number(event.timestamp)||0});
 }
 return result;
}
async function processOne(env,event){
 const owner=String(env.GITHUB_ALLOWED_ID||'');
 if(!owner||!env.DB)throw Error('Missing owner or database binding');
 // Stage 1 is restricted to one explicitly connected Instagram account.
 const row=await statement(env,"SELECT account_id,encrypted_token,expires_at FROM connections WHERE owner=? AND provider='instagram'",owner).first();
 if(!row||String(row.account_id)!==event.accountId)return;
 const inserted=await statement(env,"INSERT INTO conversation_webhook_events(id,owner,channel_account_id,sender_id,received_at,status) VALUES(?,?,?,?,?,'received') ON CONFLICT(id) DO NOTHING RETURNING id",event.id,owner,event.accountId,event.senderId,now()).first();
 if(!inserted)return; // Durable idempotency, including concurrent queue deliveries.
 if(env.CONVERSATIONS_AUTO_REPLY_ENABLED!=='true'){
  await statement(env,"UPDATE conversation_webhook_events SET status='disabled' WHERE id=?",event.id).run();return;
 }
 if(env.CONVERSATIONS_TEST_ACCOUNT_ID!==event.accountId){
  await statement(env,"UPDATE conversation_webhook_events SET status='blocked' WHERE id=?",event.id).run();return;
 }
 // Default deny. The existing publishing grants do not authorize private messages.
 const token=await unseal(env,row.encrypted_token,owner+':instagram');
 const grants=new Set(token.granted_scopes||[]);
 if(!grants.has('instagram_manage_messages')&&!grants.has('instagram_manage_messaging')){
  await statement(env,"UPDATE conversation_webhook_events SET status='missing_permission' WHERE id=?",event.id).run();return;
 }
 if(Number(row.expires_at)<=Date.now()){
  await statement(env,"UPDATE conversation_webhook_events SET status='expired_token' WHERE id=?",event.id).run();return;
 }
 const version=env.META_API_VERSION;
 if(!/^v\d+\.\d+$/.test(version||''))throw Error('Missing Graph API version');
 const text=env.CONVERSATIONS_TEST_REPLY||'Olá! Recebemos sua mensagem. Em breve responderemos.';
 if( new TextEncoder().encode(text).length>1000)throw Error('Reply too large');
 // Never automatically retry an outbound send: network errors may be ambiguous.
 await statement(env,"UPDATE conversation_webhook_events SET status='sending' WHERE id=?",event.id).run();
 try{
  const response=await fetch('https://graph.facebook.com/'+version+'/'+encodeURIComponent(event.accountId)+'/messages',{
   method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},
   body:JSON.stringify({recipient:{id:event.senderId},message:{text}})
  });
  if(!response.ok)throw Error('Meta HTTP '+response.status);
  const result=await response.json();
  if(!result.message_id&&!result.recipient_id)throw Error('Meta did not confirm delivery');
  await statement(env,"UPDATE conversation_webhook_events SET status='sent',sent_at=? WHERE id=?",now(),event.id).run();
 }catch{
  await statement(env,"UPDATE conversation_webhook_events SET status='uncertain' WHERE id=?",event.id).run();
 }
}
export async function consumeConversationBatch(batch,env){
 for(const msg of batch.messages){
  try{for(const event of items(msg.body))await processOne(env,event);msg.ack()}
  catch{msg.retry()}
 }
}
