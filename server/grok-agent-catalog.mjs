// Catalog transcribed from the owner's Grok agent screenshots (2026-11-23).
// These are *references* for future import, not executable Grok.com bots.
// Their prompts, memory, access and API identifiers have NOT been imported.
export const GROK_AGENT_CATALOG=Object.freeze([
 {id:'eloisa-financeiro',name:'ELOÍSA - FINANCEIRO',topic:'Financeiro'},
 {id:'carina-terrenos',name:'Carina - Terrenos',topic:'Terrenos'},
 {id:'eloisa-ux',name:'Eloisa - UX e melhorias',topic:'UX e melhorias'},
 {id:'jade-redes-sociais',name:'Jade - Redes sociais',topic:'Redes sociais'},
 {id:'stela-hoteis',name:'Stela - Hoteis E Hospedagem',topic:'Hotéis e hospedagem',nameTruncated:true},
 {id:'isabelly-eventos',name:'Isabelly - Eventos',topic:'Eventos'},
 {id:'nathalia-fotografos',name:'Nathalia - Fotografos',topic:'Fotógrafos'},
 {id:'dev',name:'DEV - Developer and Search',topic:'Desenvolvimento e pesquisa'},
 {id:'elon-planos',name:'Elon - Business plans and fi...',topic:'Planos de negócios e finanças',nameTruncated:true},
 {id:'lu-compras',name:'LU - COMPRAS',topic:'Compras'},
 {id:'manu-ifood',name:'Manu - Ifood',topic:'Ifood'},
 {id:'laura-imoveis',name:'Laura - Imoveis',topic:'Imóveis'},
 {id:'marina-decoracao',name:'Marina C. - Decoração',topic:'Decoração'},
 {id:'e-bot',name:'E-Bot',topic:null}
]);
export function grokAgentCatalog(){return GROK_AGENT_CATALOG.map(x=>({...x,connected:false,profileImported:false}));}
