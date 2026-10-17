/* Authorial template catalog, copy fitting, and campaign/deck plans.
   Classic script sets globalThis.SmeziTemplates. Node require() gets module.exports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmeziTemplates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PURPOSES = ["lançamento", "educativo", "institucional", "oferta", "depoimento", "bastidores", "evento", "citação"];
  const CATALOG = [
    { id: "margem", name: "Margem", layout: "margem", purposes: ["institucional"], formats: ["post", "square", "story", "deck"], photo: true, limits: { kicker: 22, title: 42, body: 140, cta: 28 } },
    { id: "fotografia", name: "Fotografia", layout: "fotografia", purposes: ["bastidores", "lançamento"], formats: ["post", "square", "story", "deck"], photo: true, limits: { kicker: 22, title: 36, body: 110, cta: 28 } },
    { id: "coluna", name: "Coluna", layout: "coluna", purposes: ["educativo", "institucional"], formats: ["post", "square", "story", "deck"], photo: false, limits: { kicker: 22, title: 40, body: 160, cta: 28 } },
    { id: "lista", name: "Lista", layout: "lista", purposes: ["educativo"], formats: ["post", "square", "story", "deck"], photo: false, limits: { kicker: 22, title: 36, body: 180, line: 48, cta: 28 } },
    { id: "citacao", name: "Citação", layout: "citacao", purposes: ["citação", "depoimento"], formats: ["post", "square", "story", "deck"], photo: false, limits: { kicker: 28, title: 90, body: 40, cta: 28 } },
    { id: "cartaz", name: "Cartaz", layout: "cartaz", purposes: ["lançamento", "evento"], formats: ["post", "square", "story"], photo: false, limits: { kicker: 18, title: 32, body: 90, cta: 28 } },
    { id: "oferta", name: "Oferta", layout: "oferta", purposes: ["oferta"], formats: ["post", "square", "story"], photo: false, limits: { kicker: 18, title: 34, body: 120, cta: 28 } },
    { id: "retrato", name: "Retrato", layout: "retrato", purposes: ["depoimento"], formats: ["post", "square", "story"], photo: true, limits: { kicker: 18, title: 80, body: 40, cta: 28 } },
    { id: "bastidor", name: "Bastidor", layout: "bastidor", purposes: ["bastidores"], formats: ["post", "square", "story"], photo: true, limits: { kicker: 18, title: 34, body: 100, cta: 28 } },
    { id: "evento", name: "Evento", layout: "evento", purposes: ["evento"], formats: ["post", "square", "story"], photo: false, limits: { kicker: 16, title: 34, body: 80, cta: 28 } },
    { id: "pergunta", name: "Pergunta", layout: "pergunta", purposes: ["educativo"], formats: ["post", "square", "story", "deck"], photo: false, limits: { kicker: 18, title: 42, body: 140, cta: 28 } },
    { id: "capa", name: "Capa", layout: "capa", purposes: ["institucional", "lançamento"], formats: ["deck"], photo: true, limits: { kicker: 28, title: 42, body: 120, cta: 28 } },
    { id: "secao", name: "Seção", layout: "secao", purposes: ["institucional"], formats: ["deck"], photo: false, limits: { kicker: 8, title: 28, body: 40, cta: 28 } },
    { id: "conteudo", name: "Conteúdo", layout: "conteudo", purposes: ["educativo"], formats: ["deck"], photo: false, limits: { kicker: 28, title: 42, body: 180, cta: 28 } },
    { id: "dados", name: "Dados", layout: "dados", purposes: ["institucional", "educativo"], formats: ["deck"], photo: false, limits: { kicker: 32, title: 16, body: 180, line: 52, cta: 28 } },
    { id: "fecho", name: "Fecho", layout: "fecho", purposes: ["institucional"], formats: ["deck"], photo: false, limits: { kicker: 22, title: 28, body: 120, cta: 28 } },
  ];
  const WARM_WORDS = ["padaria", "pão", "pao", "boteco", "bar", "café", "cafe", "comida", "festa", "popular", "ousada", "ousado", "acessível", "acessivel", "orgânica", "organica", "organic", "quente", "alegre", "humana", "humano", "bold", "criativa", "criativo", "lanchonete", "baile"];
  const SOBER_WORDS = ["clínica", "clinica", "hospital", "odont", "indústria", "industria", "industrial", "advocacia", "advogado", "software", "tech", "tecnologia", "premium", "técnica", "tecnica", "minimal", "minimalista", "sofisticada", "sofisticado", "institucional", "saúde", "saude", "juríd", "banco", "consultoria"];
  const DANGLING = new Set(["de", "da", "do", "das", "dos", "para", "pra", "com", "em", "e", "a", "o", "as", "os", "um", "uma", "que", "no", "na", "nos", "nas", "por", "ao", "à", "pro"]);

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function wordHit(blob, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^a-z0-9áàâãéêíóôõúüç])" + escaped + "([^a-z0-9áàâãéêíóôõúüç]|$)", "i").test(blob);
  }
  function score(blob, words) {
    return words.reduce((total, word) => total + (wordHit(blob, word) ? 1 : 0), 0);
  }
  function knowledgeApi() {
    if (typeof SmeziKnowledge !== "undefined" && SmeziKnowledge && SmeziKnowledge.loaded) return SmeziKnowledge;
    try {
      const loaded = require("./knowledge");
      return loaded && loaded.loaded ? loaded : null;
    } catch (error) {
      return null;
    }
  }
  function moodOf(state) {
    const source = state || {};
    const knowledge = knowledgeApi();
    if (knowledge && clean(source.segment)) {
      const niche = knowledge.match(source.segment, source.description);
      if (niche && niche.id && niche.id !== "_geral" && niche.mood) return niche.mood;
    }
    const segment = String(source.segment || "").toLowerCase();
    const rest = [source.description, source.brain && source.brain.tone && source.brain.tone.summary]
      .concat(source.traits || [], source.styles || [])
      .join(" ")
      .toLowerCase();
    const segmentWarm = score(segment, WARM_WORDS);
    const segmentSober = score(segment, SOBER_WORDS);
    if (segmentSober > segmentWarm) return "sober";
    if (segmentWarm > segmentSober) return "warm";
    if (score(rest, WARM_WORDS) > score(rest, SOBER_WORDS)) return "warm";
    return "sober";
  }
  function fit(value, max) {
    const text = clean(value);
    const limit = Math.max(1, Number(max) || text.length || 1);
    if (!text || text.length <= limit) return text;
    const words = text.split(" ");
    let out = "";
    for (const word of words) {
      const next = out ? out + " " + word : word;
      if (next.length > limit) break;
      out = next;
    }
    if (!out) return words[0] || "";
    if (out.length < text.length) {
      let parts = out.replace(/[\s,;:–—-]+$/g, "").trim().split(" ");
      while (parts.length > 1 && DANGLING.has(parts[parts.length - 1].toLowerCase().replace(/[,.;:]+$/g, ""))) parts.pop();
      out = parts.join(" ").replace(/[\s,;:–—-]+$/g, "").trim();
    }
    return out;
  }
  function badClaim(value) {
    return /\d+\s*%|R\$\s*\d|\b20\d{2}\b|\d{1,2}\s*\/\s*\d{1,2}|depoimento de|desconto/i.test(String(value || ""));
  }
  function safeCta(value, max) {
    const text = fit(value, max || 28);
    if (!text || /saiba mais/i.test(text) || badClaim(text)) return "";
    return text;
  }
  function get(id) {
    return CATALOG.find((item) => item.id === id) || null;
  }
  function forFormat(format) {
    return CATALOG.filter((item) => item.formats.includes(format));
  }
  function forFilter(format, purpose) {
    return forFormat(format).filter((item) => !purpose || purpose === "todas" || item.purposes.includes(purpose));
  }
  function messagesOf(ctx) {
    const brain = ctx.brain || {};
    const list = (brain.keyMessages || []).map(clean).filter(Boolean);
    if (list.length) return list;
    const message = clean(ctx.brief && ctx.brief.message);
    if (message) return [message];
    const positioning = clean(brain.positioning);
    if (positioning) return [fit(positioning.split(/(?<=[.!?])\s+/)[0], 80)];
    return [clean(ctx.name) || "A marca"];
  }
  function clause(value, max) {
    const text = clean(value).replace(/^["“”']+|["“”']+$/g, "");
    if (!text) return "";
    const sentence = text.split(/(?<=[.!?])\s+/)[0];
    return fit(sentence, max);
  }
  function ctaOf(ctx) {
    const raw = clean(ctx.brain && ctx.brain.cta);
    const safe = safeCta(raw, 28);
    if (safe) return safe;
    const goal = ctx.brief && ctx.brief.goal;
    if (goal === "Convidar") return "Falar com a gente";
    if (goal === "Apresentar produto" || goal === "Apresentar serviços") return "Conhecer";
    return "Ver como funciona";
  }
  function supportLine(ctx, title, max) {
    const candidates = [
      ctx.brief && ctx.brief.message,
      ctx.brain && ctx.brain.positioning,
      messagesOf(ctx)[1],
      ctx.brain && ctx.brain.audience,
    ];
    for (const candidate of candidates) {
      const line = clause(candidate, max);
      if (line && line.toLowerCase() !== String(title || "").toLowerCase()) return line;
    }
    return "";
  }
  function question(theme, max) {
    const topic = clean(theme);
    const full = topic ? "Como funciona " + topic : "Por onde começar";
    let text = fit(full, Math.max(8, max - 1));
    if (!text) text = "Por onde começar";
    if (!/\?$/.test(text)) text += "?";
    if (text.length > max) return "Por onde começar?";
    return text;
  }
  function sectionTitle(ctx) {
    const goal = ctx.brief && ctx.brief.goal;
    if (goal === "Apresentar serviços") return "O que fazemos";
    if (goal === "Apresentar produto") return "O que chega";
    if (goal === "Convidar") return "O convite";
    return "O essencial";
  }
  function fitBody(value, template) {
    const limits = template.limits;
    if (template.id === "lista" || template.id === "dados") {
      return String(value || "")
        .split(/\n|·|\|/)
        .map((line) => fit(line, limits.line || 48))
        .filter(Boolean)
        .slice(0, 3)
        .join("\n");
    }
    return fit(String(value || "").replace(/\s+/g, " "), limits.body);
  }
  function knowledgeSource(ctx) {
    return {
      name: ctx.name,
      segment: ctx.segment,
      description: ctx.description || (ctx.brief && ctx.brief.theme) || "",
      traits: ctx.traits || [],
      styles: ctx.styles || [],
      knowledgeVariant: (Number(ctx.knowledgeVariant) || 0) + (Number(ctx.variant) || 0),
    };
  }
  function bankLine(ctx, purpose, max, salt) {
    const knowledge = knowledgeApi();
    if (!knowledge) return "";
    return knowledge.phrase(knowledgeSource(ctx), { purpose: purpose || "institucional", max, salt: salt || "" });
  }
  function themeTitle(ctx, template, fallback) {
    const theme = clean(ctx.brief && ctx.brief.theme);
    if (theme && theme.length <= template.limits.title && !badClaim(theme)) return theme;
    return fit(fallback, template.limits.title);
  }
  function ideaBody(ctx, template, title, purpose) {
    const line = bankLine(ctx, purpose || (template.purposes && template.purposes[0]), template.limits.body, template.id);
    if (line && line.toLowerCase() !== String(title || "").toLowerCase()) return line;
    return supportLine(ctx, title, template.limits.body);
  }
  function ideaLines(ctx, template) {
    const limit = template.limits.line || 48;
    const knowledge = knowledgeApi();
    const lines = [];
    if (knowledge) {
      for (let index = 0; index < 4 && lines.length < 3; index++) {
        const line = knowledge.phrase(knowledgeSource(ctx), { purpose: "educativo", max: limit, salt: template.id + "-" + index });
        if (line && !lines.includes(line)) lines.push(line);
      }
    }
    if (lines.length) return lines;
    return messagesOf(ctx).slice(0, 3).map((item) => fit(item, limit)).filter(Boolean);
  }
  function draft(template, ctx) {
    const limits = template.limits;
    const name = clean(ctx.name) || "A marca";
    const theme = clean(ctx.brief && ctx.brief.theme) || fit(messagesOf(ctx)[0], limits.title);
    const spoken = clause((ctx.brain && ctx.brain.tone && ctx.brain.tone.do && ctx.brain.tone.do[0]) || messagesOf(ctx)[0], limits.title);
    const photo = clause((ctx.brain && ctx.brain.photography && ctx.brain.photography.direction) || "Fotografia do lugar, com gente e contexto.", limits.body);
    const say = ctaOf(ctx);
    const first = themeTitle(ctx, template, messagesOf(ctx)[0]);
    const lines = ideaLines(ctx, template);
    if (template.id === "margem") return { kicker: fit(ctx.segment || "A marca", limits.kicker), title: first, body: ideaBody(ctx, template, first, "institucional"), cta: say };
    if (template.id === "cartaz") return { kicker: "Lançamento", title: themeTitle(ctx, template, theme), body: ideaBody(ctx, template, theme, "lançamento"), cta: say };
    if (template.id === "lista") return { kicker: "Em três pontos", title: themeTitle(ctx, template, theme), body: lines.join("\n"), cta: say };
    if (template.id === "citacao") return { kicker: name, title: spoken || first, body: name, cta: "" };
    if (template.id === "retrato") return { kicker: "A marca", title: spoken || first, body: name, cta: say };
    if (template.id === "oferta") return { kicker: "Um convite", title: themeTitle(ctx, template, theme), body: ideaBody(ctx, template, theme, "oferta"), cta: say };
    if (template.id === "evento") return { kicker: "Evento", title: themeTitle(ctx, template, theme), body: "Data e local entram quando você confirmar.", cta: say };
    if (template.id === "pergunta") return { kicker: "Uma pergunta", title: question(theme, limits.title), body: ideaBody(ctx, template, theme, "educativo") || first, cta: say };
    if (template.id === "fotografia" || template.id === "bastidor") {
      const purpose = template.id === "bastidor" ? "bastidores" : "lançamento";
      const fromBase = ideaBody(ctx, template, theme, purpose);
      return { kicker: template.id === "bastidor" ? "Bastidores" : fit(ctx.segment || "Fotografia", limits.kicker), title: themeTitle(ctx, template, theme), body: fromBase || photo, cta: say };
    }
    if (template.id === "coluna") return { kicker: fit(ctx.segment || name, limits.kicker), title: first, body: ideaBody(ctx, template, first, "educativo"), cta: say };
    if (template.id === "capa") return { kicker: name, title: themeTitle(ctx, template, theme), body: fit((ctx.brain && ctx.brain.audience) || (ctx.brief && ctx.brief.audience) || ideaBody(ctx, template, theme, "institucional"), limits.body), cta: "" };
    if (template.id === "secao") return { kicker: "01", title: fit(sectionTitle(ctx), limits.title), body: "", cta: "" };
    if (template.id === "conteudo") return { kicker: name, title: first, body: ideaBody(ctx, template, first, "educativo"), cta: "" };
    if (template.id === "dados") {
      const count = Math.max(1, Math.min(lines.length, 3));
      return { kicker: "O que a marca sustenta", title: count === 1 ? "1 ponto" : count + " pontos", body: lines.join("\n"), cta: "" };
    }
    if (template.id === "fecho") return { kicker: say, title: fit(name, limits.title), body: first, cta: say };
    return { kicker: name, title: first, body: ideaBody(ctx, template, first), cta: say };
  }
  function previewPost(templateId, ctx, format, extra) {
    const template = get(templateId) || CATALOG[0];
    const text = draft(template, ctx || {});
    if (extra && extra.kicker) text.kicker = fit(extra.kicker, template.limits.kicker);
    return {
      template: template.id,
      layout: template.layout,
      purpose: template.purposes[0],
      format: format || template.formats[0],
      mood: moodOf(ctx || {}),
      kicker: text.kicker,
      title: text.title,
      copy: text.body,
      cta: text.cta,
      showBrand: template.id !== "capa" && template.id !== "fecho",
      image: null,
      photo: !!template.photo,
      limits: template.limits,
      copySource: knowledgeApi() ? "knowledge" : "fallback",
    };
  }
  function planCampaign(ctx) {
    if (moodOf(ctx) === "warm") {
      return [
        { template: "cartaz", format: "post" },
        { template: "lista", format: "square" },
        { template: "bastidor", format: "story" },
        { template: "oferta", format: "square" },
      ];
    }
    return [
      { template: "margem", format: "post" },
      { template: "pergunta", format: "square" },
      { template: "fotografia", format: "story" },
      { template: "coluna", format: "post" },
    ];
  }
  function planDeck() {
    return [
      { template: "capa", format: "deck" },
      { template: "secao", format: "deck", kicker: "01" },
      { template: "conteudo", format: "deck", kicker: "02" },
      { template: "dados", format: "deck" },
      { template: "fecho", format: "deck" },
    ];
  }
  function contextFrom(body) {
    const source = (body && body.state) || {};
    return {
      name: source.name,
      segment: source.segment,
      description: source.description,
      traits: source.traits || [],
      styles: source.styles || [],
      avoid: source.avoid || [],
      brain: body && body.brain,
      brief: (body && body.brief) || {},
    };
  }
  function fallbackCopy(body) {
    const ctx = contextFrom(body || {});
    const pieces = Array.isArray(body && body.pieces) ? body.pieces : [];
    return {
      pieces: pieces
        .filter((piece) => piece && get(piece.template))
        .map((piece) => {
          const post = previewPost(piece.template, ctx, piece.format, { kicker: piece.kicker });
          return { id: piece.id, kicker: post.kicker, title: post.title, body: post.copy, cta: post.cta };
        }),
    };
  }
  function sanitizeCopy(json, body) {
    const fallback = fallbackCopy(body);
    const incoming = Array.isArray(json && json.pieces) ? json.pieces : [];
    return {
      pieces: fallback.pieces.map((safe) => {
        const spec = (body.pieces || []).find((item) => item && item.id === safe.id) || {};
        const template = get(spec.template);
        const found = incoming.find((item) => item && item.id === safe.id);
        if (!template || !found) return safe;
        const title = fit(found.title, template.limits.title);
        const bodyText = found.body == null ? safe.body : fitBody(found.body, template);
        const kicker = fit(found.kicker, template.limits.kicker) || safe.kicker;
        const cta = safeCta(found.cta, template.limits.cta) || safe.cta;
        if (!title || badClaim(title) || badClaim(bodyText) || badClaim(kicker)) return safe;
        if ((template.id === "evento" || template.id === "oferta" || template.id === "dados" || template.id === "retrato" || template.id === "citacao") && badClaim(found.body)) return safe;
        return { id: safe.id, kicker, title, body: bodyText || safe.body, cta };
      }),
    };
  }
  function applyCopy(posts, incoming, source) {
    const list = Array.isArray(incoming) ? incoming : [];
    return (posts || []).map((post) => {
      if (!post || post.copySource === "user") return post;
      const found = list.find((item) => item && item.id === post.id);
      const template = get(post.template);
      if (!found || !template) return post;
      const title = fit(found.title, template.limits.title);
      if (!title || badClaim(title)) return post;
      let body = found.body == null ? post.copy : fitBody(found.body, template);
      if (badClaim(body) || badClaim(found.body)) body = post.copy;
      let cta = safeCta(found.cta, template.limits.cta);
      if (!cta || /saiba mais/i.test(String(found.cta || ""))) cta = post.cta;
      const kicker = fit(found.kicker, template.limits.kicker) || post.kicker;
      if (badClaim(kicker)) return post;
      return Object.assign({}, post, {
        kicker,
        title,
        copy: body,
        cta,
        copySource: source === "llm" ? "llm" : "fallback",
      });
    });
  }

  return {
    PURPOSES,
    CATALOG,
    moodOf,
    fit,
    badClaim,
    safeCta,
    get,
    forFormat,
    forFilter,
    previewPost,
    planCampaign,
    planDeck,
    fallbackCopy,
    sanitizeCopy,
    applyCopy,
    ctaOf,
  };
});
