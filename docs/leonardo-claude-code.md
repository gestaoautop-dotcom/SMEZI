# Claude Code no Leonardo

A integração Claude Code é voltada a DESENVOLVIMENTO no repositório SMEZI: análise, testes, correções e pull requests. Não é uma API de chat no painel, nem conecta a assinatura pessoal Claude automaticamente.

## Ativação
1. Abra https://console.anthropic.com/ e confirme que tem créditos, faturamento e orçamento compatíveis com a API Anthropic. Não habilite utilização paga sem aprovar o custo.
2. No GitHub, repositório gestaoautop-dotcom/SMEZI > Settings > Environments, crie `leonardo-claude-code`.
3. Em Environment secrets, configure `ANTHROPIC_API_KEY` (nunca no código, no frontend, no Cloudflare Pages ou neste chat). Esta chave é separada de `XAI_API_KEY`, `OPENAI_API_KEY` e `GEMINI_API_KEY`.
4. Revise e mescle o PR para a branch padrão do GitHub. A aba Actions permite `workflow_dispatch` a partir do workflow na branch padrão.
5. Em Actions > Leonardo - Claude Code (manual, opt-in) > Run workflow, selecione branch de trabalho e descreva uma tarefa específica. Use 1-3 turnos no primeiro teste.
6. Revise todo diff gerado e PR antes de permitir merge ou deploy. O workflow não faz deploy.

## Segurança e custos
- Manual, sem gatilhos automáticos por comentário ou agendamento.
- Limites conservadores: máximo 8 turnos por execução e 20 minutos de duração; ainda assim a cobrança depende dos tokens/modelos.
- O ambiente GitHub permite armazenar a chave separada, definir revisores obrigatórios e impor controles de aprovação.
- A action `anthropics/claude-code-action@v1` é oficial da Anthropic. Consulte a documentação atual antes de atualizar.
- A configuração utiliza permissões de escrita no GitHub para permitir alterações/PRs; não use o agente para alterar segredos ou arquivos críticos sem revisão.
