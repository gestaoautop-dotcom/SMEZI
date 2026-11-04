import {baseURL,externalJSON,fail} from './security.mjs';

// Meta's 2026 Unified Login uses Facebook Login for Business, not instagram.com OAuth.
// This module never reads or modifies META_ACCESS_TOKEN (Meta Ads read-only integration).
export function unifiedInstagramConfig(env){
 const clientId=env.META_APP_ID,clientSecret=env.META_APP_SECRET;
 const configId=env.INSTAGRAM_UNIFIED_CONFIG_ID,version=env.META_API_VERSION;
 if(!/^\d+$/.test(clientId||'')||!clientSecret||!/^\d+$/.test(configId||'')||!/^v\d+\.\d+$/.test(version||'')){
  fail(503,'Configure META_APP_ID, META_APP_SECRET, INSTAGRAM_UNIFIED_CONFIG_ID e META_API_VERSION em Production.');
 }
 return {clientId,clientSecret,configId,version};
}
export function unifiedInstagramAuthorize(env,state){
 const {clientId,configId,version}=unifiedInstagramConfig(env);
 const uri=baseURL(env)+'/api/social/instagram/callback';
 const url=new URL('https://www.facebook.com/'+version+'/dialog/oauth');
 url.search=new URLSearchParams({
  client_id:clientId,config_id:configId,redirect_uri:uri,
  response_type:'code',override_default_response_type:'true',state
 });
 // Permissions are chosen in the Meta configuration; never inject scope here.
 return url.href;
}
export async function exchangeUnifiedInstagram(env,code){
 const {clientId,clientSecret,version}=unifiedInstagramConfig(env);
 const redirectUri=baseURL(env)+'/api/social/instagram/callback';
 return externalJSON('https://graph.facebook.com/'+version+'/oauth/access_token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,code})
 });
}
export async function identifyUnifiedInstagram(env,token){
 const {clientId,clientSecret,version}=unifiedInstagramConfig(env);
 if(!token?.access_token)fail(502,'A Meta não retornou o token do login unificado.');
 // Verify the Meta app and actual grants before persisting any token.
 const debugUrl=new URL('https://graph.facebook.com/'+version+'/debug_token');
 debugUrl.searchParams.set('input_token',token.access_token);
 const checked=await externalJSON(debugUrl.href,{headers:{Authorization:'Bearer '+clientId+'|'+clientSecret}});
 const d=checked.data||{};
 if(d.is_valid!==true||String(d.app_id)!==String(clientId))fail(403,'A Meta não confirmou um token válido para este aplicativo.');
 const scopes=new Set([...(d.scopes||[]),...(d.granular_scopes||[]).map(x=>x.scope)]);
 if(!scopes.has('instagram_basic')||!scopes.has('instagram_content_publish'))fail(403,'A Meta não concedeu as permissões de identificação e publicação do Instagram.');
 const bearer={Authorization:'Bearer '+token.access_token};
 const assets=await externalJSON('https://graph.facebook.com/'+version+'/me/assigned_instagram_accounts?fields=id,username&limit=25',{headers:bearer});
 const candidates=(Array.isArray(assets.data)?assets.data:[]).filter(x=>/^\d+$/.test(String(x.id||'')));
 if(candidates.length===0)fail(409,'IG_ASSET_EMPTY: A Meta não retornou contas Instagram atribuídas ao usuário do sistema. Confirme a propriedade e atribuição da conta cws_work no portfólio Caroline.');
 if(candidates.length!==1||assets.paging?.next)fail(409,'IG_ASSET_MULTIPLE: A Meta retornou várias contas. Selecione uma única conta para o primeiro vínculo.');
 const account=candidates[0];
 // Confirm the selected asset is accessible with this token, instead of trusting the list alone.
 const selected=await externalJSON('https://graph.facebook.com/'+version+'/'+encodeURIComponent(String(account.id))+'?fields=id,username',{headers:bearer});
 if(String(selected.id)!==String(account.id))fail(409,'IG_ASSET_MISMATCH: A Meta não confirmou o identificador da conta selecionada.');
 const maxMs=253402300799000;
 const absolute=Number(d.expires_at)||0;
 const seconds=Number(token.expires_in)||0;
 const expiresAt=absolute>0?Math.min(maxMs,absolute*1000):seconds>0?Date.now()+seconds*1000:maxMs;
 return {id:String(selected.id),label:String(selected.username||account.username||selected.id),expiresAt,
  token:{access_token:token.access_token,auth_mode:'instagram_unified',granted_scopes:[...scopes]}};
}
