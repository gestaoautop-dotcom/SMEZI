import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestAds} from '../server/leonardo-ads.mjs';
const campaign = {campaigns:[{id:'123',name:'Irvine ads',status:'ACTIVE'}]};
const range = {since:'2026-11-01',until:'2026-11-07'};
test('small-sample insight is cautious and evidence-backed',()=>{
 const items=suggestAds(campaign,{range,rows:[{campaign_id:'123',impressions:93,clicks:5,spend:6.65,leads:0}]});
 assert.equal(items.length,1);
 assert.equal(items[0].rule,'small_sample');
 assert.match(items[0].proposed_action,/antes de propor alterações/);
 assert.deepEqual(JSON.parse(items[0].evidence).period,range);
});
test('low total click rate proposes review, not auto edits',()=>{
 const items=suggestAds(campaign,{range,rows:[{campaign_id:'123',impressions:1500,clicks:5,spend:15,leads:null}]});
 assert.deepEqual(items.map(i=>i.rule),['low_total_ctr']);
 assert.match(items[0].proposed_action,/revisão/);
});
test('missing lead metric must not be mistaken for zero',()=>{
 const items=suggestAds(campaign,{range,rows:[{campaign_id:'123',impressions:1500,clicks:30,spend:30,leads:null}]});
 assert.equal(items.some(i=>i.rule==='conversion_check'),false);
});
test('zero reported leads after enough clicks prompts tracking audit',()=>{
 const items=suggestAds(campaign,{range,rows:[{campaign_id:'123',impressions:1500,clicks:30,spend:30,leads:0}]});
 assert.equal(items.some(i=>i.rule==='conversion_check'),true);
 assert.match(items.find(i=>i.rule==='conversion_check').explanation,/não prova ausência de contatos/);
});
test('no matching campaign insight generates no recommendation',()=>{
 assert.deepEqual(suggestAds(campaign,{range,rows:[]}),[]);
});
