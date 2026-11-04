# Leonardo V3 — Especificação de publicação multicanal e fila em massa

Estado: DESIGN APROVÁVEL / SEM ATIVAÇÃO AUTOMÁTICA
Data: 2026-11-04
Escopo: Instagram, Facebook Pages, LinkedIn pessoal, Threads, TikTok, X, YouTube e blogs CWS/SMEZI.

## 1. Invariantes obrigatórios

- Nenhum envio ou pré-publicação pública sem aprovação humana da versão exata e do destino específico.
- Uma aprovação em lote é permitida, desde que a interface mostre todas as variantes, contas, datas, mídias e quantidade total de operações antes da confirmação.
- Conteúdo editado depois de aprovado invalida a aprovação da variante editada e seus jobs ainda pendentes.
- Marca CWS: assinatura exata "CWS — Human Creativity." Nunca "Human Intelligence".
- Dados reais; não inventar métricas, contatos, resultados ou cases. Separar fatos de hipóteses.
- Nunca renovar ou revelar tokens no navegador; manter criptografia AES-GCM no servidor e secrets em Cloudflare.
- Não publicar automaticamente em contas desconectadas, sem permissão ou com destino alterado.
- Modo seguro inicial: publicação desabilitada; conexão das oito categorias de destino antes da ativação da fila em produção.
- O Leonardo pode sugerir a adaptação por rede, mas deve guardar e publicar os bytes/textos que foram efetivamente aprovados.
- Proibir repetição automática após entrega incerta; revisão humana obrigatória.

## 2. Auditoria do código atual

- Branch Cloudflare Pages: `feature/content-engine-caroline-v1`, build `scripts/build-content-engine.js`, saída `dist`.
- API de produção: `server/worker.mjs`; conexões OAuth: `server/social.mjs`.
- D1: `migrations/0001_content_engine.sql`; fila: `server/queue.mjs`; Cron Worker separado: `scheduler/worker.mjs`.
- Conectores implementados no código: X, LinkedIn pessoal, Instagram, Threads. LinkedIn pessoal foi conectado e exibido na UI em 2026-11-04.
- `validatePost` atualmente suporta texto X/LinkedIn/Threads e somente JPEG público Instagram. **Não** publicar mídia LinkedIn antes de construir upload, nem afirmar Facebook/TikTok/YouTube/Blog conectados.
- `jobs` atual usa UNIQUE(owner,record_id): impede fan-out de um conteúdo para várias redes. Migrar modelo em vez de removê-lo ou quebrar jobs antigos.
- O scheduler atual processa fila por tick, com heartbeat D1, e tem tratamento de entregas incertas. Reutilizar e estender; não fazer publicação síncrona em lote no navegador.
- A integração Meta Ads é somente leitura e deve permanecer separada das permissões de publicar.

## 3. Modelo de dados V3 — migração aditiva 0003

Tabelas propostas (novas, sem sobrescrever registros existentes):

- `brands(id,owner,name,signature,settings_json,created_at,updated_at)`
- `channel_accounts(id,owner,brand_id,provider,provider_account_id,label,capabilities_json,connection_ref,status,created_at,updated_at)`. Permitir várias contas por provider; separar destinos Facebook Page e Instagram Professional.
- `content_items(id,owner,brand_id,root_id,revision,source_text,language,created_at,updated_at)`.
- `media_assets(id,owner,brand_id,r2_key,mime,bytes,sha256,width,height,duration_ms,alt_text,status,created_at)`. Bucket privado; upload autenticado; validação de tipo/tamanho; URLs transitórias quando API externa necessitar URL.
- `content_variants(id,owner,content_id,channel_account_id,revision,caption,title,description,settings_json,media_manifest_json,digest,status,created_at)`.
- `publication_batches(id,owner,name,created_at,approved_at,approved_by,status,scheduled_policy_json)`.
- `batch_items(batch_id,variant_id,scheduled_at,timezone)` com unique(batch_id,variant_id).
- `variant_approvals(owner,variant_id,digest,approved_at,approved_by)`.
- `publication_jobs(id,owner,batch_id,variant_id,channel_account_id,snapshot_json,digest,scheduled_at,status,remote_id,remote_url,attempts,lease_until,started_at,published_at,error_code,error_message,updated_at,idempotency_key)` UNIQUE(owner,idempotency_key); one job per variant+account+schedule.
- `publication_events(id,owner,job_id,event,payload_redacted,at)`. Nunca registrar tokens, URLs privadas assinadas nem dados sensíveis sem necessidade.

Criação de migrações com teste contra dados legados e rollback lógico por feature flag; sem DROP de tabelas atuais.

## 4. Estado de publicação

draft → ready_for_review → approved → scheduled → preparing_media → publishing → published
Exceções: cancelled, blocked, failed, uncertain, needs_reconnect.

- Uma aprovação vincula hash SHA-256 canonicalizado de texto, mídia, configuração, conta e horário/política de agendamento.
- Replanejamento de horário depois da aprovação exige confirmar a nova agenda explicitamente; mudanças em texto/mídia/destino exigem nova aprovação.
- Preparação de mídia só depois de aprovação; se a API subir e não confirmar o post, marcar uncertain e nunca retentar cegamente.
- Rate limits por provedor e por conta, backoff com jitter apenas para falhas explicitamente seguras; respeitar Retry-After.
- Worker Cron processa lotes pequenos em D1, com lease atômico, cursor, logs e checkpoint por destino.
- Pausa global e por rede: `PUBLISHING_ENABLED`, `SCHEDULER_ENABLED`, `channel_accounts.status`. Nunca habilitar automaticamente durante deploy.

## 5. Contrato dos conectores

