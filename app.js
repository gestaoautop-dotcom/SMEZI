const app = document.querySelector("#app");
const homeTpl = document.querySelector("#homeTemplate");
const studioTpl = document.querySelector("#studioTemplate");
const STORAGE = "smezi-brand-studio-v1";
const initial = {
  name: "",
  site: "",
  segment: "",
  description: "",
  competitors: ["", "", "", "", ""],
  references: ["", "", ""],
  traits: [],
  avoid: [],
  styles: [],
  customTraits: [],
  customAvoid: [],
  font: "manrope",
  palette: "digital",
  logo: "symbol",
  axes: [62, 38, 54, 58, 72],
  confirmedVisual: false,
  touchedFont: false,
  touchedPalette: false,
  touchedLogo: false,
  axesTouched: false,
  photoVariant: 0,
  competitorNote: "",
};
const palettes = {
  digital: ["#0a0a0b", "#725cff", "#43e6ff", "#ccff00"],
  warm: ["#201b17", "#c37053", "#e8c79f", "#f7efe6"],
  premium: ["#0d1825", "#b89a5c", "#e7dfd0", "#ffffff"],
  bold: ["#ff4d00", "#ff6ee7", "#151515", "#f5f0e8"],
};
const traits = [
  "inteligente",
  "sofisticada",
  "humana",
  "inovadora",
  "forte",
  "acessível",
  "técnica",
  "premium",
  "minimalista",
  "ousada",
  "contemporânea",
  "criativa",
];
const avoid = [
  "genérica",
  "infantil",
  "startup clichê",
  "antiga",
  "artificial",
  "fria",
  "exageradamente luxuosa",
  "confusa",
  "corporativa demais",
];
const PRESET_IDS = ["digital", "warm", "premium", "bold"];

function readLegacyState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
function copyList(value, fallback) {
  return Array.isArray(value) ? value.map((item) => item) : fallback.slice();
}
function normalizeState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const state = { ...initial };
  Object.assign(state, source);
  state.competitors = copyList(source.competitors, initial.competitors);
  state.references = copyList(source.references, initial.references);
  state.traits = copyList(source.traits, initial.traits);
  state.avoid = copyList(source.avoid, initial.avoid);
  state.styles = copyList(source.styles, initial.styles);
  state.customTraits = copyList(source.customTraits, []);
  state.customAvoid = copyList(source.customAvoid, []);
  state.axes =
    Array.isArray(source.axes) && source.axes.length === 5 && source.axes.every((value) => typeof value === "number")
      ? source.axes.slice()
      : initial.axes.slice();
  while (state.competitors.length < 5) state.competitors.push("");
  while (state.references.length < 3) state.references.push("");
  state.axesTouched = !!source.axesTouched || state.axes.some((value, index) => value !== initial.axes[index]);
  state.touchedFont = !!source.touchedFont;
  state.touchedPalette = !!source.touchedPalette;
  state.touchedLogo = !!source.touchedLogo;
  state.photoVariant = Number.isInteger(source.photoVariant) ? source.photoVariant : 0;
  state.competitorNote = typeof source.competitorNote === "string" ? source.competitorNote : "";
  const legacyVisual =
    source.confirmedVisual === undefined &&
    source.font &&
    source.palette &&
    source.logo &&
    String(source.name || "").trim();
  state.confirmedVisual = !!source.confirmedVisual || !!legacyVisual;
  if (source.brain && typeof source.brain === "object") state.brain = source.brain;
  if (Array.isArray(source.customPalette)) state.customPalette = source.customPalette.slice();
  return state;
}
let state = normalizeState(readLegacyState());
let step = 0;
const stepMeta = [
  ["Conhecendo o negócio", "Qual é o nome da sua marca?"],
  ["Contexto & referências", "Quem disputa a atenção do seu cliente?"],
  ["Briefing inteligente", "Como sua marca deve ser percebida?"],
  ["Direção visual", "Sem termos técnicos. Só: “gosto disso”."],
  ["Visual Board", "Agora vamos montar a identidade."],
  ["Síntese", "Entendi sua marca assim."],
];

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(state));
  updatePreview();
}
function escapeHTML(s = "") {
  return String(s).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}
