import {AppError,fail,json,identity,sameOrigin,body,baseURL,secretEqual,random} from './security.mjs';
import {channelRegistry} from './channels-v3.mjs';
import {authReady,authConfiguration,login,callback,logout} from './auth.mjs';
import {database,statement,snapshot,sync,approve,saveClient,createBackup,quota,now} from './store.mjs';
import {PROVIDERS,providerReady,connect,socialCallback,metrics} from './social.mjs';
import {schedule,cancel,tick} from './queue.mjs';
import {generate} from './ai.mjs';
import {metaReady,metaAccount,metaCampaigns,metaInsights} from './meta-ads.mjs';
import {collectAds,historyAds,reviewsAds,decideAds} from './leonardo-ads.mjs';
const features=env=>({authentication:authReady(env),database:!!env.DB,backups:!!env.BACKUPS,ai:!!((env.AI||env.ai)&&env.AI_MODEL),publishing:env.PUBLISHING_ENABLED==='true',scheduler:env.SCHEDULER_ENABLED==='true',providers:Object.fromEntries(PROVIDERS.map(p=>[p,providerReady(env,p)])),metaAds:{configured:metaReady(env),mode:'read-only'}});
export async function handle(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 try{
  if(path.startsWith('/r/'))return await trackedRedirect(request,env,path.slice(3));
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(path==='/api/status'&&method==='GET'){
   let user=null;try{user=await identity(request,env)}catch{}
   return json({version:2,user:user?{login:user.login,id:user.sub}:null,features:features(env),productionOrigin:env.APP_ORIGIN||null,requestOrigin:url.origin,originMatchesProduction:url.origin===env.APP_ORIGIN,authChecks:authConfiguration(env)});
  }
  if(url.origin!==baseURL(env)){
   if(path==='/api/auth/login'&&method==='GET'){
    return new Response(null,{status:302,headers:{Location:baseURL(env)+'/api/auth/login','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
   }
   fail(403,'Use a origem de produção para acessar os serviços privados.');
  }
  if(path==='/api/internal/tick'&&method==='POST'){
   if(!env.CRON_SECRET||env.CRON_SECRET.length<32||!await secretEqual(request.headers.get('Authorization'), 'Bearer '+env.CRON_SECRET))fail(401,'Não autorizado.');
   database(env);return json(await tick(env));
  }
  if(path==='/api/auth/login'&&method==='GET')return await login(request,env);
  if(path==='/api/auth/callback'&&method==='GET')return await callback(request,env);
  const user=await identity(request,env),owner=user.sub;
  if(!['GET','HEAD'].includes(method))sameOrigin(request,env);
  if(path==='/api/auth/logout'&&method==='POST')return logout();
  if(path==='/api/diagnostics/linkedin'&&method==='GET'){
   const checks={
    clientIdPresent:typeof env.LINKEDIN_CLIENT_ID==='string'&&env.LINKEDIN_CLIENT_ID.length>0,
    clientSecretPresent:typeof env.LINKEDIN_CLIENT_SECRET==='string'&&env.LINKEDIN_CLIENT_SECRET.length>0,
    versionValid:/^\d{6}$/.test(env.LINKEDIN_VERSION||''),
    encryptionKeyValid:/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY||'')
   };
   const response=json({ready:Object.values(checks).every(Boolean),checks,notes:'Boolean checks only; no credentials or raw values are returned.'});
   response.headers.set('Cache-Control','no-store');
   return response;
  }

  if(path==='/api/diagnostics/instagram'&&method==='GET'){
   const checks={
    appIdPresent:typeof env.META_APP_ID==='string'&&env.META_APP_ID.length>0,
    appIdNumeric:/^\d+$/.test(env.META_APP_ID||''),
    appSecretPresent:typeof env.META_APP_SECRET==='string'&&env.META_APP_SECRET.length>0,
    unifiedConfigIdValid:/^\d+$/.test(env.INSTAGRAM_UNIFIED_CONFIG_ID||''),
    apiVersionValid:/^v\d+\.\d+$/.test(env.META_API_VERSION||''),
    encryptionKeyValid:/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY||'')
   };
   return json({ready:Object.values(checks).every(Boolean),checks,notes:'Authenticated diagnostic; only boolean validations are returned. No credentials are exposed.'});
  }
  database(env);
  if(path==='/api/channels/v3'&&method==='GET'){
   const rows=await statement(env,'SELECT provider,label,expires_at FROM connections WHERE owner=?',owner).all();
   const response=json({version:3,publishingEnabled:false,channels:channelRegistry(env,rows.results)});
   response.headers.set('Cache-Control','no-store');return response;
  }
  if(path==='/api/meta/account'&&method==='GET')return json(await metaAccount(env));
  if(path==='/api/meta/campaigns'&&method==='GET')return json(await metaCampaigns(env));
  if(path==='/api/meta/insights'&&method==='GET')return json(await metaInsights(env, url.searchParams.get('days') || '7'));
  if(path==='/api/meta/analysis'&&method==='GET')return json(await collectAds(env,owner,url.searchParams.get('days')||'7'));
  if(path==='/api/meta/history'&&method==='GET')return json(await historyAds(env,owner,url.searchParams.get('days')||'7'));
  if(path==='/api/meta/reviews'&&method==='GET')return json(await reviewsAds(env,owner));
  if(path==='/api/meta/reviews/decision'&&method==='POST'){
   const input=await body(request);return json(await decideAds(env,owner,input.id,input.decision));
  }
  if(path==='/api/state'&&method==='GET'){
   const data=await snapshot(env,owner);
   const [clients,jobs,approvals,connections,metricsData,clicks,heartbeat]=await Promise.all([
    statement(env,'SELECT * FROM clients WHERE owner=? ORDER BY updated_at DESC LIMIT 1000',owner).all(),
    statement(env,'SELECT id,record_id,provider,status,scheduled_at,remote_id,error,updated_at FROM jobs WHERE owner=? ORDER BY updated_at DESC LIMIT 1000',owner).all(),
    statement(env,'SELECT record_id,digest,approved_at FROM approvals WHERE owner=?',owner).all(),
    statement(env,'SELECT provider,label,expires_at,updated_at FROM connections WHERE owner=?',owner).all(),
    statement(env,'SELECT job_id,payload,collected_at FROM metric_snapshots WHERE owner=? ORDER BY id DESC LIMIT 30',owner).all(),
    statement(env,'SELECT l.token,l.record_id,l.target,COALESCE(SUM(c.count),0) AS clicks FROM tracked_links l LEFT JOIN click_counts c ON c.token=l.token WHERE l.owner=? GROUP BY l.token ORDER BY l.created_at DESC LIMIT 100',owner).all(),
    statement(env,"SELECT updated_at FROM scheduler_heartbeat WHERE id='scheduler'").first()
   ]);
   return json({data,clients:clients.results,jobs:jobs.results,approvals:approvals.results,connections:connections.results,metrics:metricsData.results,links:clicks.results,schedulerLastSeen:heartbeat?.updated_at||null});
  }
  if(path==='/api/sync'&&method==='POST')return json(await sync(env,owner,await body(request,5000000)));
  if(path==='/api/approve'&&method==='POST')return json(await approve(env,owner,(await body(request)).recordId));
  if(path==='/api/generate'&&method==='POST'){
   const result=await generate(env,owner,await body(request));
   await sync(env,owner,{memories:[],ideas:[result.idea],posts:[result.post]});return json(result);
  }
  if(path==='/api/clients'&&method==='POST')return json(await saveClient(env,owner,await body(request)));
  if(path.match(/^\/api\/clients\/[^/]+\/history$/)&&method==='GET')return json((await statement(env,'SELECT payload,created_at FROM client_history WHERE owner=? AND client_id=? ORDER BY id DESC LIMIT 100',owner,decodeURIComponent(path.split('/')[3])).all()).results);
  if(path==='/api/jobs'&&method==='POST')return json(await schedule(env,owner,await body(request)),201);
  if(path.match(/^\/api\/jobs\/[^/]+\/cancel$/)&&method==='POST')return json(await cancel(env,owner,path.split('/')[3]));
  if(path==='/api/backups'&&method==='POST'){
   await quota(env,owner,'backup',30);return json({key:await createBackup(env,owner)});
  }
  if(path==='/api/backups'&&method==='GET'){
   if(!env.BACKUPS)fail(503,'Conecte R2 BACKUPS.');const list=await env.BACKUPS.list({prefix:'backups/'+owner+'/',limit:100});return json(list.objects.map(x=>({key:x.key,size:x.size,uploaded:x.uploaded})));
  }
  if(path==='/api/backups/restore'&&method==='POST'){
   const {key}=await body(request);if(typeof key!=='string'||!key.startsWith('backups/'+owner+'/'))fail(403,'Backup de outra conta.');if(!env.BACKUPS)fail(503,'Conecte R2 BACKUPS.');
   const object=await env.BACKUPS.get(key);if(!object)fail(404,'Backup não encontrado.');if(object.size>5000000)fail(413,'Backup acima do limite.');const backup=await object.json();if(backup.app!=='smezi-content-engine')fail(400,'Backup incompatível.');return json(await sync(env,owner,backup.data));
  }
  if(path==='/api/links'&&method==='POST'){
   const input=await body(request);let target;try{target=new URL(input.target)}catch{fail(400,'Destino inválido.')}if(target.protocol!=='https:'||target.username||target.password||target.href.length>2000)fail(400,'Use uma URL HTTPS.');
   if(!await statement(env,"SELECT id FROM records WHERE owner=? AND collection='posts' AND id=?",owner,input.recordId).first())fail(404,'Publicação não encontrada.');
   const token=random().replaceAll('-','');await statement(env,'INSERT INTO tracked_links(token,owner,record_id,target,created_at) VALUES(?,?,?,?,?)',token,owner,input.recordId,target.href,now()).run();return json({url:baseURL(env)+'/r/'+token});
  }
  const social=path.match(/^\/api\/social\/(x|linkedin|instagram|threads)\/(connect|callback|disconnect)$/);
  if(social){
   const [,provider,action]=social;
   if(action==='connect'&&method==='POST'){const result=await connect(env,owner,provider);const response=json({url:result.url});response.headers.set('Set-Cookie',result.cookie);return response;}
   if(action==='callback'&&method==='GET')return await socialCallback(request,env,owner,provider);
   if(action==='disconnect'&&method==='POST'){
    await database(env).batch([statement(env,'DELETE FROM connections WHERE owner=? AND provider=?',owner,provider),statement(env,"UPDATE jobs SET status='cancelled',error='Conexão removida.',updated_at=? WHERE owner=? AND provider=? AND status='pending'",now(),owner,provider)]);return json({ok:true});
   }
  }
  if(path==='/api/metrics'&&method==='POST'){
   const {jobId}=await body(request);const job=await statement(env,"SELECT * FROM jobs WHERE owner=? AND id=? AND status='published'",owner,jobId).first();if(!job)fail(404,'Publicação enviada não encontrada.');await quota(env,owner,'metrics',100);
   const result=await metrics(env,owner,job);await statement(env,'INSERT INTO metric_snapshots(owner,job_id,payload,collected_at) VALUES(?,?,?,?)',owner,jobId,JSON.stringify(result),now()).run();return json({metrics:result,collectedAt:now()});
  }
  if(path==='/api/recommendations'&&method==='GET'){
   const clients=(await statement(env,"SELECT source_post_id,COUNT(*) AS leads FROM clients WHERE owner=? AND source_post_id<>'' GROUP BY source_post_id ORDER BY leads DESC LIMIT 5",owner).all()).results;
   return json({recommendations:clients.map(x=>({recordId:x.source_post_id,text:`Esta publicação originou ${x.leads} contato(s) registrado(s). Explore um novo ângulo da mesma solução, com um exemplo real.`})),note:clients.length?'Sugestões baseadas na atribuição manual do CRM, sem inferir causalidade.':'Vincule contatos às publicações no CRM para receber sugestões com base em dados reais.'});
  }
  fail(404,'Rota não encontrada.');
 }catch(error){return json({error:error instanceof AppError?error.message:'Não foi possível concluir a operação. Verifique as migrações e os serviços no painel.'},error instanceof AppError?error.status:500)}
}
async function trackedRedirect(request,env,token){
 if(!['GET','HEAD'].includes(request.method)||!/^[a-f0-9]{32}$/.test(token))fail(404,'Link não encontrado.');
 const row=await statement(env,'SELECT target FROM tracked_links WHERE token=?',token).first();if(!row)fail(404,'Link não encontrado.');
 if(request.method==='GET')await statement(env,'INSERT INTO click_counts(token,day,count) VALUES(?,?,1) ON CONFLICT(token,day) DO UPDATE SET count=count+1',token,new Date().toISOString().slice(0,10)).run();
 return new Response(null,{status:302,headers:{Location:row.target,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}});
}
export default {fetch:handle};
