// Núcleo puro das automações (sem banco e sem rede): leitura dos webhooks da Meta,
// correspondência de palavras-gatilho e montagem das respostas. Testável isoladamente.

export const normalize=text=>String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();

// Palavras-gatilho: lista separada por vírgula ou quebra de linha. Mínimo 2 caracteres cada.
export function parseKeywords(value){
 const list=Array.isArray(value)?value:String(value||'').split(/[,\n]/);
 return [...new Set(list.map(normalize).filter(k=>k.length>=2&&k.length<=60))].slice(0,30);
}

// "contem": a palavra (ou frase) aparece com fronteira de palavra; "quero" não casa com "querosene".
// "exata": a mensagem inteira é a palavra-gatilho (ignorando pontuação nas pontas).
export function matchesKeyword(text,keyword,mode){
 const t=normalize(text),k=normalize(keyword);if(!t||!k)return false;
 if(mode==='exata')return t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')===k;
 const escaped=k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp('(^|[^\\p{L}\\p{N}])'+escaped+'($|[^\\p{L}\\p{N}])','u').test(t);
}

// Primeira regra ativa (menor prioridade) do mesmo canal e origem que casar.
export function findRule(rules,event){
 return rules.filter(r=>r.active&&r.channel===event.channel&&r.source===event.source)
  .sort((a,b)=>a.priority-b.priority||String(a.created_at).localeCompare(String(b.created_at)))
  .find(r=>parseKeywords(r.keywords).some(k=>matchesKeyword(event.text,k,r.match_mode)))||null;
}

// Variáveis permitidas: {nome} (nome ou @usuário de quem escreveu). Nada mais é interpolado.
export function renderReply(template,event){
 const name=String(event.senderName||'').replace(/[\u0000-\u001f<>]/g,'').slice(0,60);
 return String(template||'').replaceAll('{nome}',name||'').replace(/[ \t]+\n/g,'\n').trim().slice(0,1000);
}

// Converte o payload verificado do webhook em eventos normalizados.
// Ignora ecos, mensagens/comentários da própria conta e eventos que não sejam criação.
export function parseWebhook(payload){
 const out=[];
 const channel=payload?.object==='instagram'?'instagram':payload?.object==='page'?'facebook':null;
 if(!channel)return out;
 for(const entry of Array.isArray(payload.entry)?payload.entry:[]){
  const accountId=String(entry?.id||'');
  for(const m of Array.isArray(entry?.messaging)?entry.messaging:[]){
   if(!m?.message?.mid||typeof m.message.text!=='string'||m.message.is_echo||!m.sender?.id)continue;
   if(String(m.sender.id)===accountId)continue;
   out.push({channel,source:'dm',id:'dm:'+String(m.message.mid),accountId:String(m.recipient?.id||accountId),senderId:String(m.sender.id),senderName:'',mediaId:'',text:m.message.text.slice(0,1000),timestamp:Number(m.timestamp)||Date.now()});
  }
  for(const change of Array.isArray(entry?.changes)?entry.changes:[]){
   const v=change?.value||{};
   if(channel==='instagram'&&change.field==='comments'){
    if(!v.id||typeof v.text!=='string'||!v.from?.id||String(v.from.id)===accountId)continue;
    out.push({channel,source:'comentario',id:'ig:'+String(v.id),commentId:String(v.id),accountId,senderId:String(v.from.id),senderName:v.from.username?'@'+String(v.from.username).slice(0,40):'',mediaId:String(v.media?.id||''),text:v.text.slice(0,1000),timestamp:Number(entry.time)||Date.now()});
   }
   if(channel==='facebook'&&change.field==='feed'&&v.item==='comment'&&v.verb==='add'){
    if(!v.comment_id||typeof v.message!=='string'||!v.from?.id||String(v.from.id)===accountId)continue;
    out.push({channel,source:'comentario',id:'fb:'+String(v.comment_id),commentId:String(v.comment_id),accountId,senderId:String(v.from.id),senderName:String(v.from.name||'').slice(0,60),mediaId:String(v.post_id||''),text:v.message.slice(0,1000),timestamp:(Number(v.created_time)||0)*1000||Date.now()});
   }
  }
 }
 return out;
}

// Prazos da Meta: resposta privada a comentário em até 7 dias; resposta a DM dentro de 24 horas.
export function withinWindow(event,at=Date.now()){
 const age=at-Number(new Date(event.received_at||event.timestamp).getTime());
 return event.source==='dm'?age<24*3600000:age<7*24*3600000;
}
