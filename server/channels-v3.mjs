// Leonardo V3: read-only capability registry. Never treats env vars as consent.
// Missing adapters remain explicitly blocked until an official OAuth callback is implemented.
const channels=[
 {id:'facebook',label:'Facebook Pages',mode:'page',required:['META_APP_ID','META_APP_SECRET','META_API_VERSION'],implemented:false,next:'Preparar leitura segura da Página CWS usando autorização Meta já concedida; sem publicação.'},
 {id:'instagram',label:'Instagram Professional',mode:'professional',required:['META_APP_ID','META_APP_SECRET','META_API_VERSION','INSTAGRAM_UNIFIED_CONFIG_ID'],implemented:true,next:'Login unificado Meta: autorizar conta profissional, verificar permissões e ativo. Publicação permanece desativada.'},
 {id:'linkedin',label:'LinkedIn pessoal',mode:'personal',required:['LINKEDIN_CLIENT_ID','LINKEDIN_CLIENT_SECRET','LINKEDIN_VERSION'],implemented:true,next:'Conta pessoal autorizada; a publicação de mídia será implementada separadamente.'},
 {id:'threads',label:'Threads',mode:'account',required:['THREADS_CLIENT_ID','THREADS_CLIENT_SECRET'],implemented:true,next:'Criar aplicativo Threads, adicionar callback e scopes oficiais.'},
 {id:'tiktok',label:'TikTok',mode:'creator',required:['TIKTOK_CLIENT_KEY','TIKTOK_CLIENT_SECRET'],implemented:false,next:'Cadastrar TikTok Login Kit e Content Posting API; autorização e auditoria podem ser necessárias.'},
 {id:'x',label:'X',mode:'personal',required:['X_CLIENT_ID','X_CLIENT_SECRET'],implemented:true,next:'Configurar OAuth 2.0, callback e acesso de postagem no plano da API.'},
 {id:'youtube',label:'YouTube',mode:'channel',required:['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET'],implemented:false,next:'Configurar projeto Google Cloud, OAuth e permissão youtube.upload.'},
 {id:'blog',label:'Blog CWS / SMEZI',mode:'cms',required:[],implemented:false,next:'Definir o CMS e credenciais específicas de cada blog; não há OAuth genérico.'}
];
export function channelRegistry(env,connections=[]){
 const keyValid=/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY||'');
 return channels.map(c=>{
  const connected=connections.find(row=>row.provider===c.id);
  const missing=c.required.filter(name=>!env[name]);
  const configurationReady=missing.length===0&&keyValid&&c.id!=='blog';
  const available=c.implemented&&configurationReady;
  return {
   id:c.id,label:c.label,mode:c.mode,adapterImplemented:c.implemented,
   credentialsConfigured:missing.length===0,cryptoReady:keyValid,connectEnabled:available,
   connected:!!connected,accountLabel:connected?.label||null,expiresAt:connected?.expires_at||null,
   state:connected?'connected':available?'ready_to_authorize':c.implemented?'needs_configuration':'adapter_pending',
   next:c.next,
   callback:c.implemented?'/api/social/'+c.id+'/callback':null,
   requiredVariableNames:c.required,
   // Do not infer API scope grants or publishing rights from the presence of keys.
   publishingVerified:false
  };
 });
}
