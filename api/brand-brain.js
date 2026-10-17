const {
  buildFallbackBrain,
  competitorFallback,
  publicInput,
  sanitizeBrain,
  sanitizeCompetitors,
} = require("../lib/brain-core");

const BRAIN_SYSTEM = `Você é a direção criativa da SMEZI, o estúdio de Caroline. Transforme o briefing no entendimento da marca (Brand Brain) e nas decisões de um guia.

O padrão SMEZI aparece na qualidade das decisões, não numa estética única copiada da interface:
- composição limpa, com espaço em branco de verdade
- elegância
- tipografia forte e bem resolvida
- mensagem curta e objetiva
- fotografia autoral e cinematográfica, com contexto, nunca banco de imagem genérico
- criatividade a serviço do que a marca é
- humor inteligente só quando a personalidade da marca comporta
- chamada para ação discreta, uma por peça
- minimalismo como disciplina, não como estilo obrigatório

Cada marca guarda as próprias cores, fontes e voz. Não empurre neon, gradiente ou a paleta da interface da SMEZI para a marca. Use exatamente as cores recebidas, na mesma ordem. Não invente cor, fonte nem caminho de logo.

A pessoa pode chegar com uma identidade consolidada ou só com um nome, uma ideia e uma cor. Não cobre o que não foi dito. Não invente público numerado, prêmio, faturamento ou concorrente.

Escreva em português do Brasil, linguagem simples, sem jargão (evite branding, touchpoint, ecossistema, disruptivo, solução 360).

Responda apenas JSON neste formato:
{
  "positioning": "2 ou 3 frases curtas",
  "audience": "quem escuta esta marca",
  "tone": { "summary": "como a marca fala", "do": ["frase que a marca diria", "outra"], "dont": ["frase que a marca não diria", "outra"] },
  "keyMessages": ["mensagem curta", "outra", "outra"],
  "cta": "até 4 palavras, discreto",
  "palette": [{ "role": "papel curto", "usage": "onde a cor entra" }, {}, {}, {}],
  "typography": { "hierarchy": ["regra de título", "regra de texto", "regra de marca"] },
  "photography": { "direction": "direção em uma ou duas frases", "do": ["orientação", "outra"], "dont": ["o que evitar", "outro"] },
  "composition": { "do": ["regra", "outra", "outra"], "dont": ["regra", "outra", "outra"] },
  "logo": { "usage": "como usar o caminho de logo escolhido", "dont": ["não fazer", "outro"] }
}

A paleta tem 4 itens, na ordem das cores recebidas. Os exemplos de tom são frases ditas ou evitadas. Concorrente não é referência: referência é critério de qualidade, não molde para copiar. Se um campo do briefing vier vazio, siga sem ele.`;

const COMPETITOR_SYSTEM = `Você sugere até 5 concorrentes reais de uma marca. Concorrente é quem disputa o mesmo cliente, não uma marca admirada. Prefira o mercado brasileiro quando o contexto estiver em português. Inclua a URL oficial apenas se tiver certeza; se não tiver, deixe url vazia. Não invente empresa nem domínio. Responda apenas JSON: {"note":"frase curta pedindo confirmação","competitors":[{"name":"","url":"","why":"uma frase"}]}`;

function send(res, status, payload) {
  res.status(status).json(payload);
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

async function callModel(action, input, key) {
  const base = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(base + "/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: action === "competitors" ? 0.2 : 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: action === "competitors" ? COMPETITOR_SYSTEM : BRAIN_SYSTEM },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error("modelo respondeu " + response.status + " " + detail.slice(0, 160));
    }
    const data = await response.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error("resposta vazia");
    return { model, json: JSON.parse(content) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    send(res, 405, { error: "Use POST." });
    return;
  }
  const body = readBody(req);
  const action = body.action === "competitors" ? "competitors" : "synthesize";
  const input = publicInput(body.state || {});
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const result = action === "competitors" ? competitorFallback(input) : buildFallbackBrain(input);
    send(res, 200, { source: "fallback", reason: "no_key", result });
    return;
  }
  try {
    const completion = await callModel(action, input, key);
    if (action === "competitors") {
      send(res, 200, { source: "llm", model: completion.model, result: sanitizeCompetitors(completion.json) });
      return;
    }
    send(res, 200, {
      source: "llm",
      model: completion.model,
      result: sanitizeBrain(completion.json, input, completion.model),
    });
  } catch (error) {
    console.error("brand-brain", error && error.message ? error.message : error);
    const result = action === "competitors" ? competitorFallback(input) : buildFallbackBrain(input);
    send(res, 200, { source: "fallback", reason: "llm_error", result });
  }
};
