// Public Meta webhook: never uses the GitHub session or the Ads read token.
const utf8=new TextEncoder();
function plain(message,status=200){return new Response(message,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})}
export async function handleConversationWebhook(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'){
  const mode=url.searchParams.get('hub.mode'),challenge=url.searchParams.get('hub.challenge'),token=url.searchParams.get('hub.verify_token');
  if(mode!=='subscribe'||!env.META_WEBHOOK_VERIFY_TOKEN||token!==env.META_WEBHOOK_VERIFY_TOKEN||!challenge||challenge.length>500)return plain('Forbidden',403);
  return plain(challenge);
 }
 if(request.method!=='POST')return plain('Method Not Allowed',405);
 if(!env.META_APP_SECRET)return plain('Webhook unavailable',503);
 const raw=await request.arrayBuffer();
 if(raw.byteLength>128000)return plain('Payload too large',413);
 const provided=request.headers.get('X-Hub-Signature-256')||'';
 if(!/^sha256=[0-9a-f]{64}$/i.test(provided))return plain('Unauthorized',401);
 const key=await crypto.subtle.importKey('raw',utf8.encode(env.META_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,raw));
 const actual=Uint8Array.from(provided.slice(7).match(/../g),part=>parseInt(part,16));
 let diff=0;for(let i=0;i<32;i++)diff|=expected[i]^actual[i];
 if(diff!==0)return plain('Unauthorized',401);
 let data;try{data=JSON.parse(new TextDecoder().decode(raw))}catch{return plain('Invalid JSON',400)}
 if(!['instagram','page'].includes(data?.object)||!Array.isArray(data.entry))return plain('Unsupported event',400);
 if(!env.CONVERSATIONS_QUEUE?.send)return plain('Queue not configured',503);
 // Enqueue the verified payload; HTTP 200 is returned only after durable acceptance.
 try{await env.CONVERSATIONS_QUEUE.send({object:data.object,entry:data.entry})}catch{return plain('Queue unavailable',503)}
 return plain('EVENT_RECEIVED');
}
