import {baseURL,sign,verify,cookie,cookies,random,hash,seal,unseal,external,externalJSON,fail} from './security.mjs';
import {statement,now,audit} from './store.mjs';
import {unifiedInstagramConfig,unifiedInstagramAuthorize,exchangeUnifiedInstagram,identifyUnifiedInstagram} from './instagram-unified.mjs';
export const PROVIDERS=['x','linkedin','instagram','threads'];
export const platformProvider={X:'x',LinkedIn:'linkedin',Instagram:'instagram',Threads:'threads'};
const config={
 x:{auth:'https://x.com/i/oauth2/authorize',token:'https://api.x.com/2/oauth2/token',scope:'tweet.read tweet.write users.read offline.access',prefix:'X'},
 linkedin:{auth:'https://www.linkedin.com/oauth/v2/authorization',token:'https://www.linkedin.com/oauth/v2/accessToken',scope:'openid profile w_member_social',prefix:'LINKEDIN'},
 instagram:{auth:'https://www.instagram.com/oauth/authorize',token:'https://api.instagram.com/oauth/access_token',scope:'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights',prefix:'INSTAGRAM'},
 threads:{auth:'https://threads.net/oauth/authorize',token:'https://graph.threads.net/oauth/access_token',scope:'threads_basic,threads_content_publish,threads_manage_insights',prefix:'THREADS'}
};
export function providerConfig(env,provider){
 const c=config[provider];if(!c)fail(400,'Rede inválida.');
 if(provider==='instagram'){
  const meta=unifiedInstagramConfig(env);
  if(!/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY||''))fail(503,'Configure TOKEN_ENCRYPTION_KEY.');
  return {...c,clientId:meta.clientId,clientSecret:meta.clientSecret,authMode:'unified'};
 }
 const clientId=env[c.prefix+'_CLIENT_ID'],clientSecret=env[c.prefix+'_CLIENT_SECRET'];
 if(!clientId||!clientSecret||!/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY||''))fail(503,'Configure o aplicativo '+provider+' e a chave de criptografia no servidor.');
 if(provider==='instagram'&&!/^v\d+\.\d+$/.test(env.INSTAGRAM_API_VERSION||''))fail(503,'Configure INSTAGRAM_API_VERSION.');
 if(provider==='linkedin'&&!/^\d{6}$/.test(env.LINKEDIN_VERSION||''))fail(503,'Configure LINKEDIN_VERSION.');
 return {...c,clientId,clientSecret};
}
export function providerReady(env,provider){try{providerConfig(env,provider);return true}catch{return false}}
const redirectURI=(env,provider)=>baseURL(env)+'/api/social/'+provider+'/callback';
export async function connect(env,owner,provider){
 const c=providerConfig(env,provider),state=random(),verifier=random()+random();
 const signed=await sign(env,{sub:owner,provider,state,verifier},'social-oauth',600);
 const url=provider==='instagram'?new URL(unifiedInstagramAuthorize(env,state)):new URL(c.auth);
 if(provider!=='instagram')url.search=new URLSearchParams({client_id:c.clientId,redirect_uri:redirectURI(env,provider),response_type:'code',state,scope:c.scope});
 if(provider==='x'){url.searchParams.set('code_challenge',await hash(verifier));url.searchParams.set('code_challenge_method','S256')}
 return {url:url.href,cookie:cookie('__Host-smezi_oauth',signed,600)};
}
function tokenOptions(c,provider,values){const headers={'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};const data={...values};if(provider==='x')headers.Authorization='Basic '+btoa(encodeURIComponent(c.clientId)+':'+encodeURIComponent(c.clientSecret));else Object.assign(data,{client_id:c.clientId,client_secret:c.clientSecret});if(provider==='instagram'){delete headers['Content-Type'];const form=new FormData();for(const [key,value] of Object.entries(data))form.append(key,value);return {method:'POST',headers,body:form}}return {method:'POST',headers,body:new URLSearchParams(data)}}
async function longLived(provider,c,token){
 if(!['threads','instagram'].includes(provider))return token;
 const url=new URL(provider==='threads'?'https://graph.threads.net/access_token':'https://graph.instagram.com/access_token');
 url.search=new URLSearchParams({grant_type:provider==='threads'?'th_exchange_token':'ig_exchange_token',client_secret:c.clientSecret,access_token:token.access_token});
 return {...token,...await externalJSON(url.href)};
}
export async function socialCallback(request,env,owner,provider){
 const c=providerConfig(env,provider),url=new URL(request.url);
 if(provider==='instagram')await audit(env,owner,'instagram_oauth','callback_received');
 const state=await verify(env,cookies(request)['__Host-smezi_oauth']||'','social-oauth');
 if(state.sub!==owner||state.provider!==provider||state.state!==url.searchParams.get('state')||!url.searchParams.get('code'))fail(400,'Conexão expirada ou não autorizada.');
 let token=provider==='instagram'?await exchangeUnifiedInstagram(env,url.searchParams.get('code')):await externalJSON(c.token,tokenOptions(c,provider,{grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:redirectURI(env,provider),...(provider==='x'?{code_verifier:state.verifier}:{})}));
 if(!token.access_token)fail(502,'O provedor não forneceu credenciais.');
 if(provider==='instagram')await audit(env,owner,'instagram_oauth','token_exchanged');
 if(provider!=='instagram')token=await longLived(provider,c,token);
 const headers={Authorization:'Bearer '+token.access_token};let account;
 if(provider==='x'){const result=await externalJSON('https://api.x.com/2/users/me',{headers});account={id:result.data?.id,label:result.data?.username}}
 if(provider==='linkedin'){const result=await externalJSON('https://api.linkedin.com/v2/userinfo',{headers});account={id:result.sub,label:result.name}}
 if(provider==='threads'){const result=await externalJSON('https://graph.threads.net/v1.0/me?fields=id,username',{headers});account={id:result.id,label:result.username}}
 if(provider==='instagram'){
  const verified=await identifyUnifiedInstagram(env,token);
  await audit(env,owner,'instagram_oauth','account_verified');
  account={id:verified.id,label:verified.label};token=verified.token;token.valid_until=verified.expiresAt;
 }
 if(!account?.id)fail(502,'Não foi possível identificar a conta autorizada.');
 const expires=provider==='instagram'?token.valid_until:Date.now()+Math.max(0,Number(token.expires_in)||3600)*1000;
 await statement(env,'INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET account_id=excluded.account_id,label=excluded.label,encrypted_token=excluded.encrypted_token,expires_at=excluded.expires_at,updated_at=excluded.updated_at',owner,provider,String(account.id),String(account.label||account.id),await seal(env,token,owner+':'+provider),expires,now()).run();
 await audit(env,owner,'connect',provider);
 if(provider==='instagram')await audit(env,owner,'instagram_oauth','connection_saved');
 return new Response(null,{status:302,headers:{Location:baseURL(env)+'/#connections','Set-Cookie':cookie('__Host-smezi_oauth','',0),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function connection(env,owner,provider){
 const row=await statement(env,'SELECT * FROM connections WHERE owner=? AND provider=?',owner,provider).first();if(!row)fail(409,'Conecte sua conta '+provider+' primeiro.');
 const token=await unseal(env,row.encrypted_token,owner+':'+provider);
 if(row.expires_at<Date.now()+600000){
  const c=providerConfig(env,provider);let fresh;
  if(provider==='x'&&token.refresh_token)fresh=await externalJSON(c.token,tokenOptions(c,provider,{grant_type:'refresh_token',refresh_token:token.refresh_token}));
  else if(provider==='instagram'&&token.auth_mode==='instagram_unified'){
   if(row.expires_at<Date.now())fail(409,'Reconecte o Instagram: token expirado.');
   // No old instagram.com token refresh for Meta system-user credentials.
  }
  else if(['threads','instagram'].includes(provider)&&row.expires_at>Date.now()){
   const url=new URL(provider==='threads'?'https://graph.threads.net/refresh_access_token':'https://graph.instagram.com/refresh_access_token');url.search=new URLSearchParams({grant_type:provider==='threads'?'th_refresh_token':'ig_refresh_token',access_token:token.access_token});fresh=await externalJSON(url.href);
  }else if(row.expires_at<Date.now())fail(409,'A conexão expirou. Reconecte '+provider+'.');
  if(fresh?.access_token){Object.assign(token,fresh);await statement(env,'UPDATE connections SET encrypted_token=?,expires_at=?,updated_at=? WHERE owner=? AND provider=?',await seal(env,token,owner+':'+provider),Date.now()+Number(fresh.expires_in||3600)*1000,now(),owner,provider).run()}
 }
 return {accountId:row.account_id,token:token.access_token};
}
export async function prepareMedia(env,provider,account,text,mediaURL){
 if(provider==='instagram')fail(503,'Envio de mídia Instagram Unified Login ainda não habilitado.');
 if(!['instagram','threads'].includes(provider))return null;
 const base=provider==='threads'?'https://graph.threads.net/v1.0':'https://graph.instagram.com/'+env.INSTAGRAM_API_VERSION;
 const values=provider==='threads'?{media_type:'TEXT',text,auto_publish_text:'false'}:{image_url:mediaURL,caption:text};
 const result=await externalJSON(base+'/'+encodeURIComponent(account.accountId)+(provider==='threads'?'/threads':'/media'),{method:'POST',headers:{Authorization:'Bearer '+account.token,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});
 if(!result.id)fail(502,'O provedor não confirmou o contêiner.');return String(result.id);
}
export async function mediaReady(env,provider,account,containerId){
 const base=provider==='threads'?'https://graph.threads.net/v1.0':'https://graph.instagram.com/'+env.INSTAGRAM_API_VERSION;
 const field=provider==='threads'?'status':'status_code';const result=await externalJSON(base+'/'+encodeURIComponent(containerId)+'?fields='+field,{headers:{Authorization:'Bearer '+account.token}});
 if(['ERROR','EXPIRED'].includes(result[field]))fail(422,'A rede recusou ou expirou a mídia.');return result[field]==='FINISHED';
}
export async function publish(env,provider,account,post,containerId){
 if(provider==='instagram')fail(503,'Publicação Instagram Unified Login ainda não habilitada.');
 const headers={Authorization:'Bearer '+account.token};let response,data;
 if(provider==='x'){
  response=await external('https://api.x.com/2/tweets',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({text:post.text})});data=await response.json();return data.data?.id;
 }
 if(provider==='linkedin'){
  response=await external('https://api.linkedin.com/rest/posts',{method:'POST',headers:{...headers,'Content-Type':'application/json','LinkedIn-Version':env.LINKEDIN_VERSION,'X-Restli-Protocol-Version':'2.0.0'},body:JSON.stringify({author:'urn:li:person:'+account.accountId,commentary:post.text,visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false})});return response.headers.get('x-restli-id');
 }
 const base=provider==='threads'?'https://graph.threads.net/v1.0':'https://graph.instagram.com/'+env.INSTAGRAM_API_VERSION;
 data=await externalJSON(base+'/'+encodeURIComponent(account.accountId)+(provider==='threads'?'/threads_publish':'/media_publish'),{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({creation_id:containerId})});return data.id;
}
export async function metrics(env,owner,job){
 if(job.provider==='instagram')fail(503,'Métricas Instagram Unified Login ainda não habilitadas.');
 const account=await connection(env,owner,job.provider),headers={Authorization:'Bearer '+account.token};
 if(job.provider==='x'){const result=await externalJSON('https://api.x.com/2/tweets/'+encodeURIComponent(job.remote_id)+'?tweet.fields=public_metrics',{headers});return result.data?.public_metrics||{}}
 if(job.provider==='threads'){const result=await externalJSON('https://graph.threads.net/v1.0/'+encodeURIComponent(job.remote_id)+'/insights?metric=views,likes,replies,reposts,quotes',{headers});return result.data}
 if(job.provider==='instagram'){const result=await externalJSON('https://graph.instagram.com/'+env.INSTAGRAM_API_VERSION+'/'+encodeURIComponent(job.remote_id)+'/insights?metric=views,reach,likes,comments,saved,shares',{headers});return result.data}
 fail(501,'As métricas de posts pessoais LinkedIn dependem de produto e permissões adicionais; ainda não estão integradas.');
}
