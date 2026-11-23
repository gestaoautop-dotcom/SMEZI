'use strict';
// Calendário de posts. Todo conteúdo vindo do servidor ou da IA entra por textContent (nunca HTML).
const $=id=>document.getElementById(id);
const NETWORKS=['Instagram','Facebook','Threads','X','LinkedIn'];
const LIMITS={Instagram:2200,Facebook:5000,Threads:500,X:280,LinkedIn:3000};
const MEDIA_NETS=['Instagram','Facebook','Threads'];
const DOW=['dom','seg','ter','qua','qui','sex','sáb'];
let cursor=new Date();cursor.setDate(1);
let batches=[],current=null,photo=null,photoURL=null,lastIdeas=[];

function node(tag,props={},children=[]){const el=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('data-')||k.startsWith('aria-'))el.setAttribute(k,v);else el[k]=v}for(const c of children)if(c)el.append(c);return el}
async function api(path,data,method){
 const response=await fetch(path,{method:method||(data===undefined?'GET':'POST'),credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 let result={};try{result=await response.json()}catch{}
 if(response.status===401)throw Error('Faça login no Leonardo para usar o calendário.');
 if(!response.ok)throw Error(result.error||'Não foi possível concluir a operação.');
 return result;
}
const pad=n=>String(n).padStart(2,'0');
const localDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const localTime=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt=iso=>new Date(iso).toLocaleString('pt-BR',{dateStyle:'full',timeStyle:'short'});

function itemState(i){
 const j=i.job&&i.job.forCurrentVersion?i.job:null;
 if(j&&j.status==='published')return ['publicado','ok'];
 if(j&&['pending','preparing','publishing'].includes(j.status))return ['agendado','sched'];
 if(j&&['failed','uncertain'].includes(j.status))return [j.status==='uncertain'?'sem confirmação':'falhou','err'];
 if(i.approved)return ['aprovado','ok'];
 return ['rascunho','wait'];
}
function batchState(b){
 const s=b.items.map(i=>itemState(i)[1]);
 if(s.includes('err'))return 'err';if(s.length&&s.every(x=>x==='ok'))return 'ok';if(s.includes('sched'))return 'sched';return '';
}

async function loadMonth(){
 const first=new Date(cursor),start=new Date(first);start.setDate(1-first.getDay());
 const end=new Date(start);end.setDate(start.getDate()+42);
 const label=first.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});$('monthTitle').textContent=label.charAt(0).toUpperCase()+label.slice(1);
 try{
  const r=await api(`/api/calendar?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`);
  batches=r.batches;$('status').textContent=`${batches.length} post(s) neste período.`;
 }catch(e){batches=[];$('status').textContent=e.message}
 renderMonth(start);
 if(current){const fresh=batches.find(b=>b.id===current.id);if(fresh)openDetail(fresh)}
}
function renderMonth(start){
 const cells=DOW.map(d=>node('div',{class:'dow',text:d}));
 const today=localDay(new Date());
 for(let i=0;i<42;i++){
  const d=new Date(start);d.setDate(start.getDate()+i);const key=localDay(d);
  const items=batches.filter(b=>localDay(new Date(b.plannedAt))===key).map(b=>{
   const btn=node('button',{class:'item',type:'button','aria-label':`${b.title}, ${localTime(new Date(b.plannedAt))}`},[
    b.previewURL?node('img',{src:b.previewURL,alt:'',loading:'lazy'}):null,
    node('span',{class:'t',text:`${localTime(new Date(b.plannedAt))} ${b.title}`}),node('span',{class:'dot '+batchState(b)})]);
   btn.onclick=()=>openDetail(b);return btn;
  });
  const add=node('button',{class:'add',type:'button',text:'+','aria-label':'Novo post em '+key});
  add.onclick=()=>{$('date').value=key;$('caption').focus()};
  cells.push(node('div',{class:'day'+(d.getMonth()!==cursor.getMonth()?' out':'')+(key===today?' today':''),role:'gridcell'},[node('span',{class:'n',text:String(d.getDate())}),...items,add]));
 }
 $('month').replaceChildren(...cells);
}

