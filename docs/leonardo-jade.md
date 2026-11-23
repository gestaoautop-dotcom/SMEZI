# Leonardo + Jade — agentes de conteúdo com memória de pesquisa

Módulo aditivo. Não altera o gerador original (`/api/generate`), o Laboratório de IA nem a fila de publicação.

## O que faz
- **Dois agentes** (`/agents.html`): **Jade** (pesquisa e estratégia de redes sociais) e **Leonardo** (editor-chefe).
- **Colaboração em até 4 etapas**: Jade pesquisa e escreve o briefing → Leonardo redige → Jade revisa → Leonardo finaliza. Com "revisão" desmarcada, são só 2 etapas.
- **Memória de pesquisa por agente** (`agent_memories`): cada nota tem agente, escopo (privada ou compartilhada), tipo, status, fonte e conversa de origem. Os agentes "conversam" pela memória compartilhada: o Leonardo lê as notas que a Jade acabou de registrar.
- **Informações sólidas**: só a memória autoral (`records`) e as notas **verificadas por você** são tratadas como fato. Notas criadas por agentes entram sempre como **rascunho**. Quando um "fato" cita uma memória que não existe ou não está verificada, ele vira hipótese. Citações inventadas são descartadas.
- **Novidade**: as 12 publicações mais recentes são enviadas aos agentes, com instrução de não repetir ângulos.
- **Nada se perde**:
  - mudar uma nota cria uma versão nova (histórico completo);
  - instruções anteriores dos agentes ficam em `agent_versions`;
  - cada etapa da conversa fica em `agent_messages`;
  - o rascunho (versão 1) e o texto final (versão 2) entram como posts imutáveis no mesmo `rootId`;
  - se uma etapa falha, o que já foi criado continua salvo e a conversa fica "incompleta".
- **Controle humano**: nada é aprovado nem publicado. A aprovação continua no Calendário do painel.

## Custo
- Usa apenas o **Workers AI**, que já está integrado (`AI` + `AI_MODEL`). Não chama OpenAI, Gemini nem xAI.
- Limite: 15 colaborações por dia por conta, cada uma com 2 ou 4 chamadas.
- Confira a cota gratuita e os preços atuais do Workers AI no painel da Cloudflare antes do uso contínuo. A quota é de requisições, não um teto em dinheiro.
- A busca na memória é feita no próprio Worker, sem banco vetorial pago.

## Ativação (depende de autorização da proprietária)
1. No console do D1 já usado pelo Leonardo (binding `DB`), executar `migrations/0004_agents_memory.sql`. A migration é aditiva e não apaga nada. O número 0003 fica reservado para o PR de Conversations.
2. Confirmar que o binding `AI` e a variável `AI_MODEL` estão em Production.
3. Revisar e mesclar o PR na branch de produção, conforme o procedimento normal.
4. Abrir `/agents.html` e substituir as instruções provisórias da Jade pelas originais.
5. Fazer uma colaboração de teste. Depois, validar ou contestar as notas criadas.

Sem a migration, as rotas `/api/agents/*` retornam erro genérico e o restante do Leonardo continua funcionando.

## Limitações conhecidas
- Os agentes **não pesquisam na internet**. A "pesquisa" vem das memórias e do conhecimento do modelo. Por isso, tudo o que eles produzem entra como rascunho até você verificar e informar a fonte.
- A busca é por palavras-chave (título com peso maior). Busca semântica com vetores fica para depois, se for necessária.
- Os agentes ainda não chamam as APIs externas. Isso pode ser ligado depois, com aprovação de custos.
