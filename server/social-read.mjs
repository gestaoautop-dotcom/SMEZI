import {externalJSON,unseal} from './security.mjs';
import {statement} from './store.mjs';

const unavailable=(reason,requiredPermissions=[])=>({status:'unavailable',reason,requiredPermissions,items:[]});
const available=items=>({status:'available',items});
const finite=x=>x===null||x===undefined||!Number.isFinite(Number(x))?null:Number(x);
const clean=x=>String(x??'').slice(0,900);
async function graph(env,id,edge,fields,accessToken,params={}){
 const version=env.META_API_VERSION;
 if(!/^v\d+\.\d+$/.test(version||''))throw Error('Invalid Meta API version');
 const u=new URL('https://graph.facebook.com/'+version+'/'+encodeURIComponent(String(id))+'/'+edge);
 u.searchParams.set('fields',fields);u.searchParams.set('limit','10');
 for(const [key,value] of Object.entries(params))u.searchParams.set(key,value);
 return externalJSON(u.href,{headers:{Authorization:'Bearer '+accessToken}});
}
async function attempt(fn){
 try{return available(await fn())}catch{return unavailable('A API Graph não confirmou esta leitura; verifique as permissões da conta.')}
}
export async function socialRead(env,owner){
 const rows=await statement(env,"SELECT provider,account_id,encrypted_token,expires_at FROM connections WHERE owner=? AND provider IN ('facebook','instagram','linkedin')",owner).all();
 const by=new Map(rows.results.map(row=>[row.provider,row]));
 const channels=[];
 for(const provider of ['facebook','instagram','linkedin']){
  const row=by.get(provider);
  const channel={provider,posts:unavailable('Conta não conectada.'),metrics:unavailable('Conta não conectada.')};
  channels.push(channel);
  if(!row)continue;
  if(Number(row.expires_at)<=Date.now()){channel.posts=unavailable('Token expirado.');channel.metrics=unavailable('Token expirado.');continue}
  if(provider==='linkedin'){channel.posts=unavailable('A autorização pessoal não concede leitura de publicações.');channel.metrics=unavailable('A autorização pessoal não concede métricas.');continue}
  const credential=await unseal(env,row.encrypted_token,owner+':'+provider);
  const grants=new Set(credential.granted_scopes||[]);
  if(provider==='facebook'){
   if(!grants.has('pages_read_engagement')){channel.posts=unavailable('Exige pages_read_engagement.',['pages_read_engagement']);channel.metrics=channel.posts;continue}
   channel.posts=await attempt(async()=>{
    const result=await graph(env,row.account_id,'posts','id,message,created_time,permalink_url',credential.access_token);
    return (result.data||[]).map(p=>({id:clean(p.id),text:clean(p.message),date:p.created_time||null,url:p.permalink_url||null,comments:finite(p.comments?.summary?.total_count),reactions:finite(p.reactions?.summary?.total_count)}));
   });
   channel.metrics=channel.posts.status==='available'?available(channel.posts.items.map(p=>({postId:p.id,comments:p.comments,reactions:p.reactions,source:'Graph post counters'}))):unavailable('As contagens não estão disponíveis.');
  }else{
   if(!grants.has('instagram_basic')){channel.posts=unavailable('Exige instagram_basic.',['instagram_basic']);channel.metrics=channel.posts;continue}
   channel.posts=await attempt(async()=>{
    const result=await graph(env,row.account_id,'media','id,caption,timestamp,permalink,like_count,comments_count',credential.access_token);
    return (result.data||[]).map(p=>({id:clean(p.id),text:clean(p.caption),date:p.timestamp||null,url:p.permalink||null,likes:finite(p.like_count),comments:finite(p.comments_count)}));
   });
   channel.metrics=channel.posts.status==='available'?available(channel.posts.items.map(p=>({postId:p.id,likes:p.likes,comments:p.comments,source:'Graph media counters'}))):unavailable('As contagens não estão disponíveis.');
  }
 }
 return {readOnly:true,publishingEnabled:false,generatedAt:new Date().toISOString(),channels};
}