function openDetail(b){
 current=b;$('detail').hidden=false;$('detailTitle').textContent=b.title;
 $('detailWhen').textContent=fmt(b.plannedAt);
 const at=new Date(b.plannedAt);$('moveAt').value=`${localDay(at)}T${localTime(at)}`;
 if(b.previewURL){$('detailImg').src=b.previewURL;$('detailImg').classList.remove('hidden')}else $('detailImg').classList.add('hidden');
 $('detailNets').replaceChildren(...b.items.map(i=>{
  const [label,cls]=itemState(i);
  const area=node('textarea',{value:i.text,maxLength:LIMITS[i.platform]||5000,'aria-label':'Legenda para '+i.platform});
  const count=node('span',{class:'muted',text:`${Array.from(i.text).length}/${LIMITS[i.platform]}`});
  area.oninput=()=>{count.textContent=`${Array.from(area.value).length}/${LIMITS[i.platform]}`};
  const save=node('button',{class:'ghost',type:'button',text:'Salvar nova versão'});
  save.onclick=()=>act(save,()=>api(`/api/batches/${b.id}/revise`,{platform:i.platform,text:area.value}),'Nova versão salva. Aprove de novo antes de agendar.');
  return node('div',{class:'net'},[
   node('h3',{text:i.platform}),node('span',{class:'chip '+cls,text:label}),node('span',{class:'chip',text:'versão '+i.revision}),
   i.hasMedia?node('span',{class:'chip',text:'com foto'}):null,
   i.job?.error?node('p',{class:'muted notice',text:i.job.error}):null,
   area,count,node('div',{class:'actions'},[save])]);
 }));
 $('detailMsg').textContent='';
}
async function act(button,fn,ok){
 button.disabled=true;$('detailMsg').textContent='Processando…';
 try{const r=await fn();const results=r.results||[];
  const fails=results.filter(x=>!x.ok);
  $('detailMsg').textContent=fails.length?fails.map(x=>`${x.platform}: ${x.error}`).join(' • '):ok;
  await loadMonth();
 }catch(e){$('detailMsg').textContent=e.message}finally{button.disabled=false}
}
$('approveAll').onclick=e=>act(e.currentTarget,()=>api(`/api/batches/${current.id}/approve`,{}),'Todas as redes aprovadas nesta versão.');
$('scheduleAll').onclick=e=>act(e.currentTarget,()=>api(`/api/batches/${current.id}/schedule`,{}),'Redes aprovadas agendadas.');
$('move').onclick=e=>{if(!$('moveAt').value)return;act(e.currentTarget,()=>api(`/api/batches/${current.id}/move`,{plannedAt:new Date($('moveAt').value).toISOString()}),'Data alterada. Agende novamente.')};
$('closeDetail').onclick=()=>{$('detail').hidden=true;current=null};

// ---------- Novo post ----------
function renderNets(){
 $('nets').replaceChildren(...NETWORKS.map(n=>{const box=node('input',{type:'checkbox',value:n,checked:n==='Instagram'});box.onchange=renderOverrides;return node('label',{},[box,document.createTextNode(n)])}));
 renderOverrides();
}
const chosen=()=>[...$('nets').querySelectorAll('input:checked')].map(x=>x.value);
function renderOverrides(){
 const keep=Object.fromEntries([...$('overrides').querySelectorAll('textarea')].map(t=>[t.dataset.net,t.value]));
 $('overrides').replaceChildren(...chosen().map(n=>{
  const t=node('textarea',{maxLength:LIMITS[n],placeholder:'Vazio = usa a legenda principal',value:keep[n]||'','data-net':n,id:'ov-'+n});t.style.minHeight='70px';
  return node('div',{},[node('label',{htmlFor:'ov-'+n,text:`Legenda específica para ${n} (até ${LIMITS[n]} caracteres)`}),t]);
 }));
}
async function toJPEG(file){
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,1440/bitmap.width);
 const canvas=node('canvas',{width:Math.round(bitmap.width*scale),height:Math.round(bitmap.height*scale)});
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível converter a foto.')),'image/jpeg',0.9));
}
$('photo').onchange=async()=>{
 const file=$('photo').files[0];photo=null;if(photoURL)URL.revokeObjectURL(photoURL);
 if(!file){$('photoPreview').classList.add('hidden');return}
 try{photo=await toJPEG(file);photo.name=file.name;photoURL=URL.createObjectURL(photo);$('photoPreview').src=photoURL;$('photoPreview').classList.remove('hidden');
  $('newMsg').textContent=`Foto pronta: ${Math.round(photo.size/1024)} KB em JPEG.`}
 catch(e){$('newMsg').textContent=e.message}
};
$('save').onclick=async e=>{
 const btn=e.currentTarget,nets=chosen();
 if(!nets.length){$('newMsg').textContent='Escolha ao menos uma rede.';return}
 if(!$('date').value||!$('time').value){$('newMsg').textContent='Informe data e horário.';return}
 btn.disabled=true;$('newMsg').textContent='Salvando…';
 try{
  let mediaId;
  if(photo){
   const r=await fetch('/api/media?name='+encodeURIComponent((photo.name||'foto').slice(0,100)),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'image/jpeg'},body:photo});
   const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Falha ao enviar a foto.');mediaId=data.id;
  }
  const overrides=Object.fromEntries([...$('overrides').querySelectorAll('textarea')].filter(t=>t.value.trim()).map(t=>[t.dataset.net,t.value]));
  const batch=await api('/api/batches',{caption:$('caption').value,networks:nets,overrides,mediaId,plannedAt:new Date(`${$('date').value}T${$('time').value}`).toISOString()});
  $('newMsg').textContent='Salvo como rascunho em cada rede. Revise, aprove e agende no painel do post.';
  $('caption').value='';$('photo').value='';photo=null;$('photoPreview').classList.add('hidden');renderOverrides();
  cursor=new Date(batch.plannedAt);cursor.setDate(1);await loadMonth();openDetail(batches.find(b=>b.id===batch.id)||batch);
 }catch(err){$('newMsg').textContent=err.message}finally{btn.disabled=false}
};
$('suggest').onclick=async e=>{
 const btn=e.currentTarget,nets=chosen(),tema=$('theme').value.trim()||$('caption').value.trim();
 if(!tema||!nets.length){$('newMsg').textContent='Escreva um tema (ou a legenda base) e escolha as redes.';return}
 btn.disabled=true;$('newMsg').textContent='O Leonardo está consultando suas memórias…';
 try{
  const r=await api('/api/assistant',{tarefa:'legendas',provedor:$('planProvider').value||undefined,entrada:{tema,redes:nets,descricaoFoto:photo?'Foto enviada pela autora':''}});
  for(const l of r.resultado.legendas){const t=document.getElementById('ov-'+l.rede);if(t)t.value=[l.texto,l.hashtags.join(' ')].filter(Boolean).join('\n\n')}
  if(!$('caption').value.trim()&&r.resultado.legendas[0])$('caption').value=r.resultado.legendas[0].texto;
  $('newMsg').textContent=`Sugestões de ${r.model} (${r.toolCalls.length} consulta(s) às ferramentas). Revise antes de salvar.`+(r.resultado.observacoes?' '+r.resultado.observacoes:'');
 }catch(err){$('newMsg').textContent=err.message}finally{btn.disabled=false}
};

