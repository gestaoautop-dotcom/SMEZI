// SMEZI AI Sales Agent - Cloudflare Worker (starter).
// Configure secrets via wrangler secret put. Never commit credentials.
// Routes: GET /health; GET /webhook/whatsapp; POST /webhook/whatsapp;
// GET /api/{leads,proposals,payments,conversations}; POST /api/proposals;
// POST /api/handoff. Admin requests require ADMIN_API_TOKEN bearer token.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const uid=()=>crypto.randomUUID();
const enc=new TextEncoder();
async function validSignature(secret,raw,provided){
 if(!secret||!provided?.startsWith("sha256=")) return false;
 const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const expected=new Uint8Array(await crypto.subtle.sign("HMAC",k,enc.encode(raw)));
 const got=provided.slice(7);
 if(got.length!==64||!/^[a-f0-9]{64}$/i.test(got))return false;
 const hex=Array.from(expected,b=>b.toString(16).padStart(2,"0")).join("");
 let diff=0;for(let i=0;i<64;i++)diff|=hex.charCodeAt(i)^got.toLowerCase().charCodeAt(i);
 return diff===0;
}
async function sendWhatsApp(env,to,body){
 if(!env.WHATSAPP_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID)throw Error("WhatsApp not configured");
 const version=env.WHATSAPP_GRAPH_VERSION||"v23.0";
 const r=await fetch(`https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
  method:"POST",headers:{authorization:`Bearer ${env.WHATSAPP_TOKEN}`,"content-type":"application/json"},
  body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body}})
 });
 if(!r.ok)throw Error(`WhatsApp send failed: ${r.status}`);
 return r.json();
}
async function createReply(env,lead,message){
 if(lead.human_required)return null;
 // No invented availability, quotes, guaranteed delivery dates or payment links.
 if(!env.OPENAI_API_KEY)return "Olá! Sou a assistente virtual da SMEZI. Você busca um site, identidade visual ou sistema sob medida? Conte um pouco sobre sua empresa.";
 const history=(await env.DB.prepare("SELECT direction,body FROM conversations WHERE lead_id=? ORDER BY created_at DESC LIMIT 10").bind(lead.id).all()).results.reverse();
 const input=history.map(x=>({role:x.direction==="in"?"user":"assistant",content:x.body}));
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,"content-type":"application/json"},
 body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4.1-mini",instructions:"Você é a assistente comercial da SMEZI. Informe claramente que é IA. Fale em português brasileiro, seja breve e útil. Qualifique serviço, empresa, objetivo e prazo. Nunca invente preços, prazos, portfólio, comprovantes, contratos ou descontos. Não solicite dados sensíveis. Para preço ou condições específicas, diga que a equipe enviará proposta. Se o cliente pedir humano, informe que a conversa será encaminhada.",input,max_output_tokens:180})});
 if(!r.ok)throw Error(`AI response failed: ${r.status}`);
 const data=await r.json();
 return (data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("").trim()||"Obrigado! Vou registrar seu interesse para nossa equipe.";
}
async function handleMessage(env,m,contact){
 const phone=m.from; if(!phone||!m.id)return;
 const text=m.text?.body?.trim();
 // Do not process attachments, reactions or unsupported message types as text.
 if(!text)return;
 const leadId=uid();
 await env.DB.prepare("INSERT INTO leads (id,phone,name) VALUES (?,?,?) ON CONFLICT(phone) DO UPDATE SET name=COALESCE(leads.name,excluded.name),updated_at=CURRENT_TIMESTAMP").bind(leadId,phone,contact?.profile?.name||null).run();
 const lead=await env.DB.prepare("SELECT * FROM leads WHERE phone=?").bind(phone).first();
 const insert=await env.DB.prepare("INSERT OR IGNORE INTO conversations (id,lead_id,direction,body,external_message_id) VALUES (?,?,?,?,?)").bind(uid(),lead.id,"in",text,m.id).run();
 if(!insert.meta?.changes)return;
 const lower=text.toLocaleLowerCase("pt-BR");
 if(/\\b(humano|pessoa|atendente|consultor|parar|sair|cancelar)\\b/i.test(lower)){
  await env.DB.prepare("UPDATE leads SET human_required=1,status='handoff',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(lead.id).run();
  const reply="Entendido. Vou encaminhar sua conversa à equipe da SMEZI. Não enviarei mais respostas automáticas por aqui.";
  const sent=await sendWhatsApp(env,phone,reply);
  await env.DB.prepare("INSERT INTO conversations (id,lead_id,direction,body,external_message_id) VALUES (?,?,?,?,?)").bind(uid(),lead.id,"out",reply,sent.messages?.[0]?.id||null).run();
  return;
 }
 if(lead.human_required)return;
 const reply=await createReply(env,lead,text);
 if(!reply)return;
 const sent=await sendWhatsApp(env,phone,reply);
 await env.DB.prepare("INSERT INTO conversations (id,lead_id,direction,body,external_message_id) VALUES (?,?,?,?,?)").bind(uid(),lead.id,"out",reply,sent.messages?.[0]?.id||null).run();
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;
 if(path==="/health")return json({ok:true,service:"smezi-ai-sales-agent"});
 if(path==="/webhook/whatsapp"&&request.method==="GET"){
  if(url.searchParams.get("hub.mode")==="subscribe"&&env.WHATSAPP_VERIFY_TOKEN&&url.searchParams.get("hub.verify_token")===env.WHATSAPP_VERIFY_TOKEN)
   return new Response(url.searchParams.get("hub.challenge")||"",{status:200});
  return new Response("Forbidden",{status:403});
 }
 if(path==="/webhook/whatsapp"&&request.method==="POST"){
  const raw=await request.text();
  if(!await validSignature(env.META_APP_SECRET,raw,request.headers.get("x-hub-signature-256")))return json({error:"invalid signature"},401);
  let data;try{data=JSON.parse(raw)}catch{return json({error:"invalid JSON"},400)}
  // Ack immediately. Background processing should be monitored for failure/retry.
  ctx.waitUntil((async()=>{for(const e of data.entry||[])for(const c of e.changes||[]){
   const v=c.value||{};for(const m of v.messages||[]){
    try{await handleMessage(env,m,(v.contacts||[]).find(x=>x.wa_id===m.from))}
    catch(err){console.error("message processing failed",String(err))}
   }
  }})());
  return json({received:true});
 }
 // Never expose client data from a public route.
 if(!env.ADMIN_API_TOKEN||request.headers.get("authorization")!==`Bearer ${env.ADMIN_API_TOKEN}`)return json({error:"unauthorized"},401);
 if(request.method==="GET"){
  const tables={ "/api/leads":"SELECT * FROM leads ORDER BY updated_at DESC LIMIT 100", "/api/proposals":"SELECT * FROM proposals ORDER BY created_at DESC LIMIT 100", "/api/payments":"SELECT * FROM payments ORDER BY created_at DESC LIMIT 100", "/api/conversations":"SELECT * FROM conversations ORDER BY created_at DESC LIMIT 100"};
  if(tables[path])return json({items:(await env.DB.prepare(tables[path]).all()).results});
 }
 if(path==="/api/proposals"&&request.method==="POST"){
  const b=await request.json().catch(()=>null);
  if(!b||typeof b.lead_id!=="string"||typeof b.title!=="string"||!Number.isSafeInteger(b.amount_cents)||b.amount_cents<0)return json({error:"invalid proposal"},400);
  const id=uid();
  await env.DB.prepare("INSERT INTO proposals (id,lead_id,title,scope_json,currency,amount_cents) VALUES (?,?,?,?,?,?)").bind(id,b.lead_id,b.title,JSON.stringify(b.scope||{}),b.currency==="USD"?"USD":"BRL",b.amount_cents).run();
  await env.DB.prepare("INSERT INTO audit_events (id,actor,action,subject_type,subject_id) VALUES (?,?,?,?,?)").bind(uid(),"admin","proposal.created","proposal",id).run();
  return json({id,status:"draft"},201);
 }
 if(path==="/api/handoff"&&request.method==="POST"){
  const b=await request.json().catch(()=>null);
  if(!b||typeof b.lead_id!=="string"||typeof b.human_required!=="boolean")return json({error:"invalid handoff"},400);
  const r=await env.DB.prepare("UPDATE leads SET human_required=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.human_required?1:0,b.human_required?"handoff":"qualified",b.lead_id).run();
  return json({updated:r.meta.changes>0});
 }
 return json({error:"not found"},404);
}};