function score() {
  return SmeziBrain.completeness(state);
}
function paintScore(root) {
  const current = score();
  const ring = root && root.querySelector ? root.querySelector(".brain-ring") : null;
  if (ring) {
    ring.style.background = `conic-gradient(var(--lime) ${current.percent}%, #333 0)`;
    const label = ring.querySelector("span");
    if (label) label.textContent = current.percent;
  }
  const count = document.querySelector("#summaryCount");
  if (count) count.textContent = `${current.done} de ${current.total} campos respondidos. Não é uma nota de qualidade.`;
  const missing = document.querySelector("#summaryMissing");
  if (missing) {
    const open = current.items.filter((item) => !item.ok).map((item) => item.label);
    missing.textContent = open.length
      ? "Ainda em aberto: " + open.join(", ") + "."
      : "O que o assistente pergunta está respondido. Dá para seguir e editar depois.";
  }
  const percent = document.querySelector("#brainPercent");
  const bar = document.querySelector("#brainBar");
  if (percent) percent.textContent = current.percent + "%";
  if (bar) bar.style.width = current.percent + "%";
  const meter = document.querySelector(".brain-meter");
  if (meter) meter.title = `${current.done} de ${current.total} campos respondidos`;
}
function showHome() {
  app.innerHTML = "";
  app.append(homeTpl.content.cloneNode(true));
  document.querySelectorAll('[data-action="brand"]').forEach((b) => (b.onclick = showStudio));
}
function showStudio() {
  app.innerHTML = "";
  app.append(studioTpl.content.cloneNode(true));
  document.querySelector("#railHome").onclick = showHome;
  document.querySelector("#backBtn").onclick = () => {
    if (step === 0) return showHome();
    step--;
    renderStep();
  };
  document.querySelector("#nextBtn").onclick = () => {
    if (step < 5) {
      if (step === 4) state.confirmedVisual = true;
      step++;
      renderStep();
    } else if (window.SmeziGuide) SmeziGuide.createIdentity();
  };
  document.querySelectorAll(".rail-step").forEach(
    (b) =>
      (b.onclick = () => {
        const next = +b.dataset.step;
        if (step === 4 && next !== 4) state.confirmedVisual = true;
        step = next;
        renderStep();
      }),
  );
  const expand = document.querySelector(".live-head button");
  if (expand) expand.onclick = expandBoard;
  renderStep();
}
function renderStep() {
  const [eye, title] = stepMeta[step];
  document.querySelector("#stepEyebrow").textContent = eye;
  document.querySelector("#stepTitle").textContent = title;
  document.querySelector("#stepCurrent").textContent = String(step + 1).padStart(2, "0");
  const body = document.querySelector("#stageBody");
  body.innerHTML = "";
  if (step === 0) renderBusiness(body);
  if (step === 1) renderRefs(body);
  if (step === 2) renderPersonality(body);
  if (step === 3) renderVisualDirections(body);
  if (step === 4) renderBoard(body);
  if (step === 5) renderSummary(body);
  document.querySelector("#backBtn").textContent = step === 0 ? "← início" : "← voltar";
  document.querySelector("#nextBtn").innerHTML =
    step === 5 ? "criar minha identidade <span>✦</span>" : "continuar <span>→</span>";
  document.querySelectorAll(".rail-step").forEach((b, i) => {
    b.classList.toggle("active", i === step);
    b.classList.toggle("done", i < step);
  });
  document.querySelector("#railProgress").style.height = `${Math.min((step / 5) * 88, 88)}%`;
  const current = score();
  const meter = document.querySelector(".brain-meter");
  document.querySelector("#brainPercent").textContent = current.percent + "%";
  document.querySelector("#brainBar").style.width = current.percent + "%";
  if (meter) meter.title = `${current.done} de ${current.total} campos respondidos`;
  updatePreview();
  body.animate(
    [
      { opacity: 0.2, transform: "translateY(8px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 260, easing: "ease-out" },
  );
}
function inputField(label, key, placeholder, type = "text") {
  return `<div class="field"><label>${label}</label><input type="${type}" data-key="${key}" value="${escapeHTML(state[key] || "")}" placeholder="${placeholder}"></div>`;
}
function renderBusiness(el) {
  el.innerHTML = `<div class="field-stack">${inputField("NOME DA MARCA / NEGÓCIO", "name", "ex.: SMEZI")}${inputField("SITE — SE EXISTIR", "site", "https://")}${inputField("SEGMENTO", "segment", "ex.: tecnologia, saúde, financeiro...")}<div class="field"><label>EM UMA FRASE, O QUE VOCÊ FAZ? <span style="font-weight:400">(opcional)</span></label><textarea data-key="description" placeholder="Sem texto perfeito. Escreva como você explicaria para alguém.">${escapeHTML(state.description || "")}</textarea></div><p class="micro-note">✦ Pode ser só um nome, uma ideia e uma cor. O que faltar a gente não inventa.</p></div>`;
  bindInputs(el);
  document.querySelector("#footerNote").textContent = "Pode mudar tudo depois.";
}
function linkRows(listName) {
  return state[listName]
    .map(
      (value, index) =>
        `<div class="link-row"><input data-list="${listName}" data-index="${index}" value="${escapeHTML(value)}" placeholder="site, Instagram ou nome"><button type="button" data-open-link="${listName}" data-index="${index}" title="Abrir link">↗</button></div>`,
    )
    .join("");
}
function renderRefs(el) {
  const note = state.competitorNote
    ? `<p class="suggest-note" role="status">${escapeHTML(state.competitorNote)}</p>`
    : "";
  el.innerHTML = `<p class="micro-note">Concorrente é quem disputa o mesmo cliente. Referência é quem você admira, mesmo que venda outra coisa.</p><h4 class="subhead">Concorrentes</h4><div class="link-list" id="competitors">${linkRows("competitors")}</div><button type="button" class="find-btn" id="findCompetitors">Ver exemplos da base</button><button type="button" class="text-btn" id="moreCompetitors">Mostrar outras</button>${note}${state.competitors.length < 8 ? '<button type="button" class="text-btn add-link" data-add-slot="competitors">+ outro concorrente</button>' : ""}<h4 class="subhead">Marcas que você admira</h4><div class="link-list">${linkRows("references")}</div>${state.references.length < 8 ? '<button type="button" class="text-btn add-link" data-add-slot="references">+ outra referência</button>' : ""}`;
  bindListInputs(el);
  el.querySelectorAll("[data-open-link]").forEach((button) => {
    button.onclick = () => openLink(state[button.dataset.openLink][+button.dataset.index]);
  });
  el.querySelectorAll("[data-add-slot]").forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.addSlot;
      if (state[key].length >= 8) return;
      state[key].push("");
      save();
      renderRefs(el);
    };
  });
  const finder = el.querySelector("#findCompetitors");
  if (finder) finder.onclick = () => suggestCompetitors(false);
  const more = el.querySelector("#moreCompetitors");
  if (more) more.onclick = () => suggestCompetitors(true);
  document.querySelector("#footerNote").textContent = "Concorrentes ≠ referências.";
}
function openLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return;
  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("@")) url = "https://instagram.com/" + url.slice(1);
    else if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(url)) url = "https://" + url;
    else return;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    window.open(parsed.href, "_blank", "noopener");
  } catch {
    /* ignore malformed links */
  }
}
function suggestCompetitors(rotate) {
  if (rotate) {
    const shown = Array.isArray(state.competitorShown) ? state.competitorShown : [];
    state.competitors = state.competitors.map((value) => (shown.includes(value) ? "" : value));
    state.competitorVariant = (Number(state.competitorVariant) || 0) + 1;
  }
  const result = SmeziBrain.competitorFallback(state);
  const suggestions = (result && result.competitors) || [];
  const placed = [];
  for (const item of suggestions) {
    const label = item.url || item.name;
    if (!label) continue;
    if (state.competitors.some((value) => String(value || "").trim().toLowerCase() === String(label).toLowerCase())) {
      placed.push(label);
      continue;
    }
    let index = state.competitors.findIndex((value) => !String(value || "").trim());
    if (index < 0) {
      if (state.competitors.length >= 8) break;
      state.competitors.push("");
      index = state.competitors.length - 1;
    }
    state.competitors[index] = label;
    placed.push(label);
  }
  state.competitorShown = placed;
  state.competitorNote =
    placed.length > 0
      ? (result && result.note) || "Sugestões da base para confirmar. Apague o que não disputa o seu cliente."
      : (result && result.note) || "A base não tem um exemplo novo para este ofício.";
  save();
  const body = document.querySelector("#stageBody");
  if (body && step === 1) renderRefs(body);
}
function tagHTML(value, key) {
  const selected = state[key].includes(value);
  return `<button type="button" class="choice ${selected ? "selected" : ""}" data-tag="${escapeHTML(key)}" data-value="${escapeHTML(value)}">${escapeHTML(value)}</button>`;
}
function addForm(key) {
  const label = key === "traits" ? "Adicionar outra característica" : "Adicionar outro limite";
  return `<form class="choice-add" data-add="${key}"><input maxlength="32" placeholder="＋ outro" aria-label="${label}"><button type="submit">ok</button></form>`;
}
function renderPersonality(el) {
  const wanted = traits.concat(state.customTraits.filter((item) => !traits.includes(item)));
  const blocked = avoid.concat(state.customAvoid.filter((item) => !avoid.includes(item)));
  el.innerHTML = `<p class="micro-note">Escolha quantas quiser. Não procure a resposta certa — procure o que parece verdadeiro.</p><h4 class="subhead">Quero que minha marca pareça...</h4><div class="choice-grid">${wanted.map((item) => tagHTML(item, "traits")).join("")}${addForm("traits")}</div><h4 class="subhead">E definitivamente NÃO pareça...</h4><div class="choice-grid">${blocked.map((item) => tagHTML(item, "avoid")).join("")}${addForm("avoid")}</div>`;
  bindTags(el);
  el.querySelectorAll("[data-add]").forEach((form) => {
    form.onsubmit = (event) => {
      event.preventDefault();
      const key = form.dataset.add;
      const input = form.querySelector("input");
      const value = input.value.trim().slice(0, 32);
      if (!value) return;
      const customKey = key === "traits" ? "customTraits" : "customAvoid";
      if (!state[customKey].includes(value) && !(key === "traits" ? traits : avoid).includes(value)) state[customKey].push(value);
      if (!state[key].includes(value)) state[key].push(value);
      save();
      renderPersonality(el);
    };
  });
  document.querySelector("#footerNote").textContent = "Seleção múltipla liberada.";
}
function renderVisualDirections(el) {
  const styles = [
    ["editorial", "Editorial", "ritmo, contraste e personalidade"],
    ["minimal", "Minimalista", "silêncio visual e precisão"],
    ["tech", "Tech", "digital, fluido e inteligente"],
    ["organic", "Orgânico", "formas naturais e proximidade"],
    ["premium", "Premium", "luxo discreto e confiança"],
    ["bold", "Expressivo", "energia e presença"],
  ];
  el.innerHTML = `<p class="micro-note">Você não precisa saber o nome do estilo. Olhe e escolha o que te atrai. Pode não escolher nenhum ainda.</p><div class="visual-options">${styles
    .map(
      ([key, name, description]) =>
        `<button type="button" class="visual-option ${state.styles.includes(key) ? "selected" : ""}" data-style="${key}"><div class="style-art ${key}"></div><div><strong>${name}</strong><p>${description}</p></div></button>`,
    )
    .join("")}</div>`;
  el.querySelectorAll("[data-style]").forEach(
    (b) =>
      (b.onclick = () => {
        const value = b.dataset.style;
        state.styles = state.styles.includes(value) ? state.styles.filter((item) => item !== value) : state.styles.concat(value);
        save();
        renderVisualDirections(el);
      }),
  );
  document.querySelector("#footerNote").textContent = "Gosto disso. É suficiente.";
}
function renderBoard(el) {
  const paletteButton = (id, cols) =>
    `<button type="button" class="palette ${state.palette === id ? "selected" : ""}" data-palette="${id}">${cols.map((color) => `<i style="background:${color}"></i>`).join("")}</button>`;
  const ids = PRESET_IDS.filter((id) => palettes[id]);
  const sample = (state.name || "MARCA").toUpperCase().slice(0, 18);
  const letter = (state.name || "M").charAt(0).toUpperCase();
  const photo = SmeziBrain.photoNote(state);
  el.innerHTML = `<div class="board-controls"><section class="board-section"><h4>TIPOGRAFIA <span style="color:#999;font-weight:400">— aplicada, não em lista</span></h4><div class="font-options"><button type="button" class="font-chip ${state.font === "manrope" ? "selected" : ""}" data-font="manrope"><strong style="font-family:Manrope">Aa</strong><span>Manrope / limpa</span></button><button type="button" class="font-chip ${state.font === "playfair" ? "selected" : ""}" data-font="playfair"><strong style="font-family:'Playfair Display'">Aa</strong><span>Playfair / editorial</span></button><button type="button" class="font-chip ${state.font === "dm" ? "selected" : ""}" data-font="dm"><strong style="font-family:'DM Sans'">Aa</strong><span>DM Sans / direta</span></button></div></section><section class="board-section"><h4>PALETA</h4><div class="palette-options">${ids.map((id) => paletteButton(id, palettes[id])).join("")}</div></section><section class="board-section"><h4>LOGO — CAMINHO CONCEITUAL</h4><div class="logo-options"><button type="button" class="logo-choice ${state.logo === "wordmark" ? "selected" : ""}" data-logo="wordmark">WORDMARK · ${escapeHTML(sample)}</button><button type="button" class="logo-choice ${state.logo === "symbol" ? "selected" : ""}" data-logo="symbol">▣ + ${escapeHTML(sample)}</button><button type="button" class="logo-choice ${state.logo === "mono" ? "selected" : ""}" data-logo="mono">MONOGRAMA · ${escapeHTML(letter)}</button></div></section><section class="board-section"><h4>DIREÇÃO DE IMAGEM</h4><p class="micro-note" id="photoNote">${escapeHTML(photo)}</p><button type="button" class="find-btn" id="morePhotos">mostrar outras parecidas ↻</button></section></div>`;
  el.querySelectorAll("[data-font]").forEach(
    (b) =>
      (b.onclick = () => {
        state.font = b.dataset.font;
        state.touchedFont = true;
        save();
        renderBoard(el);
      }),
  );
  el.querySelectorAll("[data-palette]").forEach(
    (b) =>
      (b.onclick = () => {
        state.palette = b.dataset.palette;
        state.touchedPalette = true;
        save();
        renderBoard(el);
      }),
  );
  el.querySelectorAll("[data-logo]").forEach(
    (b) =>
      (b.onclick = () => {
        state.logo = b.dataset.logo;
        state.touchedLogo = true;
        save();
        renderBoard(el);
      }),
  );
  el.querySelector("#morePhotos").onclick = () => {
    state.photoVariant = (Number(state.photoVariant) || 0) + 1;
    save();
    renderBoard(el);
  };
  document.querySelector("#footerNote").textContent = "Misture caminhos. Nada é definitivo.";
}
function renderSummary(el) {
  const current = score();
  const missing = current.items.filter((item) => !item.ok).map((item) => item.label);
  const traitTags = state.traits.slice(0, 6);
  el.innerHTML = `<div class="summary-card"><div class="summary-top"><div><span class="eyebrow" style="color:#8f8f95">BRAND BRAIN · CAMPOS RESPONDIDOS</span><h3>${escapeHTML(state.name || "Sua marca")}</h3></div><div class="brain-ring" style="background:conic-gradient(var(--lime) ${current.percent}%, #333 0)"><span>${current.percent}</span></div></div><p class="micro-note" id="summaryCount" style="color:#a8a8ae">${current.done} de ${current.total} campos respondidos. Não é uma nota de qualidade.</p><p class="micro-note" id="summaryMissing" style="color:#c8c8cc">${escapeHTML(missing.length ? "Ainda em aberto: " + missing.join(", ") + "." : "O que o assistente pergunta está respondido. Dá para seguir e editar depois.")}</p><div class="summary-tags">${traitTags.map((item) => `<span>${escapeHTML(item)}</span>`).join("")} ${state.avoid
    .slice(0, 3)
    .map((item) => `<span>não: ${escapeHTML(item)}</span>`)
    .join("")}</div><div class="axis-list">${[
    ["Institucional", "Experimental"],
    ["Minimalista", "Expressiva"],
    ["Humana", "Técnica"],
    ["Acessível", "Premium"],
    ["Clássica", "Contemporânea"],
  ]
    .map(
      (pair, index) =>
        `<label class="axis"><span>${pair[0]}</span><input type="range" min="0" max="100" value="${state.axes[index]}" data-axis="${index}"><span>${pair[1]}</span></label>`,
    )
    .join("")}</div><div class="final-cta"><button type="button" class="primary">✦ Criar minha identidade</button><button type="button">ajustar escolhas</button></div></div>`;
  el.querySelectorAll("[data-axis]").forEach(
    (range) =>
      (range.oninput = () => {
        state.axes[+range.dataset.axis] = +range.value;
        state.axesTouched = true;
        save();
        paintScore(el);
      }),
  );
  const buttons = el.querySelectorAll(".final-cta button");
  buttons[0].onclick = () => {
    if (window.SmeziGuide) SmeziGuide.createIdentity();
  };
  buttons[1].onclick = () => {
    step = 0;
    renderStep();
  };
  document.querySelector("#footerNote").textContent = "O anel conta campos respondidos.";
}
function bindInputs(el) {
  el.querySelectorAll("[data-key]").forEach((input) =>
    input.addEventListener("input", () => {
      state[input.dataset.key] = input.value;
      save();
    }),
  );
}
function bindListInputs(el) {
  el.querySelectorAll("[data-list]").forEach((input) =>
    input.addEventListener("input", () => {
      state[input.dataset.list][+input.dataset.index] = input.value;
      save();
    }),
  );
}
function bindTags(el) {
  el.querySelectorAll("[data-tag]").forEach(
    (button) =>
      (button.onclick = () => {
        const key = button.dataset.tag;
        const value = button.dataset.value;
        state[key] = state[key].includes(value) ? state[key].filter((item) => item !== value) : state[key].concat(value);
        save();
        renderPersonality(el);
      }),
  );
}
function currentPalette() {
  if (state.palette === "custom" && Array.isArray(state.customPalette) && state.customPalette.length >= 4) return state.customPalette;
  return palettes[state.palette] || palettes.digital;
}
function updatePreview() {
  const live = document.querySelector("#brandPreview");
  if (!live) return;
  const name = (state.name || "SUA MARCA").toUpperCase();
  document.querySelector("#previewName").textContent = name;
  document.querySelector("#previewSymbol").textContent = (state.name || "S").charAt(0).toUpperCase();
  document.querySelector("#previewMood").textContent = state.traits.slice(0, 3).join(" / ") || "personalidade em aberto";
  document.querySelector("#previewHeadline").textContent = state.name
    ? `${state.name}: uma identidade que já começa a parecer sua.`
    : "Uma identidade que começa a tomar forma.";
  const copy = document.querySelector("#previewCopy");
  if (copy) copy.textContent = state.description ? state.description.slice(0, 140) : "Cada escolha muda esta direção em tempo real.";
  const cta = document.querySelector("#previewCta");
  if (cta) cta.textContent = ((state.brain && state.brain.cta) || "descobrir mais") + " ↗";
  const palette = currentPalette();
  document.querySelectorAll("#paletteCard i").forEach((swatch, index) => (swatch.style.background = palette[index]));
  document.querySelector("#brandPreview").style.setProperty("--accent", palette[1]);
  const glow = document.querySelector(".preview-glow");
  glow.style.background = `radial-gradient(circle at 35% 35%,${palette[2]},transparent 52%),radial-gradient(circle at 65% 65%,${palette[1]},transparent 58%)`;
  const family = state.font === "playfair" ? "'Playfair Display'" : state.font === "dm" ? "'DM Sans'" : "Manrope";
  document.querySelector("#typeSample").style.fontFamily = family;
  document.querySelector("#previewHeadline").style.fontFamily = family;
  document.querySelector("#photoCard").style.background = state.styles.includes("premium")
    ? "linear-gradient(135deg,#17130f,#6b5a3b)"
    : state.styles.includes("organic")
      ? "linear-gradient(135deg,#a8bc83,#be765f)"
      : "linear-gradient(135deg,#7d8fa7,#1f2834)";
  const caption = document.querySelector("#photoCard span");
  if (caption) caption.textContent = SmeziBrain.photoNote(state).slice(0, 48);
  document.querySelector("#insightText").textContent = state.name
    ? `Já entendi ${state.name} como ${state.traits.slice(0, 3).join(", ") || "uma marca em construção"}. Continue: eu ajusto a direção a cada escolha.`
    : "Comece pelo nome. Eu vou conectando os pontos enquanto você escolhe.";
  live.classList.remove("pulse");
  void live.offsetWidth;
  live.classList.add("pulse");
}
function expandBoard() {
  const preview = document.querySelector("#brandPreview");
  if (!preview || document.querySelector(".board-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "board-overlay";
  overlay.innerHTML = `<div class="board-overlay-card" role="dialog" aria-modal="true" aria-label="Visual Board"><div class="board-overlay-bar"><span>Visual Board</span><button type="button" id="closeBoard">fechar</button></div><div class="board-overlay-stage"></div></div>`;
  const clone = preview.cloneNode(true);
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  overlay.querySelector(".board-overlay-stage").append(clone);
  document.body.append(overlay);
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
  };
  overlay.querySelector("#closeBoard").onclick = close;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
}

document.querySelector("#homeBtn").onclick = showHome;
if (window.SmeziKnowledge && SmeziKnowledge.ready && !SmeziKnowledge.loaded) {
  SmeziKnowledge.ready.then(() => showHome());
} else {
  showHome();
}
