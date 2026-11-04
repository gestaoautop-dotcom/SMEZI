import {externalJSON,unseal} from './security.mjs';
import {statement} from './store.mjs';

export async function socialRead(env,owner){
 const rows=await statement(env,"SELECT provider,account_id,encrypted_token,expires_at FROM connections WHERE owner=? AND provider IN ('facebook','instagram','linkedin')",owner).all();
 return {readOnly:true,publishingEnabled:false,channels:rows.results.map(r=>({provider:r.provider,connected:true}))};
}
