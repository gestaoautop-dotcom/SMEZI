import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerReady,connect} from '../server/social.mjs';
import {unifiedInstagramAuthorize,unifiedInstagramConfig} from '../server/instagram-unified.mjs';
import {channelRegistry} from '../server/channels-v3.mjs';
const env={
 APP_ORIGIN:'https://engine.example',SESSION_SECRET:'a'.repeat(48),TOKEN_ENCRYPTION_KEY:'b'.repeat(64),
 META_APP_ID:'3005438456490075',META_APP_SECRET:'fake-secret-test-only',
 META_API_VERSION:'v26.0',INSTAGRAM_UNIFIED_CONFIG_ID:'998431309270748',
 LINKEDIN_CLIENT_ID:'test-linkedin',LINKEDIN_CLIENT_SECRET:'fake-linkedin-secret',LINKEDIN_VERSION:'202610'
};
test('unified login uses exact Meta app config and callback without legacy scopes',async()=>{
 const u=new URL(unifiedInstagramAuthorize(env,'state-test'));
 assert.equal(u.hostname,'www.facebook.com');
 assert.equal(u.searchParams.get('client_id'),env.META_APP_ID);
 assert.equal(u.searchParams.get('config_id'),env.INSTAGRAM_UNIFIED_CONFIG_ID);
 assert.equal(u.searchParams.get('redirect_uri'),env.APP_ORIGIN+'/api/social/instagram/callback');
 assert.equal(u.searchParams.get('state'),'state-test');
 assert.equal(u.searchParams.get('scope'),null);
 assert.equal(u.searchParams.get('response_type'),'code');
 const link=await connect(env,'owner','instagram');
 const actual=new URL(link.url);
 assert.equal(actual.searchParams.get('config_id'),env.INSTAGRAM_UNIFIED_CONFIG_ID);
 assert.ok(link.cookie.includes('__Host-smezi_oauth='));
});
test('Instagram readiness requires unified credentials, not Instagram legacy keys',()=>{
 assert.equal(providerReady(env,'instagram'),true);
 assert.equal(providerReady({...env,META_APP_SECRET:''},'instagram'),false);
 assert.equal(providerReady({...env,INSTAGRAM_UNIFIED_CONFIG_ID:''},'instagram'),false);
 assert.equal(providerReady({...env,TOKEN_ENCRYPTION_KEY:'wrong'},'instagram'),false);
 assert.equal(channelRegistry(env,[]).find(x=>x.id==='instagram').connectEnabled,true);
 assert.equal(channelRegistry({...env,META_APP_SECRET:''},[]).find(x=>x.id==='instagram').connectEnabled,false);
});
test('LinkedIn OAuth remains independent and Meta Ads token is never required',async()=>{
 assert.equal(providerReady(env,'linkedin'),true);
 assert.equal(unifiedInstagramConfig(env).clientId,env.META_APP_ID);
 const linked=await connect(env,'owner','linkedin');
 const u=new URL(linked.url);
 assert.equal(u.hostname,'www.linkedin.com');
 assert.equal(u.searchParams.get('scope'),'openid profile w_member_social');
 assert.equal(u.searchParams.get('config_id'),null);
 assert.ok(!('META_ACCESS_TOKEN' in env));
});
