// Fotos dos posts: upload autenticado para o R2 (binding MEDIA) e URL pública não adivinhável,
// exigida pelas redes (Instagram, Facebook, Threads) para buscar a imagem no momento da publicação.
import {fail,baseURL,random} from './security.mjs';
import {statement,now,audit} from './store.mjs';

export const MAX_MEDIA_BYTES=8*1024*1024;
const isJPEG=b=>b.length>3&&b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF;
const bucket=env=>{if(!env.MEDIA)fail(503,'Conecte um bucket R2 com o binding MEDIA para enviar fotos.');return env.MEDIA};
const toHex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');

export function publicMediaURL(env,token){return baseURL(env)+'/m/'+token+'.jpg'}
function view(env,row){return {id:row.id,name:row.name,bytes:row.bytes,createdAt:row.created_at,previewURL:'/api/media/'+row.id,publicURL:publicMediaURL(env,row.public_token)}}

// Corpo binário (image/jpeg). A interface converte qualquer foto para JPEG antes de enviar.
export async function uploadMedia(request,env,owner){
 if(request.headers.get('Origin')!==baseURL(env))fail(403,'Origem não autorizada.');
 if((request.headers.get('Content-Type')||'').split(';')[0].trim()!=='image/jpeg')fail(415,'Envie a foto em JPEG.');
 const declared=Number(request.headers.get('Content-Length'));
 if(declared>MAX_MEDIA_BYTES)fail(413,'Foto acima de 8 MB.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Arquivo vazio.');
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_MEDIA_BYTES){await reader.cancel();fail(413,'Foto acima de 8 MB.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength}
 if(!isJPEG(bytes))fail(415,'O arquivo não é um JPEG válido.');
 const name=String(new URL(request.url).searchParams.get('name')||'').replace(/[^\p{L}\p{N} ._-]/gu,'').slice(0,120);
 const id=random(),token=toHex(crypto.getRandomValues(new Uint8Array(16))),key=`media/${owner}/${id}.jpg`;
 const digest=toHex(await crypto.subtle.digest('SHA-256',bytes));
 await bucket(env).put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 await statement(env,'INSERT INTO media_assets(owner,id,object_key,content_type,bytes,sha256,public_token,name,created_at) VALUES(?,?,?,?,?,?,?,?,?)',owner,id,key,'image/jpeg',size,digest,token,name,now()).run();
 await audit(env,owner,'media_upload',id);
 return view(env,{id,name,bytes:size,created_at:now(),public_token:token});
}
export async function mediaById(env,owner,id){
 if(typeof id!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(id))fail(400,'Mídia inválida.');
 const row=await statement(env,'SELECT * FROM media_assets WHERE owner=? AND id=?',owner,id).first();
 if(!row)fail(404,'Foto não encontrada.');return {...view(env,row),objectKey:row.object_key};
}
export async function listMedia(env,owner){
 return (await statement(env,'SELECT * FROM media_assets WHERE owner=? ORDER BY created_at DESC LIMIT 200',owner).all()).results.map(r=>view(env,r));
}
function imageResponse(object,cache){
 return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':cache,'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'"}});
}
// Pré-visualização autenticada, para a interface.
export async function previewMedia(env,owner,id){
 const media=await mediaById(env,owner,id);const object=await bucket(env).get(media.objectKey);
 if(!object)fail(404,'Arquivo não encontrado no armazenamento.');return imageResponse(object,'private, max-age=300');
}
// URL pública usada pelas redes. Somente GET/HEAD e token de 128 bits.
export async function publicMedia(request,env,file){
 const match=/^([a-f0-9]{32})\.jpg$/.exec(file||'');
 if(!['GET','HEAD'].includes(request.method)||!match)return new Response('Not found',{status:404});
 const row=await statement(env,'SELECT object_key FROM media_assets WHERE public_token=?',match[1]).first();
 if(!row||!env.MEDIA)return new Response('Not found',{status:404});
 const object=await env.MEDIA.get(row.object_key);if(!object)return new Response('Not found',{status:404});
 return imageResponse(object,'public, max-age=86400');
}
