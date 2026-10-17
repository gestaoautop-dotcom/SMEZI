# SMEZI Brand Studio

Módulo em que uma marca — com identidade pronta ou só com um nome, uma ideia e uma cor — vira um Brand Brain e um Brand Guide editável. A interface continua em português do Brasil. O site institucional da SMEZI, nas branches `v4` e `gh-pages`, não faz parte deste módulo.

## Rodar localmente

```bash
node scripts/dev-server.js
```

Abra `http://127.0.0.1:4173`. O mesmo servidor entrega os arquivos estáticos e a rota `/api/brand-brain`.

Sem a chave de IA, o assistente termina do mesmo jeito: o entendimento é organizado no navegador, com os campos que a pessoa respondeu. Nada é inventado para tapar buraco (concorrente sem segmento, por exemplo, não é chutado).

## Variáveis na Vercel

| Variável | Obrigatoriedade | Função |
| --- | --- | --- |
| `OPENAI_API_KEY` | necessária para o modelo | Chave da OpenAI. Sem ela, a rota responde com o entendimento local. |
| `OPENAI_MODEL` | opcional | Modelo das respostas. Padrão: `gpt-4o-mini`. |
| `OPENAI_BASE_URL` | opcional | Endpoint compatível com a API da OpenAI. Padrão: `https://api.openai.com/v1`. Serve para apontar a um gateway. |

A chave fica só na função `/api/brand-brain`. O navegador nunca a recebe.

O texto do modelo segue o padrão da Caroline — composição com respiro, tipografia resolvida, frase curta, foto cinematográfica e de contexto, humor só quando a personalidade pede, chamada discreta — e usa as cores, a fonte e a voz de cada marca. A paleta da interface não é empurrada para a marca.

## O que fica salvo

Tudo continua neste navegador, nas chaves que já existiam:

- `smezi-brand-studio-v1` — respostas do assistente
- `smezi-content-studio-v2` — marcas e projetos de conteúdo

Marcas antigas abrem normalmente. Campos novos são opcionais. O anel do Brand Brain conta campos respondidos (0 a 12). Não é uma nota de qualidade e não acompanha mais a etapa.

## Teste

```bash
node test/brain-core.test.js
```
