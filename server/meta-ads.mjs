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

async function graphRead(env, endpoint, fields) {
  if (!metaReady(env)) fail(503, 'Configure META_ACCESS_TOKEN, META_AD_ACCOUNT_ID e META_API_VERSION no ambiente privado.');
  const url = new URL(API_HOST + '/' + env.META_API_VERSION + '/' + endpoint);
  url.searchParams.set('fields', fields);
  if (endpoint.endsWith('/campaigns')) url.searchParams.set('limit', '100');
  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    fail(502, 'Não foi possível consultar a Meta no momento.');
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403)
      fail(502, 'A Meta recusou a consulta. Verifique as permissões ads_read e a validade da credencial.');
    fail(502, 'A Meta não concluiu a consulta.');
  }
  let payload;
  try { payload = await response.json(); } catch { fail(502, 'Resposta inválida da Meta.'); }
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
