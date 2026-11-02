# TwoBrain — Caroline Wilhelm

Módulo do mesmo repositório SMEZI, em `/twobrain/`, com link na home do Brand Studio.

## Implementado

Central de pedidos com responsável e projeto; perfis de Martha, Pepper, Sugar, Olive, Basil e X Growing; fila com andamento manual; memória por tipo/fonte/projeto; busca textual e agrupamento de relações por projeto; histórico de captura; backup JSON validado com confirmação de substituição; catálogo de modelos e ferramentas; layout responsivo e conteúdo escapado.

## Estado real

Base funcional local. Ainda não há execução por IA, login, OAuth, sincronização entre dispositivos, grafo semântico ou agendamentos. Nenhuma conta conectada ou mensagem enviada. Concluir uma tarefa altera apenas o registro manual. Os perfis definem responsabilidades, não processos de IA ativos.

Não é uma área privada autenticada. `noindex` não é controle de acesso. localStorage pertence à origem e é acessível a scripts dela; limpar o navegador apaga os dados. Não inserir segredos ou dados confidenciais. Nenhum dado pessoal foi incluído no repositório.

## Infraestrutura pendente

1. Autenticação no servidor com acesso exclusivo da proprietária, protegendo todas as rotas de dados e execução.
2. Banco persistente com proprietário por registro: memórias, relações, projetos, pedidos, entregas, eventos e aprovações.
3. Conectores OAuth por serviço, escopos mínimos, tokens cifrados no servidor e revogação; credenciais dos modelos exclusivamente no servidor.
4. Orquestração: Martha consulta contexto com origem, delega aos especialistas e consolida entregas. Conteúdo importado e resultados externos são dados não confiáveis, nunca autorização ou instruções de sistema.
5. Permissões explícitas por tipo de ação externa, auditoria e idempotência. Aprovações devem se vincular ao conteúdo exato da ação.
6. Jobs duráveis, rotinas, controle de custo e limites por modelo. Nenhuma rotina criada nesta etapa.
7. Migração do backup local após autenticação, preservando validação e confirmação.

O site atual é estático. Preservar Brand Studio ao adicionar backend. O workflow de Pages existente publica a branch `v4`; mudar `main` não publica nesse destino automaticamente. A publicação Vercel vinculada ao repositório precisa ser verificada separadamente.

## Verificação

`node --test test/*.test.js`

`node --check twobrain/app.js`

`node --check twobrain/core.js`
