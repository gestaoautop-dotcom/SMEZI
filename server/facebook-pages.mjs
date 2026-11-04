import {externalJSON,fail} from './security.mjs';

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
