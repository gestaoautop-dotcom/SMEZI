# TwoBrain: central multi-projetos e agentes colaborativos

## Hierarquia
Workspace do proprietario -> varios projetos -> equipes de agentes por projeto -> sessoes, tarefas, mensagens, documentos e decisoes. O projeto THE CREATOR e **somente um projeto**, como SMEZI, ASI Capital, ZAC, TIMTIM Brasil e outros.

## Comunicacao agente-agente
- Cada agente tem identificador, descricao, ferramentas, versao, escopos e politica de acesso.
- Um orquestrador cria `task_run`, delega uma tarefa a um agente e publica mensagens em `agent_messages`.
- Mensagens referenciam projeto, conversa, tarefa, remetente, destinatario (agente ou canal), timestamps e evidencias.
- Eventos sao imutaveis e idempotentes; status/estado corrente e derivado dos eventos.
- Agentes pesquisam memoria autorizada, trocam descobertas e criam propostas de escrita.
- Decisoes finais, publicacoes e acoes externas sensiveis exigem aprovacao humana.
- Mensagens de agentes sao dados nao confiaveis: nao concedem novas permissoes nem autorizam execucao de instrucoes arbitrarias.
- Cruzamento **entre projetos** exige permissao explicitamente concedida, registros de auditoria e, quando adequado, redacao de informacoes de clientes.

## Exemplo
No projeto ASI Capital:
1. Agente Infra consulta documentos autorizados e registra hipoteses sobre hospedagem.
2. Agente Seguranca revisa as evidencias, pede verificacoes e marca riscos.
3. Agente Documentacao produz um manual com links de origem.
4. O orquestrador encaminha para aprovacao da proprietaria. Nenhuma hipotese vira fato sem comprovacao.

No projeto THE CREATOR, outros agentes podem dividir roteiro, imagem, cronologia e divulgacao, sem visualizar dados privados de ASI Capital.

## Modelo operacional
- `project_id` obrigatorio em todos os registros.
- `agent_id` em toda mensagem de agente e execucao.
- `thread_id` para discussoes continuas e `task_id` para trabalho delegado.
- `causation_id`/`correlation_id` para reconstruir a cadeia de eventos.
- `context_snapshot` aponta exatamente as versoes das fontes vistas pelo agente.
- Uma afirmacao deve sempre apontar a fonte, e as contradicoes devem ser preservadas.
- Integrar ChatGPT/GPTs personalizados exige caminho suportado de exportacao/API/ferramentas; conversas privadas nao ficam automaticamente acessiveis a outros GPTs.