// ---------- Plano com o Leonardo ----------
$('plan').onclick=async e=>{
 const btn=e.currentTarget,first=new Date(cursor),last=new Date(first.getFullYear(),first.getMonth()+1,0);
 btn.disabled=true;$('planMsg').textContent='Planejando… isso pode levar alguns segundos.';
 try{
  const r=await api('/api/assistant',{tarefa:'plano_calendario',provedor:$('planProvider').value||undefined,entrada:{inicio:localDay(first),fim:localDay(last),quantidade:Number($('planCount').value),objetivo:$('planGoal').value,redes:chosen().length?chosen():['Instagram']}});
  lastIdeas=r.resultado.posts;
  $('planMsg').textContent=`${lastIdeas.length} ideia(s) de ${r.model}. ${r.resultado.justificativa||''}`;
  $('ideas').replaceChildren(...lastIdeas.map(p=>{
   const use=node('button',{class:'ghost',type:'button',text:'Usar esta ideia'});
   use.onclick=()=>{$('date').value=p.data;$('time').value=p.horario;$('caption').value=p.legenda;$('theme').value=p.tema;
    for(const box of $('nets').querySelectorAll('input'))box.checked=p.redes.includes(box.value);renderOverrides();$('caption').focus();
    $('newMsg').textContent='Ideia carregada. Direção de foto: '+p.direcao_fotografica};
   return node('div',{class:'idea'},[node('h3',{text:`${p.data} ${p.horario} — ${p.tema}`}),node('p',{class:'muted',text:`${p.objetivo} • ${p.redes.join(', ')}`}),node('p',{class:'muted',text:p.legenda.slice(0,240)+(p.legenda.length>240?'…':'')}),use]);
  }));
 }catch(err){$('planMsg').textContent=err.message}finally{btn.disabled=false}
};

async function loadProviders(){
 try{const r=await api('/api/assistant');
  $('planProvider').replaceChildren(...Object.entries(r.providers).filter(([,p])=>p.ready).map(([id,p])=>node('option',{value:id,text:`${p.label}${p.external?' (pago)':''}`})));
  if(!$('planProvider').options.length)$('planProvider').append(node('option',{value:'',text:'Nenhuma IA ativa'}));
 }catch{$('planProvider').replaceChildren(node('option',{value:'',text:'IA indisponível'}))}
}
$('prev').onclick=()=>{cursor.setMonth(cursor.getMonth()-1);loadMonth()};
$('next').onclick=()=>{cursor.setMonth(cursor.getMonth()+1);loadMonth()};
$('today').onclick=()=>{cursor=new Date();cursor.setDate(1);loadMonth()};
$('date').value=localDay(new Date(Date.now()+86400000));
renderNets();loadProviders();loadMonth();
