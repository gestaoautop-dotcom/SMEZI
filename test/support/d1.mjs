// D1 de teste sobre node:sqlite, aplicando as migrations reais do repositório.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

export function d1(files=['0001_content_engine.sql','0002_leonardo_ads.sql','0003_conversations_phase1.sql','0004_agents_memory.sql','0005_calendar_batches_automations.sql']){
 const sql=new DatabaseSync(':memory:');
 for(const file of files)sql.exec(readFileSync(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return sql.prepare(query).run(...args)},_query:query,_args:args}}}},
  async batch(items){sql.exec('BEGIN');try{const result=items.map(x=>sql.prepare(x._query).run(...x._args));sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
 return {sql,DB};
}

// R2 em memória.
export function r2(){
 const store=new Map();
 return {store,async put(key,value,opts){store.set(key,{bytes:new Uint8Array(value),opts})},async get(key){const v=store.get(key);return v?{body:v.bytes,size:v.bytes.length}:null},async list({prefix}={}){return {objects:[...store.keys()].filter(k=>!prefix||k.startsWith(prefix)).map(key=>({key,size:store.get(key).bytes.length}))}}};
}

// fetch simulado: registra chamadas e responde pela primeira regra que casar.
export function mockFetch(routes){
 const calls=[];
 const original=globalThis.fetch;
 globalThis.fetch=async(url,init={})=>{
  const u=String(url);calls.push({url:u,method:init.method||'GET',headers:init.headers||{},body:init.body});
  for(const [match,reply] of routes){
   if(typeof match==='string'?u.includes(match):match.test(u)){
    const r=typeof reply==='function'?await reply(u,init):reply;
    if(r instanceof Error)throw r;
    return new Response(JSON.stringify(r.body??r),{status:r.status||200,headers:{'Content-Type':'application/json'}});
   }
  }
  return new Response(JSON.stringify({error:{message:'unexpected '+u}}),{status:500});
 };
 return {calls,restore(){globalThis.fetch=original}};
}
