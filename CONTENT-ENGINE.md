# SMEZI Content Engine V2 — serviços privados e publicação aprovada

Branch de produção: `feature/content-engine-caroline-v1`. Projeto Pages independente: `smezi-content-engine`. Não mesclar na `main` para publicar este módulo. O site institucional e o Brand Studio original continuam intactos.

## O que o código implementa

- Login GitHub OAuth com PKCE, sessão assinada, expiração em oito horas, cookie HttpOnly/Secure e acesso restrito pelo ID numérico da conta autorizada. O token GitHub é usado apenas para identificar a conta; não é guardado.
- API privada com validação da sessão e da origem para operações de escrita.
- D1 para memórias, ideias e versões imutáveis das publicações; importação aditiva e rejeição de conflitos pelo ID.
- Dados locais preservados. O primeiro envio exige o botão **Sincronizar com a nuvem**; depois, as alterações são sincronizadas automaticamente naquele navegador e conta. Falhas mantêm a cópia local.
- Backups JSON em R2 após sincronizações com novos registros e mediante solicitação manual. Recuperação de conteúdo pela interface sem sobrescrever versões atuais. O arquivo inclui também os dados atuais do CRM; recuperação administrativa do CRM requer leitura desse arquivo.
- Workers AI para gerar rascunhos a partir da ideia original e das últimas versões das memórias, sem incluir hipóteses. Fonte e modelo ficam vinculados ao rascunho. A geração nunca aprova ou publica.
- CRM nativo com contatos, etapa comercial, projeto/case, publicação de origem, notas e histórico de alterações. Não há integração automática com um CRM externo existente.
- OAuth oficial de X, LinkedIn, Instagram e Threads, com tokens criptografados em AES-GCM no servidor e ligados à conta/rede. O navegador recebe apenas o endereço de autorização e o estado da conexão.
- Fila persistente com aprovação vinculada ao hash da versão exata, trava de execução, cancelamento por revisão, conta de destino fixa e tratamento de entrega incerta. Resposta 429 admite retentativa com espera; entregas sem confirmação exigem conferência manual e não são repetidas automaticamente.
- X, LinkedIn pessoal e Threads: texto. Instagram profissional: uma imagem JPEG pública e legenda. Não há envio de vídeos, carrosséis nem mídia para X/LinkedIn nesta etapa.
- Métricas de X/Threads/Instagram mediante permissões concedidas, links rastreáveis com contagem agregada sem IP/cookies e atribuição manual de contatos. Sugestões baseadas nos contatos efetivamente registrados. Métricas de posts pessoais LinkedIn não estão integradas.

Código implementado não significa serviço ativado: banco, bucket, AI, OAuth e agendador precisam ser configurados na conta Cloudflare e nas redes. A interface exibe o estado real de cada dependência.

## 1. Manter o deploy separado

No Pages existente:

| Campo | Valor |
| --- | --- |
| Projeto | `smezi-content-engine` |
| Branch | `feature/content-engine-caroline-v1` |
| Framework | None |
| Build | `npm run build` |
| Saída | `dist` |
| Compatibility date das Functions | `2026-10-30` ou posterior |

O build gera `dist/_worker.js` e `_routes.json`; somente `/api/*` e `/r/*` executam o servidor. O restante continua estático. `/studio/` contém a cópia original do Brand Studio.

A configuração raiz Wrangler da V1 foi removida para que os bindings sejam administrados pelo painel Pages; os nomes abaixo são o contrato do código. Não sobrescrever recursos existentes de outros projetos.

## 2. Banco e backup — primeira ativação

1. Em **Storage & Databases → D1**, criar um banco dedicado `smezi-content-engine`.
2. Abrir o console SQL desse banco e executar o conteúdo de [migrations/0001_content_engine.sql](migrations/0001_content_engine.sql). A migração é aditiva e não apaga tabelas. Usar o banco novo.
3. Criar um bucket R2 dedicado `smezi-content-engine-backups`, privado, sem domínio público.
4. No Pages **Settings → Bindings**, adicionar D1 com nome **DB** e R2 com nome **BACKUPS**.
5. Adicionar Workers AI com nome **AI**.
6. Reimplantar a branch para aplicar bindings/variáveis.

## 3. Login e IA

Criar um OAuth App em **GitHub → Settings → Developer settings → OAuth Apps**. Não reutilizar o token do conector ChatGPT. O login do aplicativo publicado é independente da conexão de ferramentas desta conversa.

- Homepage: `https://smezi-content-engine.pages.dev`
- Authorization callback URL: `https://smezi-content-engine.pages.dev/api/auth/callback`

Em **Pages → Settings → Variables and Secrets → Production**, cadastrar:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `APP_ORIGIN` | Variável | `https://smezi-content-engine.pages.dev` (sem barra final) |
| `GITHUB_ALLOWED_ID` | Variável | `332584384`, ID da conta proprietária `gestaoautop-dotcom`; conferir antes de habilitar |
| `GITHUB_CLIENT_ID` | Variável | Client ID do OAuth App |
| `GITHUB_CLIENT_SECRET` | Segredo | Client Secret do OAuth App |
| `SESSION_SECRET` | Segredo | Valor aleatório próprio, pelo menos 32 caracteres |
| `TOKEN_ENCRYPTION_KEY` | Segredo | Outra chave aleatória, exatamente 64 caracteres hexadecimais |
| `AI_MODEL` | Variável | `@cf/openai/gpt-oss-120b` para testar raciocínio, ou outro modelo Workers AI compatível com `messages`; o servidor aceita texto final em `response`, Chat Completions ou Responses |

