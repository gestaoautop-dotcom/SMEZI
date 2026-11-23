# Leonardo — Calendário, postagem em lote, automações e agentes estruturados

Branch: `claude/leonardo-automacao`. Ela parte da produção (`feature/content-engine-caroline-v1`) e inclui, mescladas, `feature/leonardo-conversations-phase1` e `feature/leonardo-jade-agents`.

Nada foi implantado. Tudo continua desligado até a ativação descrita abaixo.

## O que entrou

| Módulo | Arquivos | Estado |
|---|---|---|
| Agentes com respostas estruturadas e ferramentas | `server/ai-runtime.mjs`, `server/json-schema.mjs`, `server/assistant.mjs` | Testado com IA simulada |
| Jade + Leonardo com JSON Mode | `server/agents.mjs` (`think`, `STEP_SCHEMAS`) | Testado (mesmos testes da branch Jade) |
| Fotos dos posts (R2) | `server/media.mjs` | Testado com R2 simulado |
| Calendário e lote em várias redes | `server/calendar.mjs`, `calendar.html`, `calendar.js` | Testado com banco SQLite real |
| Publicação Instagram (Facebook Login) e Página do Facebook | `server/social.mjs`, `server/queue.mjs` | Testado com a Graph API simulada; **não validado na Meta real** |
| Automação de comentários e DMs | `server/automation-core.mjs`, `server/automations.mjs`, `server/conversations-consumer.mjs`, `automations.html`, `automations.js` | Testado com a Graph API simulada; **não validado na Meta real** |
| Banco | `migrations/0005_calendar_batches_automations.sql` | Aditiva |

### Agentes: respostas estruturadas e ferramentas
- Um único runtime para Workers AI (padrão), OpenAI, Gemini, xAI e **Anthropic (novo)**, com o schema enviado no formato nativo de cada provedor:
  - Workers AI: `response_format`;
  - OpenAI e xAI: `text.format` estrito;
  - Gemini: `responseJsonSchema`;
  - Anthropic: `output_config.format`.
- **Toda resposta é validada no servidor.** Se vier fora do formato, há uma tentativa de correção. Se falhar de novo, nada é salvo.
- Ferramentas declaradas com schema de argumentos, **todas somente leitura**: `buscar_memorias`, `publicacoes_recentes`, `agenda_do_periodo` e `regras_automacao`. Nenhum agente publica, envia mensagens ou aprova nada.
- Tarefas disponíveis em `POST /api/assistant`: `legendas` (uma por rede), `plano_calendario` (ideias do mês) e `regra_automacao` (sugere uma regra validada, que **não é salva**).
- Provedores pagos exigem `LEONARDO_EXTERNAL_AI_ENABLED=true` **e** o provedor em `LEONARDO_AI_ALLOWED_PROVIDERS`.
- Limites diários: `AGENT_AI_DAILY_LIMIT_WORKERS` (padrão 200) e `AGENT_AI_DAILY_LIMIT_EXTERNAL` (padrão 40).
- O uso fica em `ai_usage`: tokens e provedor, sem prompts nem respostas.

### Calendário e lote
- Um post = uma foto + uma legenda + várias redes no mesmo horário. Cada rede vira um post versionado próprio, com legenda específica opcional.
- Fluxo: rascunho → **Aprovar todas** → **Agendar aprovadas**.
  - Editar o texto de uma rede cria uma nova versão, invalida a aprovação dela e cancela o agendamento pendente.
  - Mudar a data cancela os agendamentos pendentes, e é preciso agendar de novo.
- A foto vai para Instagram, Facebook e Threads. X e LinkedIn recebem só o texto nesta versão.
- As fotos são convertidas para JPEG no navegador e ficam no R2 (`MEDIA`). As redes buscam a imagem por uma URL pública `/m/<token de 128 bits>.jpg`.

### Automações por palavra-gatilho
- Regras por canal (Instagram ou Facebook) e origem (comentário ou DM), com palavras-gatilho em dois modos: "contém", com fronteira de palavra e sem acento, ou "exata".
- Cada regra tem resposta pública e/ou privada, com a variável `{nome}`.
- **Toda regra nasce desativada e no modo aprovação.** Os modos são:
  - `rascunho`: só registra;
  - `aprovacao`: espera um clique;
  - `automatico`: envia sozinho, só com `CONVERSATIONS_AUTO_REPLY_ENABLED=true`.
- Travas no automático:
  - limite diário (`AUTOMATION_DAILY_LIMIT`, padrão 100);
  - 24 h por contato e regra;
  - permissões conferidas antes de qualquer envio.
- Cada comentário é tratado uma única vez, pelo id da Meta. Clique duplo não envia duas vezes.
- Uma falha de rede vira "sem confirmação" e **nunca é reenviada sozinha**.
- Prazos da Meta: a resposta privada a um comentário só pode ser enviada em até 7 dias. Uma DM só pode ser respondida em até 24 h.

## Ativação (só com autorização)

1. **Banco:** aplicar `migrations/0003`, `0004` e `0005` no D1 do Leonardo (binding `DB`), nessa ordem. Todas são aditivas.
2. **Fotos:** criar um bucket R2 dedicado e adicionar o binding `MEDIA` no projeto Pages, em Production e em Preview. Não reutilizar o `BACKUPS`.
3. **Permissões Meta**, revisando o Login for Business (`INSTAGRAM_PAGE_LOGIN_CONFIG_ID`) e reconectando:
   - publicar no Instagram: `instagram_basic` e `instagram_content_publish` (já concedidas);
   - publicar na Página: `pages_manage_posts` e `pages_read_engagement`;
   - responder comentários: `instagram_manage_comments` (Instagram) e `pages_manage_engagement` (Facebook);
   - mensagens privadas e DMs: `pages_messaging`, mais `instagram_manage_messages` para as DMs do Instagram;
   - para contas de terceiros, a Meta exige revisão do app (Advanced Access).
4. **Webhook Meta:** assinar os campos `comments` e `messages` (Instagram) e `feed` e `messages` (Página). O endpoint é o já existente `/api/webhooks/meta`.
5. **Consumidor:** seguir `docs/conversations-deploy.md`, com o binding `DB` e as variáveis `TOKEN_ENCRYPTION_KEY`, `GITHUB_ALLOWED_ID` e `META_API_VERSION`.
   - `CONVERSATIONS_TEST_ACCOUNT_ID` não é mais usado: o consumidor só aceita eventos da conta conectada.
6. **Teste em modo aprovação:**
   - criar uma regra no modo aprovação e comentar a palavra-gatilho com uma conta de teste;
   - conferir o evento em **Automações → Aguardando você** e enviar manualmente;
   - só depois disso considerar o modo automático.
7. **Publicação:** continua desligada até `PUBLISHING_ENABLED=true` e `SCHEDULER_ENABLED=true`, com o Worker de agendamento ativo.

## Testes

`npm test` inclui `test/ai-runtime.test.mjs`, `test/calendar.test.mjs` e `test/automations.test.mjs`. Eles usam o SQLite real com as migrations do repositório, um R2 em memória e `fetch` simulado. **Nenhuma chamada real à Meta ou a provedores de IA foi feita.**
