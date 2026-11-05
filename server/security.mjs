import { SignJWT, jwtVerify } from 'jose';
export class AppError extends Error { constructor(status, message) { super(message); this.status=status; } }
export const fail=(status,message)=>{throw new AppError(status,message)};
export const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export const cookie=(name,value,age=28800)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export function cookies(request){return Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(x=>x.trim().split('=' )).filter(x=>x.length===2));}
export function baseURL(env){
  let url;try{url=new URL(env.APP_ORIGIN)}catch{fail(503,'Configure APP_ORIGIN no servidor.')}
  if(url.protocol!=='https:'||url.origin!==env.APP_ORIGIN)fail(503,'APP_ORIGIN deve ser uma origem HTTPS sem barra final.');
  return url.origin;
}
export function signingKey(env){if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)fail(503,'Configure SESSION_SECRET com ao menos 32 caracteres.');return new TextEncoder().encode(env.SESSION_SECRET);}
export async function sign(env,payload,purpose,age=28800){return new SignJWT({...payload,purpose}).setProtectedHeader({alg:'HS256'}).setIssuer(baseURL(env)).setAudience('smezi-content-engine').setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+age).sign(signingKey(env));}
export async function verify(env,token,purpose){try{const {payload}=await jwtVerify(token,signingKey(env),{algorithms:['HS256'],issuer:baseURL(env),audience:'smezi-content-engine'});if(payload.purpose!==purpose)fail(401,'Sessão inválida.');return payload}catch{fail(401,'Entre novamente para continuar.')}}
export async function identity(request,env){
  if(!env.GITHUB_ALLOWED_ID)fail(503,'Configure a conta autorizada no servidor.');
  const token=cookies(request)['__Host-smezi_session'];if(!token)fail(401,'Entre com sua conta GitHub.');
  const user=await verify(env,token,'session');if(user.sub!==String(env.GITHUB_ALLOWED_ID))fail(403,'Conta sem acesso.');return user;
}
export function sameOrigin(request,env){if(request.headers.get('Origin')!==baseURL(env))fail(403,'Origem não autorizada.');if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'Envie JSON.');}
export async function body(request,max=1000000){
  if(Number(request.headers.get('Content-Length'))>max)fail(413,'Arquivo muito grande.');
  const reader=request.body?.getReader();if(!reader)fail(400,'Corpo vazio.');let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'Arquivo muito grande.')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  try{return JSON.parse(new TextDecoder().decode(bytes))}catch{fail(400,'JSON inválido.')}
}
export const random=()=>crypto.randomUUID();
export const b64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function hash(text){return b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}
export async function vaultKey(env){if(!/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY||''))fail(503,'Configure TOKEN_ENCRYPTION_KEY (32 bytes em hexadecimal).');return crypto.subtle.importKey('raw',Uint8Array.from(env.TOKEN_ENCRYPTION_KEY.match(/../g),x=>parseInt(x,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(env,value,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(aad)},await vaultKey(env),new TextEncoder().encode(JSON.stringify(value)));return JSON.stringify({iv:Array.from(iv),data:Array.from(new Uint8Array(data))});}
export async function unseal(env,value,aad){const v=JSON.parse(value);const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv),additionalData:new TextEncoder().encode(aad)},await vaultKey(env),new Uint8Array(v.data));return JSON.parse(new TextDecoder().decode(data));}
export async function secretEqual(a,b){if(!a||!b)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(b),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(b));return crypto.subtle.verify('HMAC',key,sig,new TextEncoder().encode(a));}
export async function external(url,options={}){
  let response;try{response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)})}catch{const e=new AppError(502,'Resposta externa não confirmada.');e.uncertain=true;throw e}
  if(!response.ok){const e=new AppError(502,`Serviço externo retornou HTTP ${response.status}.`);e.externalStatus=response.status;throw e}
  return response;
}
export async function externalJSON(url,options){const response=await external(url,options);let data;try{data=await response.json()}catch{fail(502,'Resposta externa inválida.')}if(data.error)fail(502,'O provedor recusou a operação.');return data;}
