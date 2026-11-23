'use strict';
const $=id=>document.getElementById(id);
let providers={};
async function refresh(){
 try{
  const response=await fetch('/api/ai/providers',{credentials:'same-origin'});
  if(response.status===401){$('status').textContent='Faça login no Leonardo antes de utilizar as APIs.';return}
  if(!response.ok)throw Error('Serviço de IA indisponível.');
  const result=await response.json();providers=result.providers||{};
  const list=Object.entries(providers).map(([name,value])=>name+': '+(value.configured?(value.enabled?'configurado':'desativado'):'não configurado')).join(' • ');
  $('status').textContent=list||'Nenhuma API configurada.';
  update();
 }catch{$('status').textContent='Não foi possível consultar as integrações.'}
}
function update(){
 const p=providers[$('provider').value];
 $('send').disabled=!(p?.configured&&p?.enabled);
}
$('provider').addEventListener('change',update);
$('send').addEventListener('click',async()=>{
 const prompt=$('prompt').value.trim(),provider=$('provider').value;
 if(!prompt){$('answer').textContent='Escreva uma pergunta antes de enviar.';return}
 if(!providers[provider]?.configured||!providers[provider]?.enabled)return;
 $('send').disabled=true;$('answer').textContent='Consultando a API oficial…';$('usage').textContent='';
 try{
  const response=await fetch('/api/ai/ask',{
   method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({provider,prompt})
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Não foi possível consultar a API.');
  $('answer').textContent=result.answer;
  $('usage').textContent='Provedor: '+result.provider+' | Modelo: '+result.model+' | Tokens de entrada: '+(result.usage?.inputTokens??'não informado')+' | Saída: '+(result.usage?.outputTokens??'não informado');
 }catch(error){$('answer').textContent=error.message||'Falha na consulta.'}
 finally{update()}
});
refresh();
