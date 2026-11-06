import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleConversationWebhook} from '../server/conversations-webhook.mjs';
const url='https://smezi-content-engine.pages.dev/api/webhooks/meta';
const secret='meta-secret-for-test';
const env=()=>({META_WEBHOOK_VERIFY_TOKEN:'private-verify-token',META_APP_SECRET:secret,CONVERSATIONS_QUEUE:{async send(x){this.received=x}}});
async function signature(body){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)));
 return 'sha256='+Array.from(sig,x=>x.toString(16).padStart(2,'0')).join('');
}
test('GET verifies challenge only with matching token and subscribe mode',async()=>{
 const e=env();
 const good=await handleConversationWebhook(new Request(url+'?hub.mode=subscribe&hub.verify_token=private-verify-token&hub.challenge=76543'),e);
 assert.equal(good.status,200);assert.equal(await good.text(),'76543');
 const denied=await handleConversationWebhook(new Request(url+'?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=76543'),e);
 assert.equal(denied.status,403);
});
test('valid POST enqueues verified payload and acknowledges',async()=>{
 const e=env(),body=JSON.stringify({object:'instagram',entry:[{id:'123',messaging:[]}]});
 const response=await handleConversationWebhook(new Request(url,{method:'POST',headers:{'X-Hub-Signature-256':await signature(body)},body}),e);
 assert.equal(response.status,200);assert.deepEqual(e.CONVERSATIONS_QUEUE.received,JSON.parse(body));
});
test('rejects missing or invalid signature before queue',async()=>{
 const e=env(),body=JSON.stringify({object:'instagram',entry:[]});
 const response=await handleConversationWebhook(new Request(url,{method:'POST',headers:{'X-Hub-Signature-256':'sha256='+'0'.repeat(64)},body}),e);
 assert.equal(response.status,401);assert.equal(e.CONVERSATIONS_QUEUE.received,undefined);
});
test('never acknowledges without durable queue confirmation',async()=>{
 const e=env(),body=JSON.stringify({object:'page',entry:[]});
 e.CONVERSATIONS_QUEUE.send=async()=>{throw Error('failed')};
 const response=await handleConversationWebhook(new Request(url,{method:'POST',headers:{'X-Hub-Signature-256':await signature(body)},body}),e);
 assert.equal(response.status,503);
});
