import {baseURL,sign,verify,cookie,cookies,random,hash,externalJSON,fail,json} from './security.mjs';
export function authConfiguration(env){
 return {
  origin: Boolean(env.APP_ORIGIN),
  clientId: Boolean(env.GITHUB_CLIENT_ID),
  clientSecret: Boolean(env.GITHUB_CLIENT_SECRET),
  allowedId: Boolean(env.GITHUB_ALLOWED_ID),
  sessionSecretValid: typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32
 };
}
export function authReady(env){return Object.values(authConfiguration(env)).every(Boolean)}
export async function login(request,env){
 if(!authReady(env))fail(503,'O login ainda precisa ser configurado no Cloudflare.');
 const state=random(),verifier=random()+random();
 const token=await sign(env,{state,verifier},'github-login',600);
 const url=new URL('https://github.com/login/oauth/authorize');
 url.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:baseURL(env)+'/api/auth/callback',scope:'read:user',state,code_challenge:await hash(verifier),code_challenge_method:'S256',allow_signup:'false'});
 return new Response(null,{status:302,headers:{Location:url.href,'Set-Cookie':cookie('__Host-smezi_login',token,600),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function callback(request,env){
 const url=new URL(request.url),state=await verify(env,cookies(request)['__Host-smezi_login']||'','github-login');
 if(!url.searchParams.get('state')||url.searchParams.get('state')!==state.state||!url.searchParams.get('code'))fail(400,'Autorização inválida ou expirada.');
 const token=await externalJSON('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:baseURL(env)+'/api/auth/callback',code_verifier:state.verifier})});
 if(!token.access_token)fail(401,'GitHub não autorizou o login.');
 const user=await externalJSON('https://api.github.com/user',{headers:{Authorization:'Bearer '+token.access_token,Accept:'application/vnd.github+json','User-Agent':'SMEZI-Content-Engine'}});
 if(String(user.id)!==String(env.GITHUB_ALLOWED_ID))fail(403,'Esta conta não está autorizada.');
 const session=await sign(env,{sub:String(user.id),login:user.login},'session');
 const headers=new Headers({Location:baseURL(env)+'/#connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 headers.append('Set-Cookie',cookie('__Host-smezi_session',session));headers.append('Set-Cookie',cookie('__Host-smezi_login','',0));return new Response(null,{status:302,headers});
}
export function logout(){const r=json({ok:true});r.headers.set('Set-Cookie',cookie('__Host-smezi_session','',0));return r}
