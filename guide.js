/* Brand Guide — editable screen generated from the Brand Brain. */
(() => {
  "use strict";
  const esc = escapeHTML;
  let saveTimer = null;
  let replaceArmed = false;

  function sourceLine(brain) {
    if (!brain) return "";
    if (brain.source === "llm") return "Este texto foi salvo antes. Atualizar o entendimento reescreve a partir da base.";
    const niche = brain.nicheName ? " · " + brain.nicheName : "";
    return "Base da SMEZI" + niche + ". Dá para editar qualquer campo.";
  }

  function lines(value) {
    return Array.isArray(value) ? value.join("\n") : "";
  }

  function field(label, path, value, rows) {
    return `<label class="guide-field"><span>${label}</span><textarea data-path="${path}" rows="${rows || 3}">${esc(value || "")}</textarea></label>`;
  }

  function lineField(label, path, value) {
    return `<label class="guide-field"><span>${label}</span><textarea data-path="${path}" data-lines="1" rows="4">${esc(lines(value))}</textarea><small>Uma linha por item.</small></label>`;
  }

  function logoMark(brain) {
    const name = state.name || "Sua marca";
    const letter = name.trim().charAt(0).toUpperCase() || "S";
    const colors = SmeziBrain.colorsOf(state);
    const type = (brain.logo && brain.logo.type) || state.logo || "symbol";
    const ink = colors[0];
    const accent = colors[1];
    const paper = colors[3] && colors[3].toLowerCase() !== ink.toLowerCase() ? colors[3] : "#f7f5ef";
    if (type === "wordmark") {
      return `<div class="guide-logo guide-logo-word" style="background:${ink};color:${paper}"><strong>${esc(name)}</strong></div>`;
    }
    if (type === "mono") {
      return `<div class="guide-logo" style="background:${ink};color:${paper}"><b style="color:${accent}">${esc(letter)}</b><span>${esc(name)}</span></div>`;
    }
    return `<div class="guide-logo" style="background:${paper};color:${ink}"><b style="background:${ink};color:${paper}">${esc(letter)}</b><strong>${esc(name)}</strong></div>`;
  }

  function checklist() {
    const current = SmeziBrain.completeness(state);
    const site = String(state.site || "").trim();
    return `<section class="guide-card"><h2>O que está respondido</h2><ul class="guide-checks">${current.items
      .map((item) => `<li class="${item.ok ? "ok" : ""}">${item.ok ? "✓" : "○"} ${esc(item.label)}</li>`)
      .join("")}<li class="${site ? "ok" : ""}">${site ? "✓" : "○"} Site ${site ? "" : "(se existir)"}</li></ul><p class="guide-quiet">${current.done} de ${current.total} campos. O anel não é uma nota.</p></section>`;
  }

  function suggestBlocks(brain) {
    const palettes = Array.isArray(brain.paletteSuggestions) ? brain.paletteSuggestions : [];
    const seasons = Array.isArray(brain.seasonal) ? brain.seasonal : [];
    const avoid = Array.isArray(brain.avoid) ? brain.avoid : [];
    const type = brain.typeSuggestion;
    let html = "";
    if (palettes.length) {
      html += `<section class="guide-card guide-wide"><h2>Paletas da base</h2><p class="guide-quiet">Sugestão para este ofício. A paleta da marca só muda se você aplicar.</p><div class="guide-suggest">${palettes
        .map((palette, index) => {
          const chips = (palette.colors || []).map((color) => `<i style="background:${esc(color.hex)}" title="${esc(color.role || color.hex)}"></i>`).join("");
          return `<article><strong>${esc(palette.name || "Paleta")}</strong><span class="guide-chips">${chips}</span><button type="button" class="text-btn" data-apply-palette="${index}">usar esta paleta</button></article>`;
        })
        .join("")}</div></section>`;
    }
    if (type && type.font) {
      html += `<section class="guide-card"><h2>Par sugerido</h2><p class="guide-type">${esc(type.display || type.font)}</p><p class="guide-quiet">Texto em ${esc(type.text || "Manrope")}. ${esc(type.why || "")}</p><button type="button" class="text-btn" id="guideFont">usar esta fonte</button></section>`;
    }
    if (seasons.length) {
      html += `<section class="guide-card"><h2>Datas deste ofício</h2><ul class="guide-season">${seasons
        .map((item) => `<li><strong>${esc(item.name)}</strong> · ${esc(item.when || "")}<span>${esc(item.line || "")}</span></li>`)
        .join("")}</ul></section>`;
    }
    if (avoid.length) {
      html += `<section class="guide-card"><h2>O que evitar</h2><ul class="guide-checks">${avoid.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>`;
    }
    return html;
  }

  function applySuggestedPalette(index) {
    const suggestion = state.brain && state.brain.paletteSuggestions && state.brain.paletteSuggestions[index];
    if (!suggestion || !Array.isArray(suggestion.colors) || suggestion.colors.length < 4) return;
    const colors = suggestion.colors.slice(0, 4).map((color) => String(color.hex || "").toLowerCase());
    if (!colors.every((hex) => /^#[0-9a-f]{6}$/.test(hex))) return;
    state.palette = "custom";
    state.customPalette = colors;
    palettes.custom = colors;
    state.touchedPalette = true;
    state.brain.palette = suggestion.colors.slice(0, 4).map((color, colorIndex) => ({
      hex: colors[colorIndex],
      role: color.role || (state.brain.palette[colorIndex] && state.brain.palette[colorIndex].role) || "Cor",
      usage: color.usage || (state.brain.palette[colorIndex] && state.brain.palette[colorIndex].usage) || "",
    }));
    state.brain.editedAt = new Date().toISOString();
    save();
    paint();
  }

  function applySuggestedFont() {
    const type = state.brain && state.brain.typeSuggestion;
    const allowed = ["manrope", "playfair", "dm", "sora"];
    if (!type || !allowed.includes(type.font)) return;
    state.font = type.font;
    state.touchedFont = true;
    const pair = type.font === "playfair" ? { display: "Playfair Display", text: "Manrope" } : { display: SmeziBrain.FONT_LABEL[type.font], text: SmeziBrain.FONT_LABEL[type.font] };
    if (!state.brain.typography) state.brain.typography = { hierarchy: [] };
    state.brain.typography.display = pair.display;
    state.brain.typography.text = pair.text;
    state.brain.editedAt = new Date().toISOString();
    save();
    paint();
  }

  function paintLoading() {
    app.innerHTML = `<section class="guide-shell"><div class="cs-top"><button type="button" class="back-btn" id="guideHome">← início</button><span class="eyebrow">Brand Guide</span></div><header class="guide-hero"><div><span class="eyebrow">Brand Brain</span><h1>Organizando o que você contou.</h1><p class="guide-lead">Posicionamento, voz, cores e regras de composição. Leva só um instante.</p></div></header><p class="guide-status" role="status">Lendo nome, negócio, referências, personalidade e direção visual…</p></section>`;
    document.getElementById("guideHome").onclick = showHome;
  }

  function paint() {
    const brain = state.brain || SmeziBrain.buildFallbackBrain(state);
    const current = SmeziBrain.completeness(state);
    const stale = brain.inputStamp && brain.inputStamp !== SmeziBrain.stamp(state);
    const palette = brain.palette || [];
    app.innerHTML = `<section class="guide-shell"><div class="cs-top"><button type="button" class="back-btn" id="guideHome">← início</button><span class="eyebrow">Brand Guide</span><span class="cs-save-note" id="guideSave">${brain.editedAt ? "edição salva neste navegador" : "salvo neste navegador"}</span></div><header class="guide-hero"><div><span class="eyebrow">Entendimento da marca</span><input class="guide-name" data-state="name" value="${esc(state.name || "")}" aria-label="Nome da marca"><p class="guide-kicker">${esc((brain.logo && brain.logo.label) || "")}</p></div><div class="guide-meter"><div class="brain-ring lg" style="background:conic-gradient(var(--lime) ${current.percent}%, #ddd 0)"><span>${current.percent}</span></div><p>${current.done} de ${current.total} campos respondidos.</p></div></header><p class="guide-status" id="guideSource" role="status">${esc(sourceLine(brain))}${stale ? " As respostas mudaram desde este texto." : ""}</p><div class="guide-actions"><button type="button" class="next-btn" id="guideContent">criar conteúdo</button><button type="button" class="ghost-btn" id="guideRegen">${replaceArmed ? "substituir minhas edições" : "atualizar entendimento"}</button><button type="button" class="ghost-btn" id="guideMore">mostrar outras</button><button type="button" class="ghost-btn" id="guideWizard">ajustar no assistente</button></div><div class="guide-grid"><section class="guide-card guide-wide">${logoMark(brain)}<h2>Logo e inicial</h2>${field("Como usar", "logo.usage", brain.logo && brain.logo.usage, 3)}${lineField("Não fazer", "logo.dont", brain.logo && brain.logo.dont)}</section><section class="guide-card guide-wide"><h2>Paleta e o papel de cada cor</h2><div class="guide-palette">${palette
      .map(
        (color, index) =>
          `<article class="guide-swatch"><input type="color" data-color-index="${index}" value="${esc(color.hex)}" aria-label="Cor ${index + 1}"><code>${esc(color.hex)}</code><label class="guide-field"><span>Papel</span><input data-path="palette.${index}.role" value="${esc(color.role || "")}"></label><label class="guide-field"><span>Onde entra</span><textarea data-path="palette.${index}.usage" rows="3">${esc(color.usage || "")}</textarea></label></article>`,
      )
      .join("")}</div></section><section class="guide-card"><h2>Tipografia</h2><p class="guide-type" style="font-family:${esc(brain.typography.display)}, serif">${esc(brain.typography.display)}</p><p class="guide-quiet">Texto em ${esc(brain.typography.text)}.</p>${lineField("Hierarquia", "typography.hierarchy", brain.typography && brain.typography.hierarchy)}</section><section class="guide-card"><h2>Voz</h2>${field("Como fala", "tone.summary", brain.tone && brain.tone.summary, 3)}<div class="guide-split">${lineField("Fala assim", "tone.do", brain.tone && brain.tone.do)}${lineField("Não fala assim", "tone.dont", brain.tone && brain.tone.dont)}</div><label class="guide-field"><span>Chamada discreta</span><input data-path="cta" maxlength="42" value="${esc(brain.cta || "")}"></label></section><section class="guide-card"><h2>Posicionamento e público</h2>${field("Posicionamento", "positioning", brain.positioning, 4)}${field("Público", "audience", brain.audience, 3)}${lineField("Mensagens-chave", "keyMessages", brain.keyMessages)}</section><section class="guide-card"><h2>Fotografia</h2>${field("Direção", "photography.direction", brain.photography && brain.photography.direction, 4)}<div class="guide-split">${lineField("Buscar", "photography.do", brain.photography && brain.photography.do)}${lineField("Evitar", "photography.dont", brain.photography && brain.photography.dont)}</div></section><section class="guide-card"><h2>Composição</h2><div class="guide-split">${lineField("Fazer", "composition.do", brain.composition && brain.composition.do)}${lineField("Não fazer", "composition.dont", brain.composition && brain.composition.dont)}</div></section>${suggestBlocks(brain)}${checklist()}<section class="guide-card guide-wide"><h2>De onde veio este texto</h2><p class="guide-reading">${esc(brain.reading || "")}</p></section></div></section>`;
    bind();
  }

  function setPath(path, value) {
    const parts = path.split(".");
    let cursor = state.brain;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const next = cursor[key];
      if (Array.isArray(next)) cursor = next;
      else if (next && typeof next === "object") cursor = next;
      else return;
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function writeControl(control) {
    if (!state.brain) return;
    if (control.dataset.state) {
      state[control.dataset.state] = control.value.slice(0, 100);
      const mark = document.querySelector(".guide-logo strong, .guide-logo span");
      if (mark && control.dataset.state === "name") mark.textContent = state.name || "Sua marca";
      return;
    }
    if (control.dataset.colorIndex !== undefined) {
      const index = +control.dataset.colorIndex;
      const hex = control.value.toLowerCase();
      if (!state.brain.palette[index]) return;
      state.brain.palette[index].hex = hex;
      const colors = state.brain.palette.map((color) => color.hex);
      state.palette = "custom";
      state.customPalette = colors;
      palettes.custom = colors;
      state.touchedPalette = true;
      const code = control.parentElement && control.parentElement.querySelector("code");
      if (code) code.textContent = hex;
      return;
    }
    const path = control.dataset.path;
    if (!path) return;
    const value = control.dataset.lines ? control.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6) : control.value.trim();
    setPath(path, value);
  }

  function scheduleSave() {
    state.brain.editedAt = new Date().toISOString();
    const note = document.getElementById("guideSave");
    if (note) note.textContent = "salvando…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      save();
      const current = document.getElementById("guideSave");
      if (current) current.textContent = "edição salva neste navegador";
    }, 280);
  }

  function bind() {
    document.getElementById("guideHome").onclick = showHome;
    document.getElementById("guideContent").onclick = () => {
      if (window.SmeziStudio) SmeziStudio.openContent(0);
    };
    document.getElementById("guideWizard").onclick = () => {
      step = 0;
      showStudio();
    };
    document.getElementById("guideRegen").onclick = () => {
      if (state.brain && state.brain.editedAt && !replaceArmed) {
        replaceArmed = true;
        paint();
        return;
      }
      replaceArmed = false;
      generate();
    };
    document.getElementById("guideMore").onclick = () => {
      if (state.brain && state.brain.editedAt && !replaceArmed) {
        replaceArmed = true;
        paint();
        return;
      }
      replaceArmed = false;
      state.knowledgeVariant = (Number(state.knowledgeVariant) || 0) + 1;
      generate();
    };
    document.querySelectorAll("[data-apply-palette]").forEach((button) => {
      button.onclick = () => applySuggestedPalette(+button.dataset.applyPalette);
    });
    const fontButton = document.getElementById("guideFont");
    if (fontButton) fontButton.onclick = applySuggestedFont;
    document.querySelectorAll("[data-path],[data-state],[data-color-index]").forEach((control) => {
      control.addEventListener("input", () => {
        writeControl(control);
        scheduleSave();
      });
    });
  }

  function generate() {
    const brain = SmeziBrain.buildFallbackBrain(state);
    brain.inputStamp = SmeziBrain.stamp(state);
    brain.editedAt = null;
    state.brain = brain;
    save();
    paint();
  }

  function open(options) {
    replaceArmed = false;
    if (options && options.generate) generate();
    else if (!state.brain) generate();
    else paint();
  }

  function createIdentity() {
    if (!String(state.name || "").trim()) {
      step = 0;
      showStudio();
      const note = document.querySelector("#footerNote");
      if (note) note.textContent = "Preciso de um nome para guardar a marca.";
      return;
    }
    state.confirmedVisual = true;
    save();
    open({ generate: true });
  }

  window.SmeziGuide = { open, createIdentity };
})();
