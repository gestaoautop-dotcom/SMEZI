/* SMEZI knowledge base. Node reads data/*.json. The browser fetches the same files.
   Classic script sets globalThis.SmeziKnowledge. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmeziKnowledge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const state = { bundle: null, loaded: false };

  function fold(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function hasAlias(hay, alias) {
    const word = fold(alias);
    if (!word) return false;
    if (word.length <= 4) return new RegExp("(^|[^a-z0-9])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(hay);
    return hay.includes(word);
  }
  function indexOf(list, seed, variant) {
    if (!list || !list.length) return 0;
    let hash = 0;
    const text = String(seed || "");
    for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
    return (hash + (Number(variant) || 0)) % list.length;
  }
  function pick(list, seed, variant) {
    if (!list || !list.length) return "";
    return list[indexOf(list, seed, variant)];
  }
  function windowOf(list, count, seed, variant) {
    if (!list || !list.length) return [];
    const start = indexOf(list, seed, variant);
    const size = Math.min(count, list.length);
    const out = [];
    for (let i = 0; i < size; i++) out.push(list[(start + i) % list.length]);
    return out;
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
    return out.replace(/[\s,;:–—-]+$/g, "").trim();
  }
  function niches() {
    const bundle = state.bundle;
    if (!bundle) return [];
    return Object.keys(bundle.niches)
      .filter((id) => id !== "_geral")
      .map((id) => bundle.niches[id]);
  }
  function match(segment, description) {
    const bundle = state.bundle;
    if (!bundle) return null;
    const hay = fold(segment + " " + description);
    let best = null;
    let length = 0;
    for (const niche of niches()) {
      for (const alias of niche.aliases || []) {
        if (hasAlias(hay, alias) && fold(alias).length > length) {
          best = niche;
          length = fold(alias).length;
        }
      }
    }
    return best || bundle.niches._geral || null;
  }
  function variantOf(source) {
    const value = source && (source.variant != null ? source.variant : source.knowledgeVariant);
    return Number(value) || 0;
  }
  function traitLines(source) {
    const map = (state.bundle && state.bundle.archetypes && state.bundle.archetypes.traits) || {};
    return (source.traits || []).map((trait) => map[trait]).filter(Boolean).slice(0, 2);
  }
  function axisLine(source) {
    const axes = state.bundle && state.bundle.archetypes && state.bundle.archetypes.axes;
    if (!source.axesTouched || !Array.isArray(source.axes) || !axes) return "";
    const bits = [];
    source.axes.forEach((value, index) => {
      const axis = axes[index];
      if (!axis) return;
      const number = Number(value);
      if (number < 42) bits.push(axis.lowLine);
      else if (number > 58) bits.push(axis.highLine);
    });
    return bits.filter(Boolean)[0] || "";
  }
  function humorOn(niche, source) {
    const humor = state.bundle.humor || {};
    if ((humor.blockedNiches || []).includes(niche.id)) return false;
    const traits = source.traits || [];
    const avoid = source.avoid || [];
    if (traits.some((trait) => (humor.blockedTraits || []).includes(trait))) return false;
    if (avoid.some((item) => (humor.blockedAvoid || []).includes(item))) return false;
    return traits.some((trait) => (humor.allowedTraits || []).includes(trait));
  }
  function ideasFor(niche, purpose) {
    const found = [];
    for (const pillar of niche.pillars || []) {
      const idea = pillar.ideas && pillar.ideas[purpose];
      if (Array.isArray(idea)) found.push(...idea);
      else if (idea) found.push(idea);
    }
    return found.map(clean).filter(Boolean);
  }
  function phrase(source, options) {
    const opts = options || {};
    const niche = match(source && source.segment, source && (source.description || (source.brief && source.brief.theme))) || { headlines: { short: [] }, messages: [], ctas: [], pillars: [] };
    const purpose = opts.purpose || "institucional";
    const max = opts.max || 80;
    const variant = variantOf(source) + (Number(opts.salt) || 0);
    const seed = clean(source && (source.name || source.segment)) + "|" + purpose + "|" + String(opts.salt || "");
    const fits = (lines) => lines.map(clean).filter((line) => line && line.length <= max && !/saiba mais/i.test(line));
    let pool = [];
    if (opts.kind === "cta") pool = fits(niche.ctas || []);
    else if (opts.kind === "kicker") pool = fits([purpose, niche.name || ""]);
    else {
      pool = fits(ideasFor(niche, purpose));
      if (!pool.length) {
        pool = fits(((niche.headlines && niche.headlines.short) || []).concat((niche.headlines && niche.headlines.medium) || []).concat(niche.messages || []));
      }
    }
    if (!pool.length) return "";
    return fit(pick(pool, seed, variant), max);
  }
  function moodOf(source) {
    const niche = match(source && source.segment, source && source.description);
    if (niche && niche.mood) return niche.mood;
    const traits = (source && source.traits) || [];
    const styles = (source && source.styles) || [];
    const warm = ["ousada", "acessível", "criativa", "humana"].some((item) => traits.includes(item)) || styles.includes("organic") || styles.includes("bold");
    return warm ? "warm" : "sober";
  }
  function compose(source) {
    const input = source || {};
    const niche = match(input.segment, input.description) || { id: "_geral", name: "Ofício em aberto", positioning: [], audiences: [], tones: [], messages: [], photography: {}, composition: {}, avoid: [], palettes: [], type: [] };
    const variant = variantOf(input);
    const name = clean(input.name) || "A marca";
    const description = clean(input.description);
    const seed = name + "|" + (niche.id || "");
    const angle = pick(niche.positioning || [], seed, variant) || "O texto fica com o que foi escrito, sem completar buraco.";
    const positioning = [description ? name + " — " + description.replace(/\.$/, "") + "." : name + " ainda se apresenta pelo que foi dito.", angle].join(" ");
    const audienceLine = pick(niche.audiences || [], seed, variant) || "Quem chega com uma necessidade concreta.";
    const traitNote = traitLines(input)[0];
    const audience = traitNote ? audienceLine + " " + traitNote : audienceLine;
    const tones = niche.tones && niche.tones.length ? niche.tones : [{ summary: "Frase curta, sem jargão.", do: ["Uma ideia por vez."], dont: ["Sem promessa vazia."] }];
    let pool = tones.filter((tone) => (tone.when || []).some((item) => (input.traits || []).includes(item) || (input.styles || []).includes(item)));
    if (!pool.length) pool = tones;
    const tonePick = pool[indexOf(pool, seed, variant)];
    const axis = axisLine(input);
    const tone = {
      summary: [tonePick.summary, axis].filter(Boolean).join(" "),
      do: (tonePick.do || []).slice(0, 3),
      dont: (tonePick.dont || []).slice(0, 3),
    };
    if (humorOn(niche, input)) {
      const humor = state.bundle.humor;
      tone.do = tone.do.concat(humor.do || []).slice(0, 4);
      tone.dont = tone.dont.concat(humor.dont || []).slice(0, 4);
    } else if ((state.bundle.humor.blockedNiches || []).includes(niche.id)) {
      tone.dont = tone.dont.concat(["Humor não entra neste ofício."]).slice(0, 4);
    }
    const messages = windowOf(niche.messages || [], 3, seed, variant).map((line) => fit(line, 140));
    if (description && description.length <= 110 && !messages.includes(description)) messages.unshift(fit(description, 140));
    const photoList = (niche.photography && niche.photography.directions) || [];
    const photo = photoList.length ? photoList[(Number(input.photoVariant) || 0) % photoList.length] : "";
    const references = Array.isArray(input.references) ? input.references.map(clean).filter(Boolean) : [];
    const standard = state.bundle.standard || { composition: { do: [], dont: [] } };
    const expressiva = (input.styles || []).includes("bold") || (input.axesTouched && Number(input.axes && input.axes[1]) > 58);
    const compositionDo = (standard.composition.do || []).concat((niche.composition && niche.composition.do) || []);
    const compositionDont = (standard.composition.dont || []).concat((niche.composition && niche.composition.dont) || []);
    if (expressiva) compositionDo.splice(1, 0, "O título pode ocupar a peça. O resto recua.");
    const ctaPool = (niche.ctas || []).map(clean).filter((line) => line && !/saiba mais/i.test(line));
    let cta = pick(ctaPool, seed, variant) || "Falar com a gente";
    if ((input.traits || []).includes("premium") || (input.traits || []).includes("sofisticada")) {
      cta = ctaPool.find((line) => /conhecer|conversar|marcar/i.test(line)) || cta;
    }
    const seasons = (state.bundle.seasons || []).filter((item) => (item.niches || []).includes(niche.id)).slice(0, 6);
    const type = (niche.type && niche.type[0]) || null;
    return {
      version: 1,
      source: "knowledge",
      reason: null,
      model: null,
      nicheId: niche.id,
      nicheName: niche.name || "",
      positioning: fit(positioning, 500),
      audience: fit(audience, 400),
      tone,
      keyMessages: messages.slice(0, 4),
      cta: fit(cta, 42),
      photography: {
        direction: fit(photo + (references.length ? " Critério de qualidade, sem copiar: " + references.slice(0, 2).join(" e ") + "." : ""), 500),
        do: ((niche.photography && niche.photography.do) || []).slice(0, 4),
        dont: ((niche.photography && niche.photography.dont) || []).slice(0, 4),
      },
      composition: {
        do: compositionDo.filter(Boolean).slice(0, 5),
        dont: compositionDont.filter(Boolean).slice(0, 5),
      },
      typography: {
        hierarchy: type
          ? ["Títulos curtos, na fonte escolhida.", "Texto em uma ideia por bloco.", type.why || "A base sugere um par. A fonte da marca continua a escolhida."]
          : ["Títulos curtos.", "Uma ideia por bloco.", "O nome da marca fica pequeno."],
      },
      avoid: (niche.avoid || []).slice(0, 6),
      seasonal: seasons.map((item) => ({ name: item.name, when: item.when, line: item.line })),
      paletteSuggestions: niche.palettes || [],
      typeSuggestion: type,
      humor: humorOn(niche, input) ? "leve" : "fora",
    };
  }
  function competitors(source) {
    const input = source || {};
    if (!clean(input.segment) && !clean(input.description)) {
      return { note: "Conte o segmento ou o que a marca faz. Sem isso, a base não chuta concorrente.", competitors: [] };
    }
    const niche = match(input.segment, input.description);
    const list = ((niche && niche.competitors) || []).filter((item) => item && clean(item.name));
    if (!list.length) {
      return {
        note: (niche && niche.competitorNote) || "Não há um conjunto confiável para este ofício. Escreva quem disputa o mesmo cliente. A base não inventa empresa.",
        competitors: [],
      };
    }
    const slice = windowOf(list, Math.min(3, list.length), input.name || niche.id, Number(input.competitorVariant) || 0);
    return {
      note: "Sugestões da base para confirmar. Apague o que não disputa o seu cliente.",
      competitors: slice.map((item) => ({
        name: clean(item.name),
        url: /^https:\/\/\S+$/i.test(item.url || "") ? item.url.trim() : "",
        why: clean(item.why) || "Confirme se disputa o mesmo cliente.",
      })),
    };
  }
  function use(bundle) {
    state.bundle = bundle;
    state.loaded = true;
  }
  function loadNode() {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(__dirname, "..", "data");
    const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
    const nicheMap = {};
    for (const id of index.niches) {
      nicheMap[id] = JSON.parse(fs.readFileSync(path.join(dir, "niches", id + ".json"), "utf8"));
    }
    use({
      niches: nicheMap,
      standard: JSON.parse(fs.readFileSync(path.join(dir, "standard.json"), "utf8")),
      archetypes: JSON.parse(fs.readFileSync(path.join(dir, "archetypes.json"), "utf8")),
      humor: JSON.parse(fs.readFileSync(path.join(dir, "humor.json"), "utf8")),
      seasons: JSON.parse(fs.readFileSync(path.join(dir, "seasons.json"), "utf8")),
    });
  }
  function loadBrowser() {
    const ready = (async () => {
      const index = await fetch("./data/index.json").then((response) => response.json());
      const nicheMap = {};
      await Promise.all(
        index.niches.map(async (id) => {
          nicheMap[id] = await fetch("./data/niches/" + id + ".json").then((response) => response.json());
        }),
      );
      const read = (name) => fetch("./data/" + name + ".json").then((response) => response.json());
      use({
        niches: nicheMap,
        standard: await read("standard"),
        archetypes: await read("archetypes"),
        humor: await read("humor"),
        seasons: await read("seasons"),
      });
    })();
    return ready;
  }

  let ready = Promise.resolve();
  if (typeof module === "object" && module.exports) loadNode();
  else ready = loadBrowser();

  return {
    get loaded() {
      return state.loaded;
    },
    ready,
    match: (segment, description) => match(segment, description),
    compose,
    competitors,
    phrase,
    moodOf,
    list: () => niches().map((niche) => ({ id: niche.id, name: niche.name, mood: niche.mood })),
  };
});
