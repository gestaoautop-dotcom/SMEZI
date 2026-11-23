// Validador de JSON Schema (subconjunto usado pelos agentes do Leonardo), sem dependências.
// Suporta: type (string ou lista), properties, required, additionalProperties:false,
// items, enum, maxItems, maxLength, minimum, maximum.
// A validação roda SEMPRE no servidor, mesmo quando o provedor promete saída estruturada:
// a resposta do modelo é dado não confiável até passar por aqui.

const typeOf=value=>value===null?'null':Array.isArray(value)?'array':Number.isInteger(value)?'integer':typeof value;
function matchesType(expected,value){
 const actual=typeOf(value);
 return [].concat(expected).some(t=>t===actual||(t==='number'&&actual==='integer'));
}

export function validate(schema,value,path='$',errors=[]){
 if(!schema||typeof schema!=='object')return errors;
 if(schema.type&&!matchesType(schema.type,value)){errors.push(`${path}: esperado ${[].concat(schema.type).join('|')}`);return errors}
 if(schema.enum&&!schema.enum.some(x=>x===value))errors.push(`${path}: valor fora da lista permitida`);
 if(typeof value==='string'&&schema.maxLength!==undefined&&Array.from(value).length>schema.maxLength)errors.push(`${path}: acima de ${schema.maxLength} caracteres`);
 if(typeof value==='number'){
  if(schema.minimum!==undefined&&value<schema.minimum)errors.push(`${path}: menor que ${schema.minimum}`);
  if(schema.maximum!==undefined&&value>schema.maximum)errors.push(`${path}: maior que ${schema.maximum}`);
 }
 if(Array.isArray(value)){
  if(schema.maxItems!==undefined&&value.length>schema.maxItems)errors.push(`${path}: mais de ${schema.maxItems} itens`);
  if(schema.items)value.forEach((item,i)=>validate(schema.items,item,`${path}[${i}]`,errors));
 }
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const props=schema.properties||{};
  for(const key of schema.required||[])if(!(key in value))errors.push(`${path}.${key}: obrigatório`);
  for(const [key,item] of Object.entries(value)){
   if(props[key])validate(props[key],item,`${path}.${key}`,errors);
   else if(schema.additionalProperties===false)errors.push(`${path}.${key}: campo não permitido`);
  }
 }
 return errors;
}

// Remove restrições que alguns provedores não aceitam no modo estrito
// (maxLength, maxItems, minimum, maximum). Elas continuam sendo aplicadas por validate().
export function providerSchema(schema){
 if(Array.isArray(schema))return schema.map(providerSchema);
 if(!schema||typeof schema!=='object')return schema;
 const out={};
 for(const [key,value] of Object.entries(schema)){
  if(['maxLength','maxItems','minimum','maximum'].includes(key)&&typeof value!=='object')continue;
  out[key]=key==='properties'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,providerSchema(v)])):providerSchema(value);
 }
 return out;
}

// Extrai o primeiro objeto JSON de um texto (modelos sem modo estruturado às vezes cercam com ```json).
export function extractJSON(text){
 if(text&&typeof text==='object')return text;
 const cleaned=String(text||'').replace(/^\s*```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');
 if(start<0||end<=start)return null;
 try{const value=JSON.parse(cleaned.slice(start,end+1));return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}
}
