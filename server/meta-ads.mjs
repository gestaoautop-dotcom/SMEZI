import {fail} from './security.mjs';

const API_HOST = 'https://graph.facebook.com';
const ACCOUNT_ID = /^[0-9]{5,30}$/;
const API_VERSION = /^v[0-9]{1,2}\.[0-9]{1,2}$/;

export function metaReady(env) {
  return Boolean(
    ACCOUNT_ID.test(env.META_AD_ACCOUNT_ID || '') &&
    API_VERSION.test(env.META_API_VERSION || '') &&
    typeof env.META_ACCESS_TOKEN === 'string' &&
    env.META_ACCESS_TOKEN.length > 20
  );
}

function failureCategory(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  if (error?.name === 'TypeError') return 'network_or_redirect';
  return 'unexpected_fetch_error';
}

async function graphRead(env, endpoint, fields, params = {}) {
  if (!metaReady(env)) fail(503, 'Configure META_ACCESS_TOKEN, META_AD_ACCOUNT_ID e META_API_VERSION no ambiente privado.');
  const url = new URL(API_HOST + '/' + env.META_API_VERSION + '/' + endpoint);
  url.searchParams.set('fields', fields);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  if (endpoint.endsWith('/campaigns')) url.searchParams.set('limit', '100');
  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    const category = failureCategory(error);
    // Intentionally omit error.message, URLs, request headers, tokens and account identifiers.
    console.warn('meta_ads_graph_fetch_failed', { category, operation: endpoint.endsWith('/campaigns') ? 'campaigns' : 'account' });
    fail(502, 'Falha de comunicação com a Meta (' + category + ').');
  }
  if (response.status >= 300 && response.status < 400) {
    console.warn('meta_ads_graph_redirect_blocked', { status: response.status, operation: endpoint.endsWith('/campaigns') ? 'campaigns' : 'account' });
    fail(502, 'A Meta retornou um redirecionamento que foi bloqueado por segurança.');
  }
  if (!response.ok) {
    console.warn('meta_ads_graph_http_error', { status: response.status, operation: endpoint.endsWith('/campaigns') ? 'campaigns' : 'account' });
    if (response.status === 400 || response.status === 401 || response.status === 403)
      fail(502, 'A Meta recusou a consulta. Verifique as permissões ads_read e a validade da credencial.');
    fail(502, 'A Meta não concluiu a consulta.');
  }
  let payload;
  try { payload = await response.json(); } catch {
    console.warn('meta_ads_graph_invalid_json', { operation: endpoint.endsWith('/campaigns') ? 'campaigns' : 'account' });
    fail(502, 'Resposta inválida da Meta.');
  }
  if (payload?.error) fail(502, 'A Meta recusou a consulta.');
  return payload;
}

export async function metaAccount(env) {
  const data = await graphRead(env, 'act_' + env.META_AD_ACCOUNT_ID, 'id,name,account_status,currency,timezone_name');
  return { id: data.id, name: data.name, account_status: data.account_status, currency: data.currency, timezone_name: data.timezone_name };
}

export async function metaCampaigns(env) {
  const data = await graphRead(env, 'act_' + env.META_AD_ACCOUNT_ID + '/campaigns', 'id,name,objective,status,effective_status,created_time,updated_time');
  return { campaigns: Array.isArray(data.data) ? data.data : [], hasMore: Boolean(data.paging?.next), note: 'Somente campanhas disponíveis na conta conectada; rascunhos locais de outra conta não aparecem.' };
}

export async function metaInsights(env, days = 7) {
  const period = Number(days);
  if (![7, 14, 30].includes(period)) fail(400, 'Escolha 7, 14 ou 30 dias.');
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - period + 1);
  const date = x => x.toISOString().slice(0, 10);
  const range = {since: date(since), until: date(until)};
  const data = await graphRead(env, 'act_' + env.META_AD_ACCOUNT_ID + '/insights',
    'campaign_id,campaign_name,spend,impressions,reach,clicks,actions',
    {level: 'campaign', time_range: JSON.stringify(range), limit: '100'});
  const rows = Array.isArray(data.data) ? data.data : [];
  const safeNumber = value => value === undefined || value === null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const leadTypes = new Set(['lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead']);
  return {
    range,
    rows: rows.map(row => ({
      campaign_id: String(row.campaign_id || ''),
      campaign_name: String(row.campaign_name || ''),
      spend: safeNumber(row.spend),
      impressions: safeNumber(row.impressions),
      reach: safeNumber(row.reach),
      clicks: safeNumber(row.clicks),
      leads: Array.isArray(row.actions)
        ? row.actions.filter(a => leadTypes.has(a.action_type)).reduce((sum,a) => sum + (safeNumber(a.value) || 0), 0)
        : null
    })),
    hasMore: Boolean(data.paging?.next),
    note: 'Leads são eventos de ação reportados pela Meta, sujeitos a atribuição e possíveis sobreposições. Alcance não é aditivo entre campanhas. Período por datas; o fuso da conta pode influenciar os resultados.'
  };
}
