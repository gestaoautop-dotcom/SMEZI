import {externalJSON,fail,seal,unseal} from './security.mjs';
import {statement,now,audit} from './store.mjs';

export async function findCwsFacebookPage(env,accessToken,instagramId){
 const version=env.META_API_VERSION;
 if(!/^v\d+\.\d+$/.test(version||''))fail(503,'Configure a versão da API Meta.');
 const url='https://graph.facebook.com/'+version+'/me/accounts?fields=id,name,instagram_business_account{id,username}&limit=100';
 const result=await externalJSON(url,{headers:{Authorization:'Bearer '+accessToken}});
 if(result.paging?.next)fail(409,'Lista de páginas incompleta.');
 if(!Array.isArray(result.data))fail(409,'A Meta não retornou lista válida de Páginas.');
 const pages=(result.data||[]).filter(page=>page.name==='CWS'&&String(page.instagram_business_account?.id)===String(instagramId));
 if(pages.length!==1)fail(409,'A Meta não confirmou uma única Página CWS vinculada ao Instagram.');
 return {id:String(pages[0].id),name:'CWS'};
}

export async function connectCwsPage(env,owner){
 const ig=await statement(env,"SELECT account_id,encrypted_token,expires_at FROM connections WHERE owner=? AND provider='instagram'",owner).first();
 if(!ig||Number(ig.expires_at)<=Date.now())fail(409,'Instagram não está conectado ou a autorização expirou.');
 const token=await unseal(env,ig.encrypted_token,owner+':instagram');
 const granted=new Set(token.granted_scopes||[]);
 const missing=['pages_show_list','pages_read_engagement'].filter(scope=>!granted.has(scope));
 if(missing.length)fail(409,'A autorização Meta não concedeu: '+missing.join(', '));
 const page=await findCwsFacebookPage(env,token.access_token,ig.account_id);
 await statement(env,'INSERT INTO connections(owner,provider,account_id,label,encrypted_token,expires_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET account_id=excluded.account_id,label=excluded.label,encrypted_token=excluded.encrypted_token,expires_at=excluded.expires_at,updated_at=excluded.updated_at',owner,'facebook',page.id,page.name,await seal(env,{access_token:token.access_token,auth_mode:'facebook_page_unified',granted_scopes:[...granted]},owner+':facebook'),ig.expires_at,now()).run();
 await audit(env,owner,'connect','facebook');
 return {connected:true,accountLabel:page.name};
}
