# Contratos entre agentes e TwoBrain

## Ingestao
```json
{
  "project_id": "uuid",
  "source": {"external_id":"id-estavel","kind":"file|chat_export|github|drive|manual","uri":"referencia-opcional"},
  "content_hash_sha256":"hash-do-original",
  "captured_at":"ISO-8601",
  "content_type":"text/plain",
  "storage_key":"chave-privada-no-object-storage",
  "actor_id":"uuid",
  "idempotency_key":"source-kind:external-id:hash"
}
```
O endpoint rejeita carga sem autenticacao, permissao, escopo, hash ou idempotency key. O conteudo original vai ao object storage privado e nunca retorna a clientes sem autorizacao.

## Extracao e conciliacao
```json
{
  "entity_id":"uuid",
  "project_id":"uuid",
  "kind":"fact|hypothesis|decision|task|asset",
  "statement":"descricao atomica",
  "source_version_id":"uuid",
  "confidence":0.0,
  "status":"draft",
  "valid_at":"ISO-8601",
  "recorded_at":"ISO-8601"
}
```
A IA so pode propor observacoes, links, classificacoes e conflitos. Para verificar e aprovar decisoes, exige fluxo de revisao por usuario autorizado. Duplicatas sao ligadas; nao eliminadas.

## Consulta
```json
{"project_ids":["uuid"],"question":"pergunta","filters":{"kinds":["fact","decision"]},"top_k":10}
```
Retorno:
```json
{
  "answer":"resposta baseada nas evidencias",
  "evidence":[{"observation_id":"uuid","source_version_id":"uuid","quote":"trecho curto","confidence":0.9}],
  "conflicts":[{"observation_ids":["uuid","uuid"],"reason":"fontes divergentes"}],
  "missing_evidence":[],
  "as_of":"ISO-8601"
}
```
Nunca confiar no `project_ids` enviado pelo cliente sem checar autorizacao no servidor. Recuperacao primeiro aplica ACL e so depois ranking.

## Operacoes
- `ingest`: append-only, idempotente.
- `search`: somente leitura com referencias.
- `propose_relation`: cria relacao pendente.
- `propose_decision`: cria decisao pendente.
- `approve_decision`: exige ator humano autorizado.
- `export_project`: exporta conteudo e metadados em formato portavel, com log.
- `restore_test`: valida backups em ambiente isolado.

## Exemplo THE CREATOR
Um agente encontra dois slogans em conversas diferentes. Registra as duas observacoes com suas fontes, identifica qual foi a aprovacao mais recente e exibe o historico. Sem fonte verificavel, a resposta sinaliza incerteza; nunca descarta silenciosamente uma versao.
