# SMEZI Content Engine V1.1

Implementação independente na branch `feature/content-engine-caroline-v1`. Não mesclar na `main` para publicar este módulo.

## Cloudflare Pages

- Projeto: `smezi-content-engine`, separado do site principal.
- Repositório: `gestaoautop-dotcom/SMEZI`.
- Branch de produção: `feature/content-engine-caroline-v1`.
- Framework: None.
- Diretório raiz: raiz do repositório.
- Comando de build: `npm run build`.
- Diretório de saída: `dist`.
- Usar **Pages**, não o fluxo Workers que executa `wrangler deploy`.
- Não configurar bindings de bancos existentes nesta V1 estática.

O arquivo `wrangler.jsonc` declara a saída Pages. O build não instala dependências e copia apenas os arquivos necessários. O Content Engine abre em `/`; o Brand Studio em `/studio/`. O `index.html` original não é alterado. A publicação no projeto existente exige acesso autenticado ao Cloudflare; a configuração no código não comprova um deploy.

## Recursos implementados e validação

`npm test` executa os testes existentes e os novos testes de importação atômica, conflitos de IDs, revisões, aprovação, fontes autorais, correções, backup e isolamento do artefato. `npm run build` gera o artefato de publicação.

Ideias originais, rascunhos, planejamento local, aprovação por versão, correção de memórias, grafo navegável, importação de transcrições e backup JSON estão disponíveis. Uma correção cria nova versão com `parentId`, `rootId` e número de revisão. A aprovação também cria versão; editar um conteúdo não herda aprovação. Datas registram planejamento e não disparam publicações.

Os dados ficam em `localStorage`, com uma cópia anterior automática e exportação manual. Isso não é backup remoto, autenticação nem sincronização entre dispositivos. A recuperação combina registros ausentes; não desfaz versões. Backups JSON contêm dados privados: mantenha-os protegidos.

O botão de integração lê explicitamente as chaves já existentes `smezi-brand-studio-v1` e `smezi-content-studio-v2`, preservando ambas. Só funciona na mesma origem e navegador. Dados salvos em outro domínio não migram automaticamente. Não colocar memórias pessoais, registros de clientes ou tokens no repositório público.

## Próximas etapas dependentes de infraestrutura

1. Autenticação e autorização no servidor antes de sincronizar dados pessoais.
2. Persistência com versões em D1, uploads em R2 e backups remotos com restauração testada.
3. API de IA no servidor; textos e transcrições como fontes com referência explícita. Áudio e vídeo ainda não são transcritos pelo aplicativo.
4. Apps oficiais e OAuth separados para X, LinkedIn, Instagram e Threads. Tokens somente em armazenamento de servidor, com criptografia e renovação.
5. Fila executada no servidor, com aprovação vinculada à revisão exata, idempotência, retentativas e registro de falhas; revogar aprovação após qualquer edição.
6. Métricas reais por API e atribuição de cliques/clientes ao CRM. Nenhuma métrica fictícia nesta V1.

O grafo representa conexões entre registros; não representa treinamento ou pesos de uma rede neural. A estruturação editorial atual é determinística e não chama uma API de IA.