Gerar segredos em um terminal confiável, por exemplo `openssl rand -hex 32`, duas vezes com resultados distintos. Inserir diretamente no painel, sem enviar ao chat, ao GitHub ou à interface do aplicativo. O uso de IA está limitado a 30 gerações/dia por conta; os limites não substituem os controles de cobrança do provedor.

Após reimplantar: entrar, abrir **Dados e integrações**, clicar **Sincronizar com a nuvem**, criar uma memória e confirmar que ela reaparece em outro navegador autenticado. Dados do domínio antigo não são lidos automaticamente: transferir backup explicitamente.

## 4. Aplicativos das redes

Criar/configurar um aplicativo oficial por provedor e cadastrar o callback correspondente. Cada app precisa de permissões/produtos aprovados para a conta de destino; o deploy não concede essas autorizações.

| Rede | Variáveis/segredos | Callback |
| --- | --- | --- |
| X | `X_CLIENT_ID`, segredo `X_CLIENT_SECRET` | `/api/social/x/callback` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, segredo `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_VERSION` (YYYYMM suportado, por exemplo `202610`) | `/api/social/linkedin/callback` |
| Instagram | `INSTAGRAM_CLIENT_ID`, segredo `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_API_VERSION` (versão suportada no aplicativo, como `v25.0`) | `/api/social/instagram/callback` |
| Threads | `THREADS_CLIENT_ID`, segredo `THREADS_CLIENT_SECRET` | `/api/social/threads/callback` |

Prefixar os callbacks com `https://smezi-content-engine.pages.dev`. Reimplantar e clicar **Conectar conta** dentro do aplicativo para consentir na rede oficial.

- X: aplicativo Web/confidential, OAuth 2.0 com PKCE, escopos `tweet.read tweet.write users.read offline.access`. Acesso/cobrança dependem do plano do provedor.
- LinkedIn: produtos OpenID Connect e Share on LinkedIn; escopos `openid profile w_member_social`; publicação no perfil pessoal autorizado. Renovação programática de tokens LinkedIn não é presumida: reconectar quando necessário.
- Instagram Login: conta profissional; escopos `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`; permissões de insights precisam estar disponíveis para o app.
- Threads: `threads_basic`, `threads_content_publish`, `threads_manage_insights`.
- Tokens de X são renovados com refresh token; Instagram/Threads usam tokens longos e renovação enquanto ainda válidos. Tokens expirados, revogados ou recusados exigem reconexão. As chamadas reais devem ser validadas após cada app ser autorizado.

Desconectar remove os tokens locais do servidor e cancela os envios ainda pendentes. Revogar o consentimento também nas configurações da rede quando desejar remover o acesso do provedor.

## 5. Agendador — ativar depois do login e das conexões

Pages não executa Cron Triggers. Criar um Worker separado `smezi-content-scheduler` com [scheduler/worker.mjs](scheduler/worker.mjs), usando o mesmo D1 **DB**. Não substituir o Pages existente por esse Worker.

- Variável no Worker: `APP_ORIGIN=https://smezi-content-engine.pages.dev`.
- Segredo no Worker: `CRON_SECRET`, aleatório e com pelo menos 32 caracteres.
- Configurar Cron Trigger `* * * * *`.
- Cadastrar o **mesmo** `CRON_SECRET` como segredo no Pages.
- No Pages, definir `SCHEDULER_ENABLED=true` e `PUBLISHING_ENABLED=true` quando a configuração estiver concluída.
- O arquivo `scheduler/wrangler.example.jsonc` é apenas exemplo: substituir o ID do D1 antes de usar com CLI. Não contém credenciais.

O Worker chama a API privada de execução e grava o heartbeat. A fila só aceita novos agendamentos se houver sinal do agendador nos últimos cinco minutos. Para pausar novos envios, definir `PUBLISHING_ENABLED=false`; itens já em execução podem concluir.

Fluxo: salvar → sincronizar → **Aprovar na nuvem** na versão mais recente → escolher data/horário → **Enviar à fila automática**. Verificar o primeiro envio real de cada rede, incluindo uma edição após aprovação, antes de usar em escala. Aprovar não dispara uma publicação por si só.

## Verificação concluída no desenvolvimento

`npm test` usa Node 22+ (Node 24 recomendado), mantém os testes do Brand Brain e adiciona testes de autorização, CSRF, expiração de sessão, criptografia, isolamento, conflito de versões, aprovação, execução concorrente, entrega incerta, conta de destino, CRM, fontes de IA, OAuth, limites e cliques. O teste de runtime usa Workers/Miniflare com D1 e R2 locais para confirmar persistência e recuperação.

`npm run build` empacota o servidor e os arquivos estáticos sem credenciais ou dados de usuários. Testes de rede usam respostas simuladas; o teste local não comprova configuração ou autorização nas contas externas. A inspeção visual no navegador remoto ficou indisponível nesta sessão.

## Fontes técnicas

- https://developers.cloudflare.com/pages/functions/advanced-mode/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- https://docs.x.com/x-api/posts/create-post
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
