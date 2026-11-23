import {fail} from './security.mjs';
import {statement,now} from './store.mjs';
import {metaAccount,metaCampaigns,metaInsights} from './meta-ads.mjs';

const allowedPeriods = new Set([7,14,30]);
const safeValue = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
const clean = value => String(value || '').slice(0,500);

export function suggestAds(campaigns, insights) {
 const rows = Array.isArray(insights.rows) ? insights.rows : [];
 const byId = new Map(rows.map(x=>[String(x.campaign_id),x]));
 const output = [];
 for (const campaign of campaigns.campaigns || []) {
  const row = byId.get(String(campaign.id));
  if (!row) continue;
  const impressions=safeValue(row.impressions),clicks=safeValue(row.clicks),spend=safeValue(row.spend),leads=safeValue(row.leads);
  const evidence = {campaignId:String(campaign.id),period:insights.range,impressions,clicks,spend,leads};
  const base = {campaign_id:String(campaign.id),evidence:JSON.stringify(evidence)};
  // Deliberately avoid conclusions from small samples or unverified conversions.
  if (impressions !== null && impressions < 1000) {
   output.push({...base,rule:'small_sample',title:'Amostra inicial — acompanhar antes de alterar',
    explanation:'A campanha tem menos de 1.000 impressões neste intervalo; não é suficiente para uma conclusão confiável.',
    proposed_action:'Acompanhar cliques no link, visitas à página de destino e contatos reais antes de propor alterações.'});
  } else if (impressions !== null && clicks !== null && impressions >= 1000 && impressions > 0 && clicks / impressions < 0.01) {
   output.push({...base,rule:'low_total_ctr',title:'Revisar mensagem e criativo',
    explanation:'A relação de cliques totais por impressões está abaixo de 1% nesta janela. Cliques totais não equivalem a cliques no link.',
    proposed_action:'Preparar duas versões de criativo editorial para revisão, sem substituir o anúncio atual.'});
  }
  if (clicks !== null && clicks >= 20 && leads === 0) {
   output.push({...base,rule:'conversion_check',title:'Verificar jornada até o contato',
    explanation:'A Meta reportou cliques, mas nenhum evento de lead entre os tipos consultados. Isso não prova ausência de contatos.',
    proposed_action:'Conferir eventos de conversão, cliques no link, página de destino e CRM antes de recomendar mudanças.'});
  }
 }
 return output;
}

function validateDays(days) {
 const period=Number(days);
 if(!allowedPeriods.has(period)) fail(400,'Escolha 7, 14 ou 30 dias.');
 return period;
}

function dbProblem(error) {
 // Do not leak database details. Migration must be applied manually once in D1.
 if (String(error?.message || '').includes('no such table')) fail(503,'Aplique migrations/0002_leonardo_ads.sql no D1 dedicado do Content Engine.');
 throw error;
}

export async function collectAds(env,owner,days) {
 const period=validateDays(days);
 const [account,campaigns,insights]=await Promise.all([metaAccount(env),metaCampaigns(env),metaInsights(env,period)]);
 const collectedAt=now();
 const snapshot={account,campaigns,insights,collectedAt};
 try {
  await statement(env,'INSERT INTO meta_ads_snapshots(owner,account_id,period_days,range_start,range_end,payload,collected_at) VALUES(?,?,?,?,?,?,?)',
   owner,clean(account.id),period,insights.range.since,insights.range.until,JSON.stringify(snapshot),collectedAt).run();
  const suggestions=suggestAds(campaigns,insights);
  for (const item of suggestions) {
   const id=[clean(account.id),item.campaign_id,insights.range.since,insights.range.until,item.rule].join(':');
   await statement(env,"INSERT OR IGNORE INTO meta_ads_reviews(id,owner,campaign_id,title,explanation,evidence,proposed_action,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?)",
    id,owner,item.campaign_id,item.title,item.explanation,item.evidence,item.proposed_action,collectedAt).run();
  }
 } catch(error) {dbProblem(error)}
 return {...snapshot, warnings:[
  insights.hasMore||campaigns.hasMore?'Há paginação não consultada; os totais podem estar incompletos.':null,
  'Leads são ações reportadas, não contatos comerciais confirmados. Métricas de CTR usam cliques totais, não cliques no link.'
 ].filter(Boolean)};
}

export async function historyAds(env,owner,days) {
 const period=validateDays(days);
 try {
  const result=await statement(env,'SELECT id,period_days,range_start,range_end,payload,collected_at FROM meta_ads_snapshots WHERE owner=? AND period_days=? ORDER BY id DESC LIMIT 30',owner,period).all();
  return result.results.map(row=>{
   const s=JSON.parse(row.payload);
   return {id:row.id,collectedAt:row.collected_at,range:{since:row.range_start,until:row.range_end},campaigns:s.insights.rows,
    currency:s.account.currency,hasMore:Boolean(s.insights.hasMore)};
  });
 } catch(error) {dbProblem(error)}
}

export async function reviewsAds(env,owner) {
 try {
  const result=await statement(env,'SELECT id,campaign_id,title,explanation,evidence,proposed_action,status,created_at,reviewed_at FROM meta_ads_reviews WHERE owner=? ORDER BY created_at DESC LIMIT 100',owner).all();
  return result.results.map(row=>({...row,evidence:JSON.parse(row.evidence)}));
 } catch(error) {dbProblem(error)}
}

export async function decideAds(env,owner,id,decision) {
 if(typeof id!=='string'||id.length>250||!['approved','rejected'].includes(decision))fail(400,'Revisão inválida.');
 try {
  const existing=await statement(env,'SELECT status FROM meta_ads_reviews WHERE owner=? AND id=?',owner,id).first();
  if(!existing)fail(404,'Sugestão não encontrada.');
  if(existing.status!=='pending')fail(409,'Esta sugestão já foi revisada.');
  const result=await statement(env,"UPDATE meta_ads_reviews SET status=?,reviewed_at=? WHERE owner=? AND id=? AND status='pending'",decision,now(),owner,id).run();
  if(result.meta?.changes===0)fail(409,'Esta sugestão já foi revisada.');
  return {ok:true,status:decision,note:'Revisão registrada. Nenhuma campanha, orçamento ou anúncio foi modificado.'};
 } catch(error) {dbProblem(error)}
}
