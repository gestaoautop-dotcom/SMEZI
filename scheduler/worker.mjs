// Dedicated Worker: Cron Trigger once a minute. It never receives user tokens.
export default {
 async scheduled(event,env,ctx){
  if(!env.APP_ORIGIN||!env.CRON_SECRET||!env.DB)throw Error('Configure APP_ORIGIN, CRON_SECRET e DB no agendador.');
  const response=await fetch(env.APP_ORIGIN+'/api/internal/tick',{method:'POST',headers:{Authorization:'Bearer '+env.CRON_SECRET}});
  if(!response.ok)throw Error('Content Engine scheduler failed: HTTP '+response.status);
  await env.DB.prepare('INSERT INTO scheduler_heartbeat(id,updated_at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at').bind('scheduler',new Date().toISOString()).run();
 }
};
