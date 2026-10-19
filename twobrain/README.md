# TwoBrain — memoria compartilhada e rastreavel (V1)

Modulo aditivo da SMEZI, sem alterar os arquivos existentes. **Nao armazene dados privados, tokens ou dumps no Git.** O repositorio atual e publico.

## Objetivo
Uma fonte de verdade consultavel por agentes, com historico de cada projeto, versoes, proveniencia, busca semantica, relacoes e auditoria. Todos os agentes acessam as mesmas informacoes *de acordo com suas permissoes*. Nenhum agente recebe acesso irrestrito por padrao.

## Pipeline
1. **Conectar**: importadores autorizados (ChatGPT exportado pelo usuario, arquivos, Google Drive, GitHub, tarefas). GPTs personalizados do ChatGPT **nao compartilham automaticamente** suas conversas ou memoria via API.
2. **Capturar**: guardar o original em storage privado imutavel, com hash SHA-256 e registro em `sources`; nunca apagar a origem apos resumo.
3. **Extrair**: produzir observacoes atomicas com tipo, fonte, autor, timestamps, confianca e escopo.
4. **Conciliar**: identificar duplicatas; registrar conflitos, nunca sobrescrever fatos sem historico.
5. **Relacionar**: conectar projetos, pessoas, ativos, tarefas, decisoes e entregaveis em grafo relacional.
6. **Recuperar**: busca por texto + vetor + relacoes, sempre filtrada por organizacao/projeto e permissao.
7. **Responder**: devolver resposta com referencias, data, grau de confianca e divergencias; abster-se quando nao houver fonte.
8. **Auditar**: log somente acrescentado para ingestao, leituras sensiveis, alteracoes, aprovacoes e exportacoes.

## Regras obrigatorias
- Um identificador estavel por projeto, fonte, documento, entidade, afirmacao e decisao.
- Versionamento append-only: corrigir com uma nova versao; manter registros anteriores.
- Status `draft | verified | disputed | superseded`; decisao final requer aprovacao humana.
- Separar **observacao** (o que uma fonte diz), **inferencia** (hipotese) e **decisao** (aprovada).
- Toda resposta deve incluir `source_id` e `source_version_id` quando houver fundamento documental.
- Chaves, tokens e dados pessoais nunca no frontend, Git ou logs em texto puro.
- RLS e controle de acesso em todas as consultas, inclusive nas buscas vetoriais.
- Backup automatico criptografado e exercicio de restauracao periodico, com retencao configuravel.
- Exclusao legal/privacidade: mecanismo de tombstone e politica de retencao; **append-only nao impede exclusoes exigidas por lei**.
- Nao declarar "sincronizado" ate que conector, credenciais, job e resultado estejam efetivamente ativos.

## Estrutura
- `schema.sql`: esquema inicial de dados e indices (PostgreSQL), sem aplicar migracoes.
- `contracts.md`: contratos de ingestao e recuperacao para todos os agentes.
- `implementation.md`: etapas de implantacao, controle de riscos e testes.

## Etapas de integracao
Conectar primeiro fontes de um projeto piloto (THE CREATOR), validar recuperacao com citacoes, depois ampliar para os demais projetos. O schema e uma **fundacao**, nao implementa OAuth, integracao de ChatGPT, automatismos ou sincronizacao sozinho.
