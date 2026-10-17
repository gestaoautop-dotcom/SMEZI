/* Shared Brand Brain logic for the browser and the Vercel function.
   Classic script sets globalThis.SmeziBrain. Node require() gets module.exports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmeziBrain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PRESETS = {
    digital: ["#0a0a0b", "#725cff", "#43e6ff", "#ccff00"],
    warm: ["#201b17", "#c37053", "#e8c79f", "#f7efe6"],
    premium: ["#0d1825", "#b89a5c", "#e7dfd0", "#ffffff"],
    bold: ["#ff4d00", "#ff6ee7", "#151515", "#f5f0e8"],
  };
  const ROLES = {
    digital: [
      ["Base", "Fundo escuro, texto principal e o símbolo."],
      ["Destaque", "Um acento só: número, detalhe ou convite."],
      ["Apoio", "Segundo acento, sempre menor que o destaque."],
      ["Sinal", "Um ponto. Nunca vira o fundo da peça."],
    ],
    warm: [
      ["Base", "Marrom profundo para a marca e os títulos."],
      ["Destaque", "Terracota em detalhes e no convite."],
      ["Apoio", "Areia em blocos secundários."],
      ["Respiro", "Fundo claro, onde o texto respira."],
    ],
    premium: [
      ["Base", "Azul quase preto. Confiança, sem cara de banco."],
      ["Destaque", "Dourado pouco, e no lugar certo."],
      ["Apoio", "Papel quente para áreas de leitura."],
      ["Respiro", "Branco. Margem e silêncio."],
    ],
    bold: [
      ["Energia", "Laranja como gesto, não como grito."],
      ["Destaque", "Rosa em um único foco por peça."],
      ["Base", "Preto para assentar a energia."],
      ["Respiro", "Off-white. Contraste precisa de descanso."],
    ],
    custom: [
      ["Base", "A cor que estrutura a marca."],
      ["Destaque", "A cor do convite, com parcimônia."],
      ["Apoio", "Segunda cor, a serviço do texto."],
      ["Respiro", "A cor que abre espaço."],
    ],
  };
  const STYLE_LABEL = {
    editorial: "editorial",
    minimal: "minimalista",
    tech: "tech",
    organic: "orgânica",
    premium: "premium",
    bold: "expressiva",
  };
  const FONT_LABEL = {
    manrope: "Manrope",
    playfair: "Playfair Display",
    dm: "DM Sans",
    sora: "Sora",
    arial: "Arial",
  };
  const LOGO_LABEL = {
    wordmark: "Wordmark — o nome é o logo",
    symbol: "Símbolo com o nome ao lado",
    mono: "Monograma da inicial",
  };
  const AXES = [
    ["institucional", "experimental"],
    ["minimalista", "expressiva"],
    ["humana", "técnica"],
    ["acessível", "premium"],
    ["clássica", "contemporânea"],
  ];
  const PHOTO = {
    editorial: [
      "Fotografia com ritmo de revista: um plano cinematográfico e um detalhe. Luz natural, cor fiel, pessoa no ofício.",
      "Enquadramento com intenção. Fundo quieto, gesto verdadeiro, sem sorriso de banco de imagem.",
    ],
    minimal: [
      "Pouca coisa no quadro. Luz limpa e muito ar em volta. A foto é precisa, não decorativa.",
      "Um objeto ou uma pessoa, centralizados pelo silêncio ao redor. Sem adereço.",
    ],
    tech: [
      "Ambiente real de trabalho. Tela só quando explica algo. Luz controlada, sem grade neon nem mockup genérico.",
      "Mãos, ferramenta e contexto. A tecnologia aparece no que a pessoa faz, não num fundo de circuito.",
    ],
    organic: [
      "Matéria, mão, lugar. Luz de janela. Textura de verdade e cor que existe no mundo.",
      "Plano próximo de um gesto ou de um material. Nada de cenário montado.",
    ],
    premium: [
      "Luz baixa e dirigida, material nobre sem ostentação. Plano cinematográfico, fundo em silêncio.",
      "Detalhe de superfície e muito espaço. A foto sugere cuidado, não luxo gritado.",
    ],
    bold: [
      "Contraste forte e, ainda assim, uma foto de verdade. Uma pessoa ou um objeto ocupando o quadro.",
      "Presença sem pose de campanha vazia. Cor real, recorte limpo, um foco só.",
    ],
    default: [
      "Luz real, enquadramento com intenção e o contexto da marca. Sem banco de imagem genérico.",
      "Plano cinematográfico, fundo quieto, detalhe que informa. A foto não decora: ela situa.",
      "Ambiente verdadeiro, com espaço negativo. Nada de pose corporativa.",
      "Close de textura ou de gesto. Cor fiel, sem filtro pesado.",
    ],
  };
  const COMPETITOR_SETS = [
    {
      keys: ["financ", "banco", "invest", "crédito", "credito", "pagamento", "fintech"],
      items: [
        ["Nubank", "https://nubank.com.br", "Clareza em serviço financeiro no Brasil."],
        ["Banco Inter", "https://www.bancointer.com.br", "Disputa quem quer banco digital direto."],
        ["XP", "https://www.xpi.com.br", "Referência de investimento para o mesmo tipo de atenção."],
      ],
    },
    {
      keys: ["odont", "dent"],
      items: [
        ["Sorridents", "https://www.sorridents.com.br", "Rede que disputa clínica odontológica."],
        ["Odontocompany", "https://www.odontocompany.com", "Outra rede do mesmo tipo de busca."],
      ],
    },
    {
      keys: ["saúde", "saude", "clínic", "clinic", "médic", "medic", "hospital"],
      items: [
        ["Dr. Consulta", "https://drconsulta.com", "Linguagem acessível em cuidado."],
        ["Dasa", "https://dasa.com.br", "Presença grande em saúde — útil para ver o que não copiar."],
      ],
    },
    {
      keys: ["imóve", "imove", "imobili"],
      items: [
        ["QuintoAndar", "https://www.quintoandar.com.br", "Disputa a busca de quem quer morar ou anunciar."],
        ["Loft", "https://www.loft.com.br", "Outra referência digital do mesmo mercado."],
      ],
    },
    {
      keys: ["educa", "curso", "escola", "ensino"],
      items: [
        ["Alura", "https://www.alura.com.br", "Educação digital com voz didática."],
        ["Duolingo", "https://www.duolingo.com", "Referência de clareza e leveza em aprendizado."],
      ],
    },
    {
      keys: ["beleza", "cosmét", "cosmet", "skincare"],
      items: [
        ["Natura", "https://www.natura.com.br", "Beleza com narrativa própria."],
        ["O Boticário", "https://www.boticario.com.br", "Presença de varejo no mesmo tipo de desejo."],
      ],
    },
    {
      keys: ["moda", "roupa", "vestuário", "vestuario"],
      items: [
        ["Reserva", "https://www.usereserva.com", "Moda brasileira com tom reconhecível."],
        ["Animale", "https://www.animale.com.br", "Outro polo de atenção em moda."],
      ],
    },
    {
      keys: ["delivery", "ifood", "restaurante", "comida"],
      items: [
        ["iFood", "https://www.ifood.com.br", "Onde a atenção de comida costuma estar."],
        ["Rappi", "https://www.rappi.com.br", "Outro app que disputa o mesmo pedido."],
      ],
    },
    {
      keys: ["software", "saas", "aplicativo", "app ", "startup"],
      items: [
        ["Notion", "https://www.notion.so", "Referência de produto digital claro."],
        ["Slack", "https://slack.com", "Disputa a atenção de ferramenta de trabalho."],
      ],
    },
  ];

  function isHex(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim());
  }
  function cleanList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => String(item || "").trim()).filter(Boolean);
  }
  function joinPt(list) {
    const items = cleanList(list);
    if (items.length <= 1) return items[0] || "";
    return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
  }
  function clip(value, max) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trim() + "…";
  }
  function colorsOf(state) {
    const source = state || {};
    if (Array.isArray(source.colors) && source.colors.length >= 4 && source.colors.slice(0, 4).every(isHex)) {
      return source.colors.slice(0, 4).map((color) => color.toLowerCase());
    }
    if (source.palette === "custom" && Array.isArray(source.customPalette) && source.customPalette.length >= 4) {
      return source.customPalette.slice(0, 4).map((color) => (isHex(color) ? color.toLowerCase() : "#0a0a0b"));
    }
    return (PRESETS[source.palette] || PRESETS.digital).slice();
  }
  function applyAccentEdit(state, picked) {
    const current = colorsOf(state).slice(0, 4);
    const accent = String(current[1] || "").toLowerCase();
    const nextPick = String(picked || "").trim().toLowerCase();
    if (!isHex(nextPick) || nextPick === accent) {
      return {
        changed: false,
        colors: current,
        palette: (state && state.palette) || "digital",
        customPalette: state && state.customPalette ? state.customPalette.slice(0, 4) : null,
      };
    }
    const next = [current[0], nextPick, current[2], current[3]];
    return { changed: true, colors: next, palette: "custom", customPalette: next };
  }
  function checks(state) {
    const source = state || {};
    return [
      { id: "name", label: "Nome", ok: !!String(source.name || "").trim() },
      { id: "segment", label: "Segmento", ok: !!String(source.segment || "").trim() },
      { id: "description", label: "O que a marca faz", ok: !!String(source.description || "").trim() },
      { id: "competitors", label: "Concorrentes", ok: cleanList(source.competitors).length > 0 },
      { id: "references", label: "Referências", ok: cleanList(source.references).length > 0 },
      { id: "traits", label: "Personalidade", ok: cleanList(source.traits).length > 0 },
      { id: "avoid", label: "O que evitar", ok: cleanList(source.avoid).length > 0 },
      { id: "styles", label: "Direção visual", ok: cleanList(source.styles).length > 0 },
      { id: "font", label: "Tipografia", ok: !!(source.confirmedVisual || source.touchedFont) },
      { id: "palette", label: "Paleta", ok: !!(source.confirmedVisual || source.touchedPalette) },
      { id: "logo", label: "Caminho de logo", ok: !!(source.confirmedVisual || source.touchedLogo) },
      { id: "axes", label: "Eixos", ok: !!source.axesTouched },
    ];
  }
  function completeness(state) {
    const items = checks(state);
    const done = items.filter((item) => item.ok).length;
    return {
      done,
      total: items.length,
      percent: Math.round((done / items.length) * 100),
      items,
    };
  }
  function styleLabels(styles) {
    return cleanList(styles).map((style) => STYLE_LABEL[style] || style);
  }
  function axisPhrase(state) {
    if (!state || !state.axesTouched || !Array.isArray(state.axes)) return "";
    return state.axes
      .slice(0, 5)
      .map((value, index) => {
        const pair = AXES[index];
        const numeric = Number(value);
        if (!pair || Number.isNaN(numeric)) return "";
        if (numeric < 42) return pair[0];
        if (numeric > 58) return pair[1];
        return pair[0] + " com traço " + pair[1];
      })
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
  }
  function photoBank(state) {
    const styles = cleanList(state && state.styles);
    const key = styles.find((style) => PHOTO[style]) || "default";
    return PHOTO[key];
  }
  function photoNote(state) {
    const bank = photoBank(state);
    const index = Math.abs(Number(state && state.photoVariant) || 0) % bank.length;
    return bank[index];
  }
  function typePair(font) {
    if (font === "playfair") return { display: "Playfair Display", text: "Manrope" };
    if (font === "dm") return { display: "DM Sans", text: "DM Sans" };
    if (FONT_LABEL[font]) return { display: FONT_LABEL[font], text: FONT_LABEL[font] };
    return { display: "Manrope", text: "Manrope" };
  }
  function discreetCta(traits, styles) {
    if (traits.includes("premium") || traits.includes("sofisticada")) return "Conhecer";
    if (traits.includes("acessível") || traits.includes("humana")) return "Falar com a gente";
    if (styles.includes("bold")) return "Ver como funciona";
    return "Seguir";
  }
  function humorFits(traits, avoid) {
    const playful = traits.includes("criativa") || traits.includes("ousada") || traits.includes("humana");
    const blocked = avoid.includes("infantil") || traits.includes("premium") || traits.includes("técnica") || traits.includes("sofisticada");
    return playful && !blocked;
  }
  function paletteRoles(state) {
    const colors = colorsOf(state);
    const table = ROLES[state && state.palette] || ROLES.custom;
    return colors.map((hex, index) => ({
      hex,
      role: table[index][0],
      usage: table[index][1],
    }));
  }
  function readingOf(state) {
    const name = String((state && state.name) || "").trim();
    const segment = String((state && state.segment) || "").trim();
    const description = String((state && state.description) || "").trim();
    const site = String((state && state.site) || "").trim();
    const traits = cleanList(state && state.traits);
    const avoid = cleanList(state && state.avoid);
    const styles = styleLabels(state && state.styles);
    const competitors = cleanList(state && state.competitors);
    const references = cleanList(state && state.references);
    const font = typePair(state && state.font).display;
    const logo = LOGO_LABEL[(state && state.logo) || "symbol"] || LOGO_LABEL.symbol;
    const axes = axisPhrase(state);
    const parts = [];
    parts.push(name ? name : "Uma marca ainda sem nome");
    parts.push(segment ? "atua em " + segment : "ainda não contou o segmento");
    if (description) parts.push("e se descreve assim: “" + clip(description, 160) + "”");
    let text = parts[0] + " " + parts.slice(1).join(" ");
    if (!/[.!?…]$/.test(text)) text += ".";
    text += site ? " Site informado." : " Sem site — e tudo bem.";
    text += competitors.length
      ? " Concorrentes considerados: " + joinPt(competitors.slice(0, 5)) + "."
      : " Nenhum concorrente foi nomeado, então o guia não inventou um.";
    text += references.length
      ? " Referências de qualidade, não de cópia: " + joinPt(references.slice(0, 5)) + "."
      : " Sem referências de admiração.";
    text += traits.length ? " Personalidade: " + joinPt(traits) + "." : " Personalidade ainda em aberto.";
    text += avoid.length ? " Não deve parecer " + joinPt(avoid) + "." : " Nada foi marcado em “não pareça”.";
    text += styles.length ? " Direção visual " + joinPt(styles) + "." : " Direção visual ainda não escolhida.";
    text += " Fonte " + font + ". Caminho de logo: " + logo + ".";
    if (axes) text += " Eixos: " + axes + ".";
    return text;
  }
  function buildFallbackBrain(input) {
    const state = input || {};
    const name = String(state.name || "").trim() || "Sua marca";
    const segment = String(state.segment || "").trim();
    const description = String(state.description || "").trim();
    const traits = cleanList(state.traits);
    const avoid = cleanList(state.avoid);
    const styles = cleanList(state.styles);
    const styleText = styleLabels(styles);
    const traitText = traits.length ? joinPt(traits.slice(0, 3)) : "clara e direta";
    const avoidText = avoid.length ? joinPt(avoid.slice(0, 3)) : "genérica";
    const field = segment || "o que ela faz";
    const axes = axisPhrase(state);
    const pair = typePair(state.font);
    const logoKey = LOGO_LABEL[state.logo] ? state.logo : "symbol";
    let positioning = description
      ? name + " " + description.replace(/\.$/, "") + "."
      : name + (segment ? " atua em " + segment + "." : " ainda está se apresentando.");
    positioning += " A presença é " + traitText + ", longe de parecer " + avoidText + ".";
    if (styleText.length) positioning += " A direção visual é " + joinPt(styleText) + ".";
    if (axes) positioning += " No eixo, pende para " + axes + ".";
    const audience = segment
      ? "Pessoas que procuram " + segment + " e preferem uma marca " + (traits[0] || "direta") + " a uma marca " + (avoid[0] || "genérica") + "."
      : "Quem chega com uma necessidade concreta e pouca paciência para texto genérico.";
    const playful = humorFits(traits, avoid);
    const tone = {
      summary: playful
        ? "Frases curtas, concretas, com um humor leve só quando cabe. Sem jargão e sem promessa vazia."
        : "Frases curtas e concretas. Sem jargão, sem ironia e sem promessa vazia.",
      do: [
        description ? "“" + clip(description, 90) + "”" : "“" + name + " cuida de " + field + " sem enrolação.”",
        traits.includes("humana") || traits.includes("acessível")
          ? "“A gente explica antes de oferecer.”"
          : "“O próximo passo é um só, e está claro.”",
        playful ? "“Sério no que importa. Leve no que pode.”" : "“Menos adjetivo. Mais o que acontece de verdade.”",
      ],
      dont: [
        avoid.includes("startup clichê")
          ? "“Somos disruptivos e entregamos um ecossistema 360.”"
          : "“A solução completa para transformar a sua jornada.”",
        avoid[0] ? "Não deixar a frase escorregar para um tom " + avoid[0] + "." : "“A melhor do mercado, líder absoluta.”",
        "Não usar humor que diminui o cliente, nem caixa alta para parecer urgência.",
      ],
    };
    const keyMessages = [
      description ? clip(description, 120) : name + " torna " + field + " mais claro.",
      traits.length ? "Uma marca " + joinPt(traits.slice(0, 2)) + "." : name + " prefere precisão a volume.",
      avoid.length ? "Presença reconhecível, sem parecer " + avoid[0] + "." : "Uma ideia por peça. O resto é espaço.",
    ];
    const photo = photoNote(state);
    const references = cleanList(state.references);
    const photography = {
      direction: photo + (references.length ? " O critério de qualidade vem de " + joinPt(references.slice(0, 2)) + ", sem copiar o visual." : ""),
      do: [
        "Luz de verdade e enquadramento com intenção.",
        "Mostrar o contexto de " + (segment || name) + ": gente, lugar ou matéria.",
        "Cor fiel. A paleta da marca entra no layout, não num filtro.",
      ],
      dont: [
        "Banco de imagem com aperto de mão ou sorriso corporativo.",
        "Filtro pesado, grade neon e mockup genérico.",
        "Foto que só decora e não diz onde a marca está.",
      ],
    };
    const expressiva = styles.includes("bold") || (state.axesTouched && Number(state.axes && state.axes[1]) > 58);
    const composition = {
      do: [
        "Muito espaço em branco e um foco por peça.",
        expressiva ? "O título pode ocupar a peça. O resto recua." : "Tipografia resolvida antes de qualquer enfeite.",
        "Uma chamada discreta, no fim, sem pressa.",
      ],
      dont: [
        "Não encher a peça de selos, ícones e gradientes.",
        "Não repetir a mesma frase no título e no apoio.",
        expressiva ? "Energia sim. Poluição visual, não." : "Não aumentar o contraste só para chamar atenção.",
      ],
    };
    const logoUsage = {
      wordmark: "O nome escrito é o logo. Use a fonte de título, em caixa consistente, com área livre em volta equivalente à altura da letra.",
      symbol: "O símbolo acompanha o nome. No espaço pequeno, o símbolo pode ir sozinho; no espaço grande, os dois entram juntos e alinhados.",
      mono: "A inicial funciona como monograma em avatar, favicon e marca d'água. Em peças maiores, a inicial não substitui o nome.",
    };
    return {
      version: 1,
      source: "fallback",
      reason: null,
      model: null,
      generatedAt: new Date().toISOString(),
      editedAt: null,
      positioning: clip(positioning, 500),
      audience,
      tone,
      keyMessages,
      cta: discreetCta(traits, styles),
      palette: paletteRoles(state),
      typography: {
        display: pair.display,
        text: pair.text,
        hierarchy: [
          "Títulos em " + pair.display + ", grandes e curtos.",
          "Texto em " + pair.text + ", uma ideia por bloco.",
          "O nome da marca fica pequeno. Quem fala alto é a mensagem.",
        ],
      },
      photography,
      composition,
      logo: {
        type: logoKey,
        label: LOGO_LABEL[logoKey],
        usage: logoUsage[logoKey],
        dont: [
          "Não esticar, não mudar a cor fora da paleta e não colocar sombra.",
          "Não redesenhar a inicial com outra fonte em cada peça.",
          "Não usar o logo como textura de fundo.",
        ],
      },
      reading: readingOf(state),
    };
  }
  function textOf(value, max, fallback) {
    const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
    return text ? clip(text, max) : fallback;
  }
  function listOf(value, max, count, fallback) {
    const items = Array.isArray(value)
      ? value.map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : "")).filter(Boolean).slice(0, count).map((item) => clip(item, max))
      : [];
    return items.length ? items : fallback.slice();
  }
  function sanitizeBrain(raw, state, model) {
    const fallback = buildFallbackBrain(state);
    const source = raw && typeof raw === "object" ? raw : {};
    const tone = source.tone && typeof source.tone === "object" ? source.tone : {};
    const typography = source.typography && typeof source.typography === "object" ? source.typography : {};
    const photography = source.photography && typeof source.photography === "object" ? source.photography : {};
    const composition = source.composition && typeof source.composition === "object" ? source.composition : {};
    const logo = source.logo && typeof source.logo === "object" ? source.logo : {};
    const colors = colorsOf(state);
    const palette = colors.map((hex, index) => {
      const item = Array.isArray(source.palette) ? source.palette[index] : null;
      const safe = item && typeof item === "object" ? item : {};
      return {
        hex,
        role: textOf(safe.role, 32, fallback.palette[index].role),
        usage: textOf(safe.usage, 180, fallback.palette[index].usage),
      };
    });
    return {
      version: 1,
      source: "llm",
      reason: null,
      model: model || source.model || null,
      generatedAt: new Date().toISOString(),
      editedAt: null,
      positioning: textOf(source.positioning, 500, fallback.positioning),
      audience: textOf(source.audience, 400, fallback.audience),
      tone: {
        summary: textOf(tone.summary, 400, fallback.tone.summary),
        do: listOf(tone.do, 180, 4, fallback.tone.do),
        dont: listOf(tone.dont, 180, 4, fallback.tone.dont),
      },
      keyMessages: listOf(source.keyMessages, 180, 4, fallback.keyMessages),
      cta: textOf(source.cta, 42, fallback.cta),
      palette,
      typography: {
        display: fallback.typography.display,
        text: fallback.typography.text,
        hierarchy: listOf(typography.hierarchy, 180, 4, fallback.typography.hierarchy),
      },
      photography: {
        direction: textOf(photography.direction, 500, fallback.photography.direction),
        do: listOf(photography.do, 180, 4, fallback.photography.do),
        dont: listOf(photography.dont, 180, 4, fallback.photography.dont),
      },
      composition: {
        do: listOf(composition.do, 180, 4, fallback.composition.do),
        dont: listOf(composition.dont, 180, 4, fallback.composition.dont),
      },
      logo: {
        type: fallback.logo.type,
        label: fallback.logo.label,
        usage: textOf(logo.usage, 400, fallback.logo.usage),
        dont: listOf(logo.dont, 180, 4, fallback.logo.dont),
      },
      reading: fallback.reading,
    };
  }
  function competitorFallback(input) {
    const state = input || {};
    const haystack = (String(state.segment || "") + " " + String(state.description || "") + " " + String(state.name || "")).toLowerCase();
    if (!String(state.segment || "").trim() && !String(state.description || "").trim()) {
      return {
        note: "Conte o segmento ou o que a marca faz. Sem isso, eu não chuto concorrente.",
        competitors: [],
      };
    }
    const match = COMPETITOR_SETS.find((set) => set.keys.some((key) => haystack.includes(key)));
    if (!match) {
      return {
        note: "Não há um conjunto confiável só com esse segmento. Escreva quem disputa o mesmo cliente. Eu não vou inventar empresa.",
        competitors: [],
      };
    }
    return {
      note: "Sugestões para confirmar — exemplos de quem disputa uma atenção parecida, não uma pesquisa fechada.",
      competitors: match.items.map(([name, url, why]) => ({ name, url, why })),
    };
  }
  function sanitizeCompetitors(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const items = Array.isArray(source.competitors) ? source.competitors : [];
    const competitors = [];
    for (const item of items) {
      if (!item || typeof item !== "object" || competitors.length >= 5) break;
      const name = textOf(item.name, 80, "");
      if (!name) continue;
      let url = typeof item.url === "string" ? item.url.trim() : "";
      if (url && !/^https:\/\/[^\s]+$/i.test(url)) url = "";
      competitors.push({ name, url, why: textOf(item.why, 180, "Confirme se disputa o mesmo cliente.") });
    }
    return {
      note: textOf(source.note, 240, "Sugestões para você confirmar. Apague o que não for concorrente de verdade."),
      competitors,
    };
  }
  function publicInput(state) {
    const source = state || {};
    return {
      name: String(source.name || "").trim(),
      site: String(source.site || "").trim(),
      segment: String(source.segment || "").trim(),
      description: String(source.description || "").trim(),
      competitors: cleanList(source.competitors).slice(0, 8),
      references: cleanList(source.references).slice(0, 8),
      traits: cleanList(source.traits).slice(0, 16),
      avoid: cleanList(source.avoid).slice(0, 16),
      styles: cleanList(source.styles).slice(0, 8),
      font: source.font || "manrope",
      palette: source.palette || "digital",
      colors: colorsOf(source),
      customPalette: source.palette === "custom" ? colorsOf(source) : null,
      logo: source.logo || "symbol",
      axes: source.axesTouched && Array.isArray(source.axes) ? source.axes.slice(0, 5).map(Number) : null,
      axesTouched: !!source.axesTouched,
      photoVariant: Number(source.photoVariant) || 0,
      confirmedVisual: !!source.confirmedVisual,
      touchedFont: !!source.touchedFont,
      touchedPalette: !!source.touchedPalette,
      touchedLogo: !!source.touchedLogo,
    };
  }
  function stamp(state) {
    const input = publicInput(state);
    delete input.photoVariant;
    return JSON.stringify(input);
  }
  async function fetchBrain(action, state, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 28000);
    try {
      const response = await fetch("/api/brand-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, state: publicInput(state) }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("status " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    PRESETS,
    FONT_LABEL,
    LOGO_LABEL,
    colorsOf,
    applyAccentEdit,
    completeness,
    photoNote,
    buildFallbackBrain,
    sanitizeBrain,
    competitorFallback,
    sanitizeCompetitors,
    publicInput,
    stamp,
    fetchBrain,
    readingOf,
  };
});