Interface:
`connect(); callback(); capabilities(); validate(variant); prepareMedia(variant); publish(variant,media); reconcile(job); disconnect()`.

- LinkedIn pessoal: OAuth `openid profile w_member_social`; texto; para imagens registrar/upload `/rest/images?action=initializeUpload`, enviar bytes à URL autorizada, criar `/rest/posts` com `content.media.id` e headers de versão. Nunca usar `w_organization_social` sem aprovação e papel apropriado.
- Facebook: publicar **Pages**, não feed pessoal, via Facebook Login e Page access token com permissões válidas; confirmar Page ID e acesso.
- Instagram: contas Professional, usando modelo de Instagram Login já escolhido no projeto ou integração via Facebook Page, com container `media` e `media_publish`; imagens/carrosséis/Reels conforme capacidade real; URL pública temporária apenas quando exigida.
- Threads: texto e imagem/video conforme permissões e endpoints suportados. Adaptar separadamente.
- TikTok: Content Posting API Direct Post, scope `video.publish` e permissões específicas para fotos; apps não auditados podem ser limitados a visibilidade privada. Verificar regras de consentimento e metadados antes do envio.
- X: OAuth com `tweet.write`; suporte a upload de mídia via API oficial e postagem; prever limites, custos e disponibilidade da conta.
- YouTube: Google OAuth 2.0, `youtube.upload` e `videos.insert` com upload resumível; Shorts são vídeos elegíveis, não endpoint independente; agendamento `status.publishAt` requer vídeo privado e restrições de API.
- Blog: adaptador por CMS real (WordPress REST para sites WP, ou endpoint autenticado para site custom); nunca supor que todos os blogs usam o mesmo sistema; publicar somente com credenciais e permissões explícitas.

Para cada conector armazenar capability map: text, image, multi_image, video, short_video, link, schedule, max_media, max_text, approval_required, active, blocked_reason. Interface não deve oferecer ação que o destino não suporte.

## 6. API V3 (rotas privadas, owner-bound)

- `GET /api/channels`: contas, permissões, status (sem tokens).
- `POST /api/media/uploads`: inicialização de upload seguro autenticado; validação, checksum e metadados.
- `POST /api/content`, `POST /api/content/:id/variants`: guardar origem e variantes.
- `POST /api/batches/preview`: resolver conta/limites/capacidade, comparar digest e apresentar plano de envio, sem side effects públicos.
- `POST /api/batches`: criar lote em draft.
- `POST /api/batches/:id/approve`: aprovação explícita da lista exata e hash, auditoria, CSRF, idempotency key.
- `POST /api/batches/:id/schedule`: enfileirar apenas variantes aprovadas e destinos conectados.
- `POST /api/batches/:id/cancel`: cancelar itens pendentes; não desfazer posts enviados.
- `GET /api/batches/:id`, `GET /api/jobs`: estado por destino e logs redigidos.
- Rota de execução: reusar `POST /api/internal/tick` e autenticação de Worker, nunca expor a credencial do Cron.

Proteção: owner session existente, same-origin para writes, validação de payload, limites de tamanho e R2 privado. Separar serviços de conexão de serviços de publicação.

## 7. UX

Seções: Conexões; Biblioteca de mídias; Criar conteúdo; Adaptações por rede; Calendário; Fila em massa; Aprovações; Resultados.
Ações em cada post: selecionar canais, duplicar, adaptar, salvar, aprovar, agendar, publicar após aprovação, adicionar à fila.
Bulk: seleção múltipla de posts, redes e horários, com preview matricial por variante/destino e contagem total de publicações.
Confirmação obrigatória: mensagem "Você está aprovando N publicações para M contas" com preview completo e opção de excluir um item.
Exibir parcialmente sucedido por canal: sucesso no LinkedIn não implica sucesso no Instagram.
Horário visual America/Sao_Paulo, persistência ISO 8601 UTC + timezone IANA; tratar DST de outros países.

## 8. Etapas e critérios de aceite

Fase A — Conectar todas as contas: LinkedIn já conectado; implementar Meta Facebook Pages, Instagram, Threads, TikTok, X, YouTube, Blog; verificar permissão, identidade, token e capacidade individual. Não habilitar publicar.
Fase B — Biblioteca R2 e validações de mídia por rede.
Fase C — Migração aditiva D1 e API de lotes/variantes/aprovações.
Fase D — UI de seleção múltipla + calendário e preview; nenhum botão publicar sem aprovação.
Fase E — Conectores de publicação de texto, imagens e vídeos, com testes simulados e testes privados autorizados, um canal por vez.
Fase F — Ativar scheduler após teste end-to-end e monitoramento; inicialmente somente um lote aprovado pequeno.
Fase G — Métricas e memória com valores provenientes das APIs ou atribuição manual explicitamente rotulada.

Testes mínimos:
1. edição após aprovação cancela job ainda pendente;
2. duas redes com mesma origem criam jobs distintos sem duplicação;
3. falha em uma rede não interrompe as demais;
4. entrega incerta bloqueia reenvio automático;
5. conta desconectada cancela ou bloqueia pendentes;
6. horário e fuso preservados;
7. mídia inválida bloqueada por plataforma;
8. tokens nunca aparecem em API, logs ou backup exportável;
9. build/scheduler existentes continuam; Meta Ads read-only intacto;
10. marca CWS usa exclusivamente Human Creativity.

## 9. Referências oficiais verificadas em 2026-11-04

- LinkedIn Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- LinkedIn acesso: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- Meta Instagram: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- TikTok Direct Post: https://developers.tiktok.com/docs/en/content-posting-api-get-started
- YouTube videos: https://developers.google.com/youtube/data/reference/rest/v3/videos

Não declarar compatibilidade, acesso premium ou escopos já aprovados sem testes reais por rede.
