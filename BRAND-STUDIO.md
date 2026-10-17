# SMEZI Brand Studio

Módulo em que uma marca — com identidade pronta ou só com um nome, uma ideia e uma cor — vira um Brand Brain e um Brand Guide editável. A interface continua em português do Brasil. O site institucional da SMEZI, nas branches `v4` e `gh-pages`, não faz parte deste módulo.

O texto de marca, os exemplos de concorrente e as peças saem de uma base curada no repositório. O estúdio não chama um modelo em tempo de execução e não pede chave nenhuma.

## Rodar localmente

```bash
node scripts/dev-server.js
```

Abra `http://127.0.0.1:4173`. O servidor só entrega os arquivos estáticos, inclusive `data/`.

## Base de conhecimento

A base fica em `data/` e é a fonte de tudo que o estúdio escreve.

| Arquivo | O que guarda |
| --- | --- |
| `data/index.json` | Lista dos ofícios. Um id por arquivo em `data/niches/`. |
| `data/niches/<id>.json` | Um ofício: público, posicionamento, tons, mensagens, títulos, chamadas, pilares, paletas, par tipográfico, fotografia, composição, clichês e concorrentes. |
| `data/standard.json` | O padrão SMEZI: voz, composição, frases que não entram. |
| `data/archetypes.json` | Eixos e chips do assistente, em uma linha cada. |
| `data/humor.json` | Quando o humor leve entra, e os ofícios em que ele fica de fora. |
| `data/seasons.json` | Datas comerciais brasileiras, com o ofício e uma linha. |

Para editar, abra o JSON e mude o texto. A próxima vez que alguém atualizar o entendimento, o estúdio lê o arquivo de novo. Não há gerador: o que está no JSON é o que vale.

Para incluir um ofício:

1. Copie um arquivo de `data/niches/` e troque o `id`.
2. Preencha os mesmos campos. As frases ficam curtas, em português, sem jargão.
3. Concorrente só entra com nome verdadeiro. URL só se for `https://` e você tiver certeza. Se não houver um conjunto honesto, deixe `competitors` vazio e explique em `competitorNote`.
4. Acrescente o `id` em `data/niches` dentro de `data/index.json`.
5. Se a data comercial servir a esse ofício, coloque o `id` na lista `niches` de `data/seasons.json`.

O ofício é escolhido pelo segmento e pela descrição. Ganha o apelido mais longo. `bar` não pega barbearia. Se nada casar, entra `_geral`: a base não inventa ofício nem empresa.

A paleta e a fonte da marca continuam as que a pessoa escolheu. As paletas e o par do JSON aparecem no guia como sugestão, com o botão de aplicar. "Mostrar outras" gira mensagens, títulos e exemplos. No editor, "Outra frase" faz o mesmo dentro do modelo.

## O que fica salvo

Tudo continua neste navegador, nas chaves que já existiam:

- `smezi-brand-studio-v1` — respostas do assistente
- `smezi-content-studio-v2` — marcas e projetos de conteúdo

Marcas antigas abrem normalmente. Campos novos são opcionais. O anel do Brand Brain conta campos respondidos (0 a 12). Não é uma nota de qualidade e não acompanha mais a etapa.

## Biblioteca de modelos

Criar conteúdo abre a biblioteca: previews no formato e na voz da marca, com filtro de formato (post 1080×1350, quadrado, story, apresentação 1920×1080) e de função (lançamento, educativo, institucional, oferta, depoimento, bastidores, evento, citação). Escolher um modelo abre o editor.

Criar campanha monta um conjunto coerente em mais de um formato. Criar apresentação monta capa, seção, conteúdo, dados e fecho. O miolo muda com a marca: uma padaria ou um boteco ganha composições mais quentes; uma clínica, uma indústria ou uma marca técnica fica mais sóbria.

Os textos saem da base, com limite por campo, corte em fim de palavra e chamada discreta. A fotografia é a da pessoa; sem arquivo, o espaço mostra um lugar de espera.

Peças antigas, salvas com os modelos anteriores, continuam abrindo e exportando.

## Teste

```bash
node test/brain-core.test.js
node test/templates.test.js
node test/knowledge.test.js
```
