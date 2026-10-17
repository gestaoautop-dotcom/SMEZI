/* Extends the published v1. The original six-step brand wizard remains intact. */
(() => {
  "use strict";
  const DBKEY = "smezi-content-studio-v2",
    esc = escapeHTML;
  function readDB() {
    try {
      const o = JSON.parse(localStorage.getItem(DBKEY) || "{}");
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  const db = { brands: [], projects: [], ...readDB() };
  if (!Array.isArray(db.brands)) db.brands = [];
  if (!Array.isArray(db.projects)) db.projects = [];
  let activeId = db.activeId || null,
    project = null,
    view = 0,
    editing = 0,
    saveError = "",
    undo = [],
    redo = [],
    requestedFormat = "post",
    flowKind = "content",
    flowLabel = "Conteúdo",
    libraryMode = false,
    swapIndex = null,
    copyToken = 0,
    picking = false;
  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fonts = {
    manrope: "Manrope",
    playfair: "Playfair Display",
    dm: "DM Sans",
    sora: "Sora",
    arial: "Arial",
  };
  const formats = {
    post: { name: "Post vertical", w: 1080, h: 1350 },
    square: { name: "Post quadrado", w: 1080, h: 1080 },
    story: { name: "Story", w: 1080, h: 1920 },
    deck: { name: "Apresentação", w: 1920, h: 1080 },
  };
  const models = [
    ["hero", "Manifesto tipográfico"],
    ["split", "Texto + imagem"],
    ["number", "Número protagonista"],
    ["checklist", "Checklist"],
    ["quote", "Frase editorial"],
    ["photo", "Imagem com faixa"],
    ["compare", "Duas perspectivas"],
    ["process", "Passo a passo"],
    ["faq", "Pergunta e resposta"],
    ["cards", "Três pontos essenciais"],
    ["announce", "Comunicado"],
    ["close", "Próximo passo"],
  ];
  function notice(s) {
    const e = document.getElementById("cs-status");
    if (e) e.textContent = s;
  }
  function persist() {
    db.activeId = activeId;
    try {
      localStorage.setItem(DBKEY, JSON.stringify(db));
      saveError = "";
      const x = document.querySelector(".autosave");
      if (x) x.innerHTML = "<i></i> salvo neste navegador";
      return true;
    } catch {
      saveError =
        "Não foi possível salvar no navegador. Exporte o projeto antes de sair; reduza o tamanho das imagens para continuar.";
      notice(saveError);
      const x = document.querySelector(".autosave");
      if (x) x.textContent = "alterações sem salvar";
      return false;
    }
  }
  function snapshotBrand() {
    if (!String(state.name || "").trim()) return null;
    let b = db.brands.find((x) => x.id === activeId);
    if (!b) {
      activeId = uid();
      b = { id: activeId };
      db.brands.push(b);
    }
    b.data = clone(state);
    if (state.brain) b.brain = clone(state.brain);
    b.updatedAt = new Date().toISOString();
    return b;
  }
  if (!activeId && state.name) {
    snapshotBrand();
    persist();
  }
  const originalSave = save;
  save = function () {
    try {
      originalSave();
    } catch {
      saveError = "Salvamento local indisponível.";
    }
    snapshotBrand();
    persist();
  };
  const originalHome = showHome;
  showHome = function () {
    originalHome();
    wireHome();
  };
  const originalSummary = renderSummary;
  renderSummary = function (el) {
    originalSummary(el);
    const buttons = el.querySelectorAll(".final-cta button");
    buttons[0].textContent = "✦ Criar minha identidade";
    buttons[0].onclick = () => {
      if (window.SmeziGuide) SmeziGuide.createIdentity();
      else openContent(0);
    };
    buttons[1].onclick = () => {
      step = 0;
      renderStep();
    };
  };
  const originalStudio = showStudio;
  showStudio = function () {
    originalStudio();
    const b = document.querySelector("#nextBtn");
    b.onclick = () => {
      if (step < 5) {
        if (step === 4) state.confirmedVisual = true;
        step++;
        renderStep();
      } else if (window.SmeziGuide) SmeziGuide.createIdentity();
      else openContent(0);
    };
  };
  function setBrand(b) {
    activeId = b.id;
    const stored = clone(b.data || {});
    if (!stored.brain && b.brain) stored.brain = clone(b.brain);
    state = normalizeState(stored);
    if (Array.isArray(state.customPalette))
      palettes.custom = state.customPalette;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
    } catch {}
    persist();
  }
  function newBrand() {
    snapshotBrand();
    activeId = null;
    state = clone(initial);
    step = 0;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
    } catch {}
    showStudio();
  }
  function wireHome() {
    const cards = app.querySelectorAll(".studio-card");
    if (cards[1]) cards[1].onclick = () => openContent(0);
    if (cards[2]) cards[2].onclick = () => openContent(0, "Campanha");
    if (cards[4]) cards[4].onclick = () => openContent(0, "Apresentação");
    if (cards[3])
      cards[3].onclick = () => {
        showComingSoon();
      };
    app
      .querySelectorAll('[data-action="brand"]')
      .forEach((b) => (b.onclick = newBrand));
    const row = app.querySelector(".brand-row");
    if (row) {
      row.innerHTML = db.brands.length
        ? db.brands
            .map((b) => {
              const pct = SmeziBrain.completeness(b.data || {}).percent;
              const letter = esc((b.data.name || "M").slice(0, 1));
              return `<button class="brand-chip" data-saved-brand="${esc(b.id)}"><div class="chip-logo smezi-chip">${letter}</div><div><strong>${esc(b.data.name)}</strong><span>Brand Brain ${pct}% — campos respondidos</span></div><div class="brain-ring" style="background:conic-gradient(var(--lime) ${pct}%, #ddd 0)"><span>${pct}</span></div></button>`;
            })
            .join("")
        : '<div class="cs-empty">Suas marcas aparecerão aqui depois do primeiro cadastro.</div>';
      row.insertAdjacentHTML(
        "beforeend",
        '<button class="brand-chip add" data-new-brand><span>＋</span><div><strong>Criar nova marca</strong><small>Reutilize o assistente de seis etapas.</small></div></button>',
      );
      row.querySelectorAll("[data-saved-brand]").forEach(
        (b) =>
          (b.onclick = () => {
            setBrand(db.brands.find((x) => x.id === b.dataset.savedBrand));
            if (window.SmeziGuide) SmeziGuide.open();
            else openContent(0);
          }),
      );
      row.querySelector("[data-new-brand]").onclick = newBrand;
    }
    if (db.projects.length) {
      const panel = document.createElement("section");
      panel.className = "brands-panel";
      panel.innerHTML =
        '<div class="section-head"><h2>Continuar um projeto</h2></div><div class="cs-projects">' +
        db.projects
          .map(
            (q) =>
              `<button class="brand-chip" data-project="${esc(q.id)}"><div><strong>${esc(q.brief.theme || q.name)}</strong><span>${esc(q.name)} · ${q.posts.length} peças · ${esc(q.kind === "campaign" ? "Campanha" : q.kind === "deck" ? "Apresentação" : formats[q.format]?.name || "Post")}</span></div></button>`,
          )
          .join("") +
        "</div>";
      app.querySelector(".home-shell").append(panel);
      panel.querySelectorAll("[data-project]").forEach(
        (b) =>
          (b.onclick = () => {
            project = db.projects.find((q) => q.id === b.dataset.project);
            const brand = db.brands.find((q) => q.id === project.brandId);
            if (brand) setBrand(brand);
            flowKind = project.kind === "campaign" || project.kind === "deck" ? project.kind : "content";
            flowLabel = flowKind === "campaign" ? "Campanha" : flowKind === "deck" ? "Apresentação" : "Conteúdo";
            libraryMode = false;
            swapIndex = null;
            view = project.posts && project.posts.length ? (flowKind === "content" ? 3 : 2) : 1;
            renderContent();
          }),
      );
    }
    const top = document.querySelector(".ghost-btn");
    if (top)
      top.onclick = () => {
        showHome();
        app
          .querySelector(".brands-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    const status = document.querySelector(".autosave");
    if (status) status.innerHTML = "<i></i> salvo neste navegador";
  }
  function showComingSoon() {
    app.innerHTML =
      '<section class="cs-shell"><button class="back-btn" id="cs-backhome">← início</button><h1>Seu site continua no planejamento.</h1><p>Esta atualização conecta marcas, conteúdo, campanhas e apresentações. A criação de sites será uma integração própria.</p></section>';
    document.getElementById("cs-backhome").onclick = showHome;
  }
  function openContent(n = 0, category = "Conteúdo") {
    view = n;
    project = null;
    undo = [];
    redo = [];
    libraryMode = false;
    swapIndex = null;
    flowKind = category === "Campanha" ? "campaign" : category === "Apresentação" ? "deck" : "content";
    flowLabel = category === "Campanha" || category === "Apresentação" ? category : "Conteúdo";
    requestedFormat = flowKind === "deck" ? "deck" : "post";
    renderContent();
  }
  function button(label, action, primary = false) {
    return `<button type="button" class="${primary ? "next-btn" : "ghost-btn"}" data-cs="${action}">${label}</button>`;
  }
  function field(label, id, value = "", type = "text") {
    return `<label class="cs-field">${label}<input id="${id}" type="${type}" value="${esc(value)}"></label>`;
  }
  function fingerprint() {
    return JSON.stringify([
      project?.brandId,
      project?.format,
      project?.palette,
      project?.font,
      project?.brief,
    ]);
  }
  function saveProject() {
    if (!project) return;
    project.updatedAt = new Date().toISOString();
    const at = db.projects.findIndex((q) => q.id === project.id);
    if (at < 0) db.projects.push(project);
    else db.projects[at] = project;
    persist();
  }
  function ensureProject() {
    if (project) return;
    const colors = SmeziBrain.colorsOf(state).slice(0, 4);
    const brain = state.brain;
    project = {
      id: uid(),
      brandId: activeId,
      name: state.name,
      format: requestedFormat,
      font: state.font || "manrope",
      palette: clone(colors),
      brief: {
        theme: "",
        audience: brain && brain.audience ? String(brain.audience).slice(0, 220) : "",
        goal: "Explicar",
        message: "",
        tone: (brain && brain.tone && brain.tone.summary) || (state.traits || []).join(", "),
        feedback: "",
      },
      approved: null,
      styleApproved: false,
      kind: flowKind,
      posts: [],
      createdAt: new Date().toISOString(),
    };
    saveProject();
  }
  function flowSteps() {
    if (flowKind === "campaign") return ["Sua marca", "Pauta", "Peças", "Editor"];
    if (flowKind === "deck") return ["Sua marca", "Pauta", "Slides", "Editor"];
    const steps = ["Sua marca", "Formato", "Pauta", "Biblioteca", "Editor"];
    if (project && Array.isArray(project.posts) && project.posts.length && project.posts.every((item) => !item.layout) && !libraryMode) steps[3] = "Amostras";
    return steps;
  }
  function editorView() {
    return flowKind === "content" ? 4 : 3;
  }
  function boardView() {
    return flowKind === "content" ? 3 : 2;
  }
  function briefView() {
    return flowKind === "content" ? 2 : 1;
  }
  function brandContext() {
    return {
      name: state.name,
      segment: state.segment,
      description: state.description,
      traits: state.traits || [],
      styles: state.styles || [],
      avoid: state.avoid || [],
      brain: state.brain,
      brief: (project && project.brief) || {},
      knowledgeVariant: Number(state.knowledgeVariant) || 0,
    };
  }
  function pieceLabel(q) {
    if (q.layout && window.SmeziTemplates) {
      const template = SmeziTemplates.get(q.template);
      return [template ? template.name : q.layout, q.purpose, formats[q.format || project.format]?.name].filter(Boolean).join(" · ");
    }
    return models.find((item) => item[0] === q.model)?.[1] || q.model || "Peça";
  }
  function copyNote() {
    return "Texto da base da SMEZI, na voz desta marca. Revise antes de exportar.";
  }
  function openEditor(index) {
    editing = index;
    undo = [];
    redo = [];
    libraryMode = false;
    view = editorView();
    renderContent();
  }
  function chooseTemplate(templateId, format) {
    if (picking || !window.SmeziTemplates) return;
    picking = true;
    ensureProject();
    const current = swapIndex != null ? project.posts[swapIndex] : null;
    const ctx = brandContext();
    if (current && current.variant) ctx.variant = current.variant;
    let post = SmeziTemplates.previewPost(templateId, ctx, format);
    post.id = current ? current.id : uid();
    post.image = current ? current.image : null;
    post.variant = current ? current.variant || 0 : 0;
    if (current) project.posts[swapIndex] = post;
    else project.posts.push(post);
    editing = current ? swapIndex : project.posts.length - 1;
    swapIndex = null;
    libraryMode = false;
    picking = false;
    project.kind = flowKind;
    view = editorView();
    saveProject();
    renderContent();
    notice(copyNote());
  }
  function startSet(plan) {
    if (!window.SmeziTemplates) {
      notice("A biblioteca não carregou. Recarregue a página.");
      return;
    }
    const ctx = brandContext();
    project.posts = plan.map((spec, index) => {
      const post = SmeziTemplates.previewPost(spec.template, Object.assign({}, ctx, { variant: index }), spec.format, { kicker: spec.kicker });
      post.id = uid();
      post.variant = index;
      return post;
    });
    project.kind = flowKind;
    project.approved = fingerprint();
    project.styleApproved = false;
    libraryMode = false;
    view = boardView();
    saveProject();
    renderContent();
    notice(copyNote());
  }
  function renderContent() {
    const steps = flowSteps();
    app.innerHTML = `<section class="cs-shell"><div class="cs-top"><button type="button" class="back-btn" data-cs="home">← início</button><span class="eyebrow">Brand Studio / ${esc(flowLabel)}</span><span class="cs-save-note">Salvamento local</span></div><nav class="cs-progress" aria-label="Etapas de criação">${steps.map((s, i) => `<button type="button" data-view="${i}" ${i > view ? "disabled" : ""} ${i === view ? 'aria-current="step"' : ""}><b>${i + 1}</b>${s}</button>`).join("")}</nav><div id="cs-body"></div><p id="cs-status" role="status" aria-live="polite">${esc(saveError)}</p><p class="cs-footnote">Projetos salvos neste navegador. Os textos partem do Brand Brain e continuam editáveis. As fotos são suas.</p></section>`;
    const body = document.getElementById("cs-body");
    if (view === 0) {
      body.innerHTML = `<header class="cs-heading"><span class="eyebrow">O que já sabemos sobre sua marca</span><h1>Uma base para todas as criações.</h1><p>Use uma marca salva ou confirme suas diretrizes antes de continuar.</p></header>${db.brands.length ? `<label class="cs-field">Selecionar marca<select id="cs-brands">${db.brands.map((b) => `<option value="${esc(b.id)}" ${activeId === b.id ? "selected" : ""}>${esc(b.data.name)}</option>`).join("")}</select></label>` : ""}<div class="cs-columns"><div class="cs-box"><h2>${esc(state.name || "Comece pela sua marca")}</h2><p>${esc((state.brain && state.brain.positioning) || state.description || "Cadastre o nome e conte o que sua marca oferece.")}</p><div class="cs-swatches">${SmeziBrain.colorsOf(state).map((c, i) => `<span style="background:${c}" aria-label="${esc((state.brain && state.brain.palette && state.brain.palette[i] && state.brain.palette[i].role) || c)}"></span>`).join("")}</div><p>Fonte: ${esc(fonts[state.font] || "Manrope")}<br>Voz: ${esc((state.brain && state.brain.tone && state.brain.tone.summary) || (state.traits || []).join(", ") || "a definir")}${state.brain && state.brain.keyMessages ? `<br>Mensagens: ${esc(state.brain.keyMessages.join(" · "))}` : ""}</p><p>${SmeziBrain.colorsOf(state).map((c, i) => esc(((state.brain && state.brain.palette && state.brain.palette[i] && state.brain.palette[i].role) || "Cor " + (i + 1)) + " " + c)).join(" · ")}</p><div class="cs-actions">${button("Ver o guia da marca", "guide")}${button("Editar no assistente", "brandwizard")}${button("Criar outra marca", "newbrand")}</div></div><div class="cs-box"><h2>Já tem uma identidade?</h2><p>Confirme nome, fonte e a cor de destaque. As outras cores da paleta permanecem.</p>${field("Nome da marca", "cs-name", state.name)}${field("O que faz e para quem", "cs-description", state.description)}<div class="cs-field-pair"><label class="cs-field">Cor de destaque<input type="color" id="cs-brandcolor" value="${validColor(SmeziBrain.colorsOf(state)[1]).toLowerCase()}"></label><label class="cs-field">Fonte<select id="cs-brandfont">${Object.entries(
        fonts,
      )
        .map(
          ([k, n]) =>
            `<option value="${k}" ${state.font === k ? "selected" : ""}>${n}</option>`,
        )
        .join(
          "",
        )}</select></label></div><label class="cs-check"><input type="checkbox" id="cs-confirmcolor"> Confirmo esta cor e estas diretrizes para criar.</label>${button(flowKind === "content" ? "Confirmar e escolher formato" : "Confirmar e escrever a pauta", "confirmbrand", true)}</div></div>`;
      const select = document.getElementById("cs-brands");
      if (select)
        select.onchange = () => {
          setBrand(db.brands.find((b) => b.id === select.value));
          project = null;
          renderContent();
        };
    }
    if (view === 1 && flowKind === "content") {
      ensureProject();
      body.innerHTML = `<header class="cs-heading"><span class="eyebrow">${esc(project.name)}</span><h1>O que vamos criar?</h1><p>Escolha a proporção. O conteúdo e o layout serão ajustados para ela.</p></header><div class="cs-formats">${Object.entries(
        formats,
      )
        .map(
          ([k, f]) =>
            `<button type="button" class="cs-format ${project.format === k ? "selected" : ""}" data-format="${k}" aria-pressed="${project.format === k}"><span class="cs-ratio" style="aspect-ratio:${f.w}/${f.h}"></span><strong>${f.name}</strong><small>${f.w} × ${f.h} px</small></button>`,
        )
        .join(
          "",
        )}</div><div class="cs-actions">${button("Continuar para conteúdo", "brief", true)}${project.posts.length ? button("Ver peças neste formato", "samples") : ""}</div>`;
      body.querySelectorAll("[data-format]").forEach(
        (b) =>
          (b.onclick = () => {
            project.format = b.dataset.format;
            project.approved = null;
            project.styleApproved = false;
            saveProject();
            renderContent();
          }),
      );
    }
    if (view === briefView()) {
      ensureProject();
      const b = project.brief;
      const briefTitle = flowKind === "campaign" ? "Qual é a ideia da campanha?" : flowKind === "deck" ? "Qual é o assunto da apresentação?" : "O que precisa ser comunicado?";
      const briefLead = flowKind === "campaign" ? "Uma pauta só. As peças saem em post, quadrado e story, cada uma com um modelo." : flowKind === "deck" ? "Uma pauta só. Os slides seguem capa, seção, conteúdo, dados e fecho." : "A pauta vale para os modelos que você escolher na biblioteca.";
      const outline = flowKind === "deck" ? "<li>Abrir com o assunto.</li><li>Desenvolver uma ideia.</li><li>Listar o que a marca sustenta, sem número inventado.</li><li>Fechar com um convite discreto.</li>" : flowKind === "campaign" ? "<li>Anunciar o assunto.</li><li>Explicar em pontos curtos.</li><li>Mostrar o bastidor, com a sua foto.</li><li>Convidar sem pressa.</li>" : "<li>Escolher um modelo na biblioteca.</li><li>Ajustar a frase no editor.</li><li>Colocar a sua fotografia, se o modelo tiver espaço.</li>";
      const approveLabel = flowKind === "campaign" ? "Aprovar e montar a campanha" : flowKind === "deck" ? "Aprovar e montar a apresentação" : "Aprovar e abrir a biblioteca";
      body.innerHTML = `<header class="cs-heading"><span class="eyebrow">Direção antes da produção</span><h1>${briefTitle}</h1><p>${briefLead}</p></header><div class="cs-columns"><div class="cs-box">${field("Tema ou assunto principal", "cs-theme", b.theme)}${field("Para quem estamos falando?", "cs-audience", b.audience)}<label class="cs-field">Objetivo<select id="cs-goal">${["Explicar", "Apresentar serviços", "Apresentar produto", "Convidar"].map((g) => `<option ${b.goal === g ? "selected" : ""}>${g}</option>`).join("")}</select></label><label class="cs-field">Mensagem principal<textarea id="cs-message">${esc(b.message)}</textarea></label>${field("Tom de voz", "cs-tone", b.tone)}</div><div class="cs-box"><h2>Escopo</h2><ol class="cs-outline">${outline}</ol><p>Sem estatísticas, depoimentos de cliente, resultados ou promessas inventadas. Textos são pontos de partida para revisão.</p><label class="cs-field">Feedback e observações<textarea id="cs-feedback">${esc(b.feedback || "")}</textarea></label><p class="cs-hint">Registre o feedback e ajuste os campos ao lado antes de aprovar.</p><div class="cs-actions">${button("Salvar rascunho", "savebrief")}${button(approveLabel, "approvebrief", true)}</div></div></div>`;
    }
    if (view === boardView()) renderBoard(body);
    if (view === editorView()) renderEditor(body);
    wireActions();
    if (saveError) notice(saveError);
  }
  function renderBoard(body) {
    ensureProject();
    const legacyOnly = flowKind === "content" && project.posts.length > 0 && project.posts.every((item) => !item.layout) && !libraryMode;
    if (flowKind !== "content" && !libraryMode) {
      body.innerHTML = `<header class="cs-heading"><span class="eyebrow">${esc(project.name)}</span><h1>${flowKind === "deck" ? "Cinco slides, uma narrativa." : "Uma campanha, formatos diferentes."}</h1><p>${flowKind === "deck" ? "Capa, seção, conteúdo, dados e fecho. A contagem é só das mensagens da marca." : "Cada peça usa um modelo diferente. O texto vem do Brand Brain e da pauta."}</p></header><div class="cs-samples">${project.posts.map((q, i) => `<button type="button" class="cs-sample" data-post="${i}" aria-label="Editar ${esc(pieceLabel(q))}">${renderSVG(q)}<span>${esc(pieceLabel(q))}</span></button>`).join("")}</div><div class="cs-actions">${button("Revisar pauta", "backbrief")}${button(project.styleApproved ? "Direção aprovada ✓" : "Aprovar direção visual", "approvestyle", true)}${button("Baixar projeto editável", "projectjson")}</div><p class="cs-hint">A aprovação visual não publica nada. Confira cada texto antes de exportar.</p>`;
      body.querySelectorAll("[data-post]").forEach((item) => (item.onclick = () => openEditor(+item.dataset.post)));
      return;
    }
    if (legacyOnly) {
      body.innerHTML = `<header class="cs-heading"><span class="eyebrow">${esc(project.name)}</span><h1>Peças já salvas.</h1><p>Estas composições continuam editáveis. Dá para escolher um modelo novo sem apagar o que já está aqui.</p></header><div class="cs-samples">${project.posts.map((q, i) => `<button type="button" class="cs-sample" data-post="${i}" aria-label="Editar peça ${i + 1}: ${esc(q.title)}">${renderSVG(q)}<span>${i + 1}. ${esc(pieceLabel(q))}</span></button>`).join("")}</div><div class="cs-actions">${button("Revisar pauta", "backbrief")}${button("Escolher um modelo novo", "openlibrary")}${button(project.styleApproved ? "Direção aprovada ✓" : "Aprovar direção visual", "approvestyle", true)}${button("Baixar projeto editável", "projectjson")}</div>`;
      body.querySelectorAll("[data-post]").forEach((item) => (item.onclick = () => openEditor(+item.dataset.post)));
      return;
    }
    body.innerHTML = `<header class="cs-heading"><span class="eyebrow">${esc(project.name)}</span><h1>Biblioteca de modelos.</h1><p>A régua é da SMEZI: grade limpa, espaço e uma frase. As cores, a fonte e a voz são desta marca.</p></header><div id="lib-root"></div><div class="cs-actions">${button("Revisar pauta", "backbrief")}</div>`;
    if (window.SmeziLibrary) {
      const current = swapIndex != null ? project.posts[swapIndex] : null;
      SmeziLibrary.mount(document.getElementById("lib-root"), {
        state,
        project,
        format: (current && current.format) || project.format,
        onPick: (templateId, format) => chooseTemplate(templateId, format),
        onOpen: (index) => openEditor(index),
      });
    } else notice("A biblioteca não carregou. Recarregue a página.");
  }
  function renderEditor(body) {
    const q = project && project.posts[editing];
    if (!q) {
      view = boardView();
      renderBoard(body);
      return;
    }
    const backLabel = q.layout ? (flowKind === "deck" ? "Voltar aos slides" : flowKind === "campaign" ? "Voltar às peças" : "Voltar à biblioteca") : "Voltar às amostras";
    const options = q.layout && window.SmeziTemplates
      ? SmeziTemplates.forFormat(q.format || project.format).map((item) => `<option value="${item.id}" ${item.id === q.template ? "selected" : ""}>${item.name} · ${item.purposes[0]}</option>`).join("")
      : models.map(([key, name]) => `<option value="${key}" ${key === q.model ? "selected" : ""}>${name}</option>`).join("");
    body.innerHTML = `<header class="cs-heading"><span class="eyebrow">${esc(project.name)} / ${esc(pieceLabel(q))}</span><h1>Ajuste sem começar de novo.</h1></header><div class="cs-editor"><div class="cs-canvas" id="cs-canvas">${renderSVG(q)}</div><div class="cs-box"><label class="cs-field">Modelo<select id="cs-model">${options}</select></label>${q.layout ? field("Linha de apoio", "cs-kicker", q.kicker || "") : ""}${field("Título", "cs-title", q.title)}<label class="cs-field">Texto de apoio<textarea id="cs-copy">${esc(q.copy)}</textarea></label>${field("Próximo passo", "cs-cta", q.cta)}<label class="cs-check"><input id="cs-showbrand" type="checkbox" ${q.showBrand ? "checked" : ""}> Mostrar nome da marca</label><label class="cs-field">Sua imagem (até 2 MB)<input type="file" id="cs-upload" accept="image/png,image/jpeg,image/webp"></label><p class="cs-hint">${q.photo ? "A foto entra nesta peça. Sem arquivo, o espaço mostra um lugar de espera." : "Este modelo não reserva área de foto. A imagem fica guardada se você trocar para um modelo com fotografia."} PNG, JPEG ou WebP, só neste navegador.</p><div class="cs-actions">${button("Aplicar alterações", "apply", true)}${button("Desfazer", "undo")}${button("Refazer", "redo")}${q.layout ? button("Outra frase", "rephrase") : ""}${q.layout ? button("Outro modelo", "swap") : ""}${q.image ? button("Remover imagem", "removeimage") : ""}</div><div class="cs-divider"></div><div class="cs-actions">${button("Baixar PNG", "png")}${button("Baixar SVG", "svg")}${button("Projeto editável", "projectjson")}</div><div class="cs-actions">${button(backLabel, "samples")}</div></div></div>`;
    document.getElementById("cs-upload").onchange = onImage;
  }
  function validColor(c) {
    return /^#[0-9a-f]{6}$/i.test(c) ? c : "#3b82f6";
  }
  function brandColor() {
    return validColor(project?.palette?.[1] || "#3b82f6");
  }
  function textColor(hex) {
    const v = validColor(hex)
      .slice(1)
      .match(/../g)
      .map((n) => parseInt(n, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.179
      ? "#0b0f1a"
      : "#ffffff";
  }
  function readBrief() {
    project.brief = {
      theme: document.getElementById("cs-theme").value.trim(),
      audience: document.getElementById("cs-audience").value.trim(),
      goal: document.getElementById("cs-goal").value,
      message: document.getElementById("cs-message").value.trim(),
      tone: document.getElementById("cs-tone").value.trim(),
      feedback: document.getElementById("cs-feedback").value.trim(),
    };
    project.approved = null;
    project.styleApproved = false;
    saveProject();
  }
  function shorten(value, max) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trim() + "…";
  }
  function makePosts() {
    const b = project.brief;
    if (!state.brain) {
      state.brain = SmeziBrain.buildFallbackBrain(state);
      state.brain.inputStamp = SmeziBrain.stamp(state);
      save();
    }
    const brain = state.brain;
    const topic = b.theme;
    const message = b.message;
    const messages = (brain.keyMessages || []).filter(Boolean);
    const tone = (brain.tone && brain.tone.summary) || b.tone || "";
    const spoken = ((brain.tone && brain.tone.do && brain.tone.do[0]) || message).replace(/^"|"$/g, "");
    const cta = shorten(brain.cta || "Seguir", 42);
    const sets = [
      ["hero", shorten(message, 130), shorten(tone, 220)],
      ["split", shorten(topic, 80), shorten(messages[1] || message, 220)],
      [
        "checklist",
        "O que esta marca sustenta",
        (messages.length ? messages : [message]).slice(0, 3).map((item) => shorten(item, 90)).join("\n"),
      ],
      ["quote", shorten(spoken, 130), shorten(topic, 80)],
      [
        "compare",
        "Em uma frase e no detalhe",
        `${shorten(messages[0] || message, 120)}\n${shorten(messages[1] || tone, 120)}`,
      ],
      [
        "faq",
        shorten("Por onde começar com " + topic, 90),
        shorten((brain.audience ? brain.audience + " " : "") + message, 280),
      ],
    ];
    project.posts = sets.map(([model, title, copy]) => ({
      id: uid(),
      model,
      title,
      copy,
      cta,
      showBrand: true,
      image: null,
    }));
    project.approved = fingerprint();
    project.styleApproved = false;
    saveProject();
  }
  function remember() {
    undo.push(clone(project.posts[editing]));
    if (undo.length > 10) undo.shift();
    redo = [];
  }
  function applyEdit() {
    const current = project.posts[editing];
    const t = document.getElementById("cs-title").value.trim();
    const cp = document.getElementById("cs-copy").value.trim();
    const ca = document.getElementById("cs-cta").value.trim();
    const kickerEl = document.getElementById("cs-kicker");
    const kicker = kickerEl ? kickerEl.value.trim() : current.kicker;
    if (!t) {
      notice("Escreva um título antes de aplicar.");
      return false;
    }
    const chosen = document.getElementById("cs-model").value;
    const template = current.layout && window.SmeziTemplates ? SmeziTemplates.get(chosen) : null;
    const limits = template ? template.limits : current.limits || { title: 130, body: 400, cta: 90, kicker: 40 };
    let title = t;
    let copy = cp;
    let cta = ca;
    let line = kicker || "";
    let fitted = false;
    if (template) {
      const nextTitle = SmeziTemplates.fit(title, limits.title);
      const nextCopy = template.id === "lista" || template.id === "dados" ? copy.split(/\n/).map((item) => SmeziTemplates.fit(item, limits.line || 52)).filter(Boolean).slice(0, 3).join("\n") : SmeziTemplates.fit(copy, limits.body);
      const nextCta = SmeziTemplates.safeCta(cta, limits.cta) || ( /saiba mais/i.test(cta) ? current.cta : SmeziTemplates.fit(cta, limits.cta) );
      const nextLine = SmeziTemplates.fit(line, limits.kicker);
      fitted = nextTitle !== title || nextCopy !== copy || nextCta !== cta || nextLine !== line;
      title = nextTitle;
      copy = nextCopy;
      cta = nextCta;
      line = nextLine;
      if (!title) {
        notice("O título ficou curto demais para este modelo. Escreva uma frase que caiba.");
        return false;
      }
    } else if (t.length > 130 || cp.length > 400 || ca.length > 90) {
      notice("Para manter a legibilidade, use até 130 caracteres no título, 400 no apoio e 90 no próximo passo.");
      return false;
    }
    remember();
    const next = {
      title,
      copy,
      cta,
      showBrand: document.getElementById("cs-showbrand").checked,
      copySource: "user",
    };
    if (kickerEl || template) next.kicker = line;
    if (template) {
      next.template = template.id;
      next.layout = template.layout;
      next.purpose = template.purposes[0];
      next.photo = !!template.photo;
      next.limits = template.limits;
      next.format = current.format || project.format;
    } else next.model = chosen;
    Object.assign(current, next);
    project.styleApproved = false;
    saveProject();
    renderContent();
    notice(fitted ? "Texto ajustado para caber neste modelo." : "Alteração aplicada somente a esta peça.");
    return true;
  }
  function wireActions() {
    app
      .querySelectorAll("[data-cs]")
      .forEach((b) => (b.onclick = () => action(b.dataset.cs)));
    app.querySelectorAll("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          const n = +b.dataset.view;
          if (n <= view) {
            if (document.getElementById("cs-theme")) readBrief();
            view = n;
            if ((n === editorView() || (flowKind !== "content" && n === boardView())) && !project?.posts?.length) view = briefView();
            renderContent();
          }
        }),
    );
  }
  async function action(a) {
    if (a === "home") {
      if (document.getElementById("cs-theme")) readBrief();
      showHome();
      return;
    }
    if (a === "newbrand") {
      newBrand();
      return;
    }
    if (a === "brandwizard") {
      step = 0;
      showStudio();
      return;
    }
    if (a === "guide") {
      if (window.SmeziGuide) SmeziGuide.open();
      return;
    }
    if (a === "confirmbrand") {
      const n = document.getElementById("cs-name").value.trim(),
        desc = document.getElementById("cs-description").value.trim();
      if (!n || !desc || !document.getElementById("cs-confirmcolor").checked) {
        notice(
          "Preencha nome e descrição e confirme a cor e as diretrizes para continuar.",
        );
        return;
      }
      state.name = n.slice(0, 100);
      state.description = desc.slice(0, 1000);
      state.font = document.getElementById("cs-brandfont").value;
      state.touchedFont = true;
      const edit = SmeziBrain.applyAccentEdit(state, document.getElementById("cs-brandcolor").value);
      if (edit.changed) {
        state.palette = "custom";
        state.customPalette = edit.customPalette;
        palettes.custom = edit.customPalette;
        state.touchedPalette = true;
        if (state.brain && state.brain.palette && state.brain.palette[1]) state.brain.palette[1].hex = edit.colors[1];
      }
      if (!state.brain) {
        state.brain = SmeziBrain.buildFallbackBrain(state);
        state.brain.inputStamp = SmeziBrain.stamp(state);
      }
      save();
      project = null;
      ensureProject();
      view = 1;
      renderContent();
      return;
    }
    if (a === "brief") {
      view = 2;
      renderContent();
      return;
    }
    if (a === "savebrief") {
      readBrief();
      notice("Rascunho e observações salvos neste navegador.");
      return;
    }
    if (a === "approvebrief") {
      readBrief();
      const b = project.brief;
      if (!b.theme || !b.audience || !b.message) {
        notice("Informe tema, público e mensagem principal antes de aprovar.");
        return;
      }
      if (b.theme.length > 100 || b.message.length > 300) {
        notice(
          "Use um tema de até 100 caracteres e uma mensagem de até 300 caracteres.",
        );
        return;
      }
      if (!state.brain) {
        state.brain = SmeziBrain.buildFallbackBrain(state);
        state.brain.inputStamp = SmeziBrain.stamp(state);
        save();
      }
      if (flowKind === "campaign") {
        startSet(SmeziTemplates.planCampaign(brandContext()));
        return;
      }
      if (flowKind === "deck") {
        startSet(SmeziTemplates.planDeck());
        return;
      }
      libraryMode = false;
      view = boardView();
      saveProject();
      renderContent();
      return;
    }
    if (a === "openlibrary") {
      libraryMode = true;
      view = boardView();
      renderContent();
      return;
    }
    if (a === "swap") {
      swapIndex = editing;
      libraryMode = true;
      view = boardView();
      renderContent();
      return;
    }
    if (a === "backbrief") {
      view = 2;
      renderContent();
      return;
    }
    if (a === "approvestyle") {
      project.styleApproved = true;
      saveProject();
      renderContent();
      return;
    }
    if (a === "samples") {
      libraryMode = false;
      swapIndex = null;
      view = boardView();
      renderContent();
      return;
    }
    if (a === "apply") {
      applyEdit();
      return;
    }
    if (a === "rephrase") {
      const current = project.posts[editing];
      if (!current || !current.layout || !window.SmeziTemplates) return;
      remember();
      const variant = (Number(current.variant) || 0) + 1;
      const ctx = brandContext();
      ctx.variant = variant;
      const next = SmeziTemplates.previewPost(current.template, ctx, current.format || project.format);
      project.posts[editing] = Object.assign(next, {
        id: current.id,
        image: current.image,
        format: current.format,
        showBrand: current.showBrand,
        variant,
      });
      saveProject();
      renderContent();
      notice("Outra frase da base, no mesmo modelo.");
      return;
    }
    if (a === "undo" && undo.length) {
      redo.push(clone(project.posts[editing]));
      project.posts[editing] = undo.pop();
      saveProject();
      renderContent();
      return;
    }
    if (a === "redo" && redo.length) {
      undo.push(clone(project.posts[editing]));
      project.posts[editing] = redo.pop();
      saveProject();
      renderContent();
      return;
    }
    if (a === "undo" || a === "redo") {
      notice(
        "Nenhuma alteração disponível para " +
          (a === "undo" ? "desfazer." : "refazer."),
      );
      return;
    }
    if (a === "removeimage") {
      remember();
      project.posts[editing].image = null;
      saveProject();
      renderContent();
      return;
    }
    if (a === "projectjson") {
      saveProject();
      download(
        JSON.stringify(
          {
            schema: "smezi-content-project",
            version: 1,
            brand: db.brands.find((b) => b.id === project.brandId),
            project,
          },
          null,
          2,
        ),
        "application/json",
        slug(project.name) + "-projeto.json",
      );
      notice(
        "Projeto exportado com textos, diretrizes e referências de layout editáveis.",
      );
      return;
    }
    if (a === "svg" || a === "png") {
      try {
        await exportArt(a);
      } catch (e) {
        notice(
          "Não foi possível exportar. Tente SVG ou confira a conexão. " +
            e.message,
        );
      }
      return;
    }
  }
  function slug(s) {
    return (
      String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70) || "smezi"
    );
  }
  function download(data, type, name) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  }
  function onImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
      f.size > 2 * 1024 * 1024
    ) {
      notice("Envie PNG, JPEG ou WebP de até 2 MB.");
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        remember();
        project.posts[editing].image = fr.result;
        saveProject();
        renderContent();
        notice(
          saveError ||
            (project.posts[editing].photo
              ? "Imagem aplicada nesta peça."
              : "Imagem guardada. Ela aparece nos modelos com área de fotografia."),
        );
      };
      im.onerror = () => notice("Arquivo de imagem inválido.");
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  }
  let measure = document.createElement("canvas").getContext("2d");
  function wrapText(s, width, size, fontKey) {
    measure.font = `400 ${size}px "${fonts[fontKey] || "Arial"}",Arial`;
    const out = [];
    for (const para of String(s).split("\n")) {
      let current = "";
      for (const word of para.split(/\s+/)) {
        if (!word) continue;
        const candidate = current ? current + " " + word : word;
        if (measure.measureText(candidate).width > width && current) {
          out.push(current);
          current = "";
        }
        if (measure.measureText(word).width > width) {
          for (const char of word) {
            if (measure.measureText(current + char).width > width && current) {
              out.push(current);
              current = "";
            }
            current += char;
          }
        } else current = current ? current + " " + word : word;
      }
      out.push(current);
    }
    return out;
  }
  function artColors() {
    const raw = (project.palette || SmeziBrain.colorsOf(state)).slice(0, 4).map((color) => validColor(color));
    while (raw.length < 4) raw.push("#f7f5ef");
    const lum = (hex) => {
      const channels = hex.slice(1).match(/../g).map((n) => parseInt(n, 16) / 255);
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const sat = (hex) => {
      const [r, g, b] = hex.slice(1).match(/../g).map((n) => parseInt(n, 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (max === min) return 0;
      return (max - min) / (1 - Math.abs(2 * l - 1));
    };
    const neutral = raw.find((color) => lum(color) > 0.78 && sat(color) < 0.28);
    return {
      base: raw[0],
      accent: raw[1],
      support: raw[2],
      signal: raw[3],
      paper: neutral || "#f7f5ef",
      ink: lum(raw[0]) < 0.45 ? raw[0] : "#0b0f1a",
    };
  }
  function renderSVG(q, embedded = "") {
    if (q && q.layout && window.SmeziRender) {
      const frame = formats[q.format || project.format] || formats.post;
      return SmeziRender.render(q, {
        w: frame.w,
        h: frame.h,
        fontName: fonts[project.font] || "Arial",
        palette: project.palette,
        name: project.name,
        embedded: embedded || "",
        escapeHTML: esc,
        photoNote: (state.brain && state.brain.photography && state.brain.photography.direction) || "",
        clip: q.id,
      });
    }
    const f = formats[q.format || project.format] || formats.post,
      w = f.w,
      h = f.h,
      m = Math.round(w * 0.075),
      cw = w - 2 * m,
      art = artColors(),
      accent = art.accent,
      ink = art.ink,
      paper = art.paper;
    let parts = [],
      overflow = false;
    const rect = (x, y, ww, hh, fill, rx = 0) =>
      parts.push(
        `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="${rx}" fill="${fill}"/>`,
      );
    const text = (s, x, y, maxw, size, fill, maxlines = 20) => {
      const lines = wrapText(s, maxw, size, project.font);
      if (lines.length > maxlines) overflow = true;
      parts.push(
        `<text fill="${fill}" font-size="${size}" font-family="StudioExport,${esc(fonts[project.font] || "Arial")},Arial,sans-serif">${lines.map((l, i) => `<tspan x="${x}" y="${y + i * size * 1.27}">${esc(l)}</tspan>`).join("")}</text>`,
      );
      return y + lines.length * size * 1.27;
    };
    const brand = (fg = ink) => {
      if (q.showBrand)
        text(project.name, m, m + 18, cw, Math.round(w * 0.023), fg, 2);
    };
    const photo = (x, y, ww, hh) => {
      const id = "clip-" + q.id;
      parts.push(
        `<defs><clipPath id="${esc(id)}"><rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="12"/></clipPath></defs>`,
      );
      if (q.image)
        parts.push(
          `<image href="${esc(q.image)}" x="${x}" y="${y}" width="${ww}" height="${hh}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${esc(id)})"/>`,
        );
      else {
        rect(x, y, ww, hh, art.support, 12);
        text(
          "Adicionar sua imagem",
          x + ww * 0.1,
          y + hh * 0.5,
          ww * 0.8,
          Math.round(w * 0.022),
          textColor(art.support),
          2,
        );
      }
    };
    const size = Math.round(w * (project.format === "deck" ? 0.043 : 0.068)),
      body = Math.round(w * (project.format === "deck" ? 0.022 : 0.032)),
      small = Math.max(28, Math.round(w * 0.023));
    let y = m + size * 1.8;
    if (q.model === "hero") {
      rect(0, 0, w, h, accent);
      const fg = textColor(accent);
      brand(fg);
      y = text(q.title, m, h * 0.32, cw, size, fg, 5);
      text(q.copy, m, Math.max(y + body, h * 0.57), cw, body, fg, 7);
      text(q.cta, m, h - m - small, cw, small, fg, 3);
    } else if (q.model === "split") {
      rect(0, 0, w, h, paper);
      rect(0, 0, w, Math.max(10, Math.round(h * 0.012)), art.signal);
      brand();
      photo(w * 0.55, h * 0.18, w * 0.4, h * 0.65);
      y = text(q.title, m, h * 0.3, w * 0.4, size * 0.8, ink, 6);
      text(q.copy, m, y + body, w * 0.4, body * 0.9, ink, 8);
      text(q.cta, m, h - m - small, cw, small, ink, 3);
    } else if (q.model === "number") {
      rect(0, 0, w, h, paper);
      rect(0, 0, w, Math.max(10, Math.round(h * 0.012)), art.signal);
      brand();
      text("03", m, h * 0.36, cw, size * 2.8, accent, 1);
      y = text(q.title, m, h * 0.53, cw, size, ink, 4);
      text(q.copy, m, y + body, cw, body, ink, 7);
    } else if (q.model === "checklist") {
      rect(0, 0, w, h, paper);
      brand();
      y = text(q.title, m, h * 0.24, cw, size, ink, 4);
      q.copy
        .split(/[\n]+/)
        .filter(Boolean)
        .forEach((s, i) => {
          y += body * 1.5;
          rect(m, y - body * 0.8, body, body, accent, 5);
          y = text(s, m + body * 1.7, y, cw - body * 1.7, body, ink, 3);
        });
      text(q.cta, m, h - m - small, cw, small, ink, 3);
    } else if (q.model === "quote") {
      rect(0, 0, w, h, ink);
      brand("#fff");
      text("“", m, h * 0.28, cw, size * 2.3, accent, 1);
      y = text(q.title, m, h * 0.4, cw, size, "#fff", 6);
      text(q.copy, m, Math.max(y + body, h * 0.7), cw, body, "#fff", 5);
    } else if (q.model === "photo") {
      rect(0, 0, w, h, "#fff");
      photo(0, 0, w, h * 0.62);
      rect(0, h * 0.6, w, h * 0.4, accent);
      const fg = textColor(accent);
      y = text(q.title, m, h * 0.7, cw, size * 0.8, fg, 4);
      text(q.cta, m, h - m - small, cw, small, fg, 3);
    } else if (q.model === "compare") {
      rect(0, 0, w, h, paper);
      rect(0, 0, w, Math.max(10, Math.round(h * 0.012)), art.signal);
      brand();
      y = text(q.title, m, h * 0.23, cw, size, ink, 4);
      rect(m, h * 0.43, cw / 2 - 12, h * 0.34, ink, 14);
      rect(w / 2 + 12, h * 0.43, cw / 2 - 12, h * 0.34, accent, 14);
      let blocks = q.copy.split("\n");
      text(
        blocks[0] || "Contexto",
        m + 24,
        h * 0.5,
        cw / 2 - 60,
        body,
        "#fff",
        6,
      );
      text(
        blocks.slice(1).join(" ") || "Possibilidades",
        w / 2 + 36,
        h * 0.5,
        cw / 2 - 60,
        body,
        textColor(accent),
        6,
      );
      text(q.cta, m, h - m - small, cw, small, ink, 3);
    } else if (q.model === "process") {
      rect(0, 0, w, h, paper);
      brand();
      y = text(q.title, m, h * 0.22, cw, size, ink, 4);
      q.copy
        .split(/[\n.]+/)
        .filter(Boolean)
        .slice(0, 4)
        .forEach((s, i) => {
          y += body * 1.7;
          rect(m, y - body, body * 1.5, body * 1.5, accent, body * 0.75);
          text(
            String(i + 1),
            m + body * 0.4,
            y,
            cw,
            body,
            textColor(accent),
            1,
          );
          y = text(s, m + body * 2.2, y, cw - body * 2.2, body, ink, 3);
        });
    } else if (q.model === "faq") {
      rect(0, 0, w, h, paper);
      rect(0, 0, w, Math.max(10, Math.round(h * 0.012)), art.signal);
      brand();
      rect(m, h * 0.2, cw, h * 0.25, accent, 15);
      text(
        q.title,
        m + 28,
        h * 0.28,
        cw - 56,
        size * 0.8,
        textColor(accent),
        4,
      );
      text(q.copy, m, h * 0.55, cw, body, ink, 9);
      text(q.cta, m, h - m - small, cw, small, ink, 3);
    } else if (q.model === "cards") {
      rect(0, 0, w, h, paper);
      brand();
      y = text(q.title, m, h * 0.22, cw, size, ink, 4);
      q.copy
        .split(/[\n]+/)
        .filter(Boolean)
        .slice(0, 3)
        .forEach((s, i) => {
          const yy = h * 0.4 + i * h * 0.14;
          rect(m, yy, cw, h * 0.12, paper, 13);
          rect(m, yy, 8, h * 0.12, art.support, 4);
          text(s, m + 25, yy + body * 1.8, cw - 50, body, ink, 3);
        });
    } else if (q.model === "announce") {
      rect(0, 0, w, h, paper);
      rect(0, 0, w, Math.max(10, Math.round(h * 0.012)), art.signal);
      rect(0, 0, w, h * 0.06, art.signal);
      brand();
      text("COMUNICADO", m, h * 0.28, cw, body, accent, 1);
      y = text(q.title, m, h * 0.4, cw, size, ink, 5);
      text(q.copy, m, y + body * 1.5, cw, body, ink, 7);
      text(q.cta, m, h - m - small, cw, small, ink, 3);
    } else {
      rect(0, 0, w, h, ink);
      brand("#fff");
      y = text(q.title, m, h * 0.3, cw, size, "#fff", 5);
      text(q.copy, m, y + body, cw, body, "#fff", 6);
      rect(m, h * 0.8, cw, h * 0.1, accent, 20);
      text(q.cta, m + 28, h * 0.86, cw - 56, body, textColor(accent), 2);
    }
    // Never export silently cropped text: signal content that needs a shorter copy.
    if (overflow)
      parts.push(
        `<rect x="0" y="${h - 55}" width="${w}" height="55" fill="#9f1239"/><text x="${m}" y="${h - 20}" fill="white" font-size="24">Revise: texto extenso para esta composição.</text>`,
      );
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(q.title)}">${embedded ? `<style>@font-face{font-family:StudioExport;src:url(data:font/ttf;base64,${embedded}) format('truetype');font-weight:400}</style>` : ""}${parts.join("")}</svg>`;
  }
  const bannerFonts = {};
  async function fontData(key) {
    if (key === "arial") return "";
    if (bannerFonts[key]) return bannerFonts[key];
    const response = await fetch(
      "./assets/fonts/" + (fonts[key] ? key : "manrope") + ".ttf",
    );
    if (!response.ok) throw new Error("Fonte indisponível.");
    const ab = new Uint8Array(await response.arrayBuffer());
    let str = "";
    for (const b of ab) str += String.fromCharCode(b);
    return (bannerFonts[key] = btoa(str));
  }
  async function exportArt(type) {
    const q = project.posts[editing];
    notice("Preparando " + type.toUpperCase() + " na resolução original…");
    if (document.fonts?.ready) await document.fonts.ready;
    const font = await fontData(project.font);
    const svg = renderSVG(q, font);
    if (svg.includes("Revise: texto extenso")) {
      notice("Reduza o texto antes de exportar esta composição.");
      return;
    }
    const name =
      slug(project.name) + "-" + String(editing + 1).padStart(2, "0");
    if (type === "svg") {
      download(svg, "image/svg+xml", name + ".svg");
      notice("SVG exportado com elementos e fonte incorporada.");
      return;
    }
    const blob = new Blob([svg], { type: "image/svg+xml" }),
      url = URL.createObjectURL(blob);
    try {
      const im = new Image();
      await new Promise((res, rej) => {
        im.onload = res;
        im.onerror = () => rej(new Error("Falha ao renderizar a imagem."));
        im.src = url;
      });
      const f = formats[q.format || project.format] || formats.post;
      const canvas = document.createElement("canvas");
      canvas.width = f.w;
      canvas.height = f.h;
      canvas.getContext("2d").drawImage(im, 0, 0);
      const png = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!png) throw new Error("Arquivo vazio.");
      download(png, "image/png", name + ".png");
      notice(`PNG exportado em ${f.w} × ${f.h} px.`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  // Restore custom palettes before showing existing data; keep the v1 storage key intact.
  if (Array.isArray(state.customPalette) && state.customPalette.length === 4)
    palettes.custom = state.customPalette;
  // Recompute line breaks after the selected fonts load, without replacing editor fields.
  if (document.fonts?.load)
    Promise.all(
      Object.values(fonts)
        .filter((n) => n !== "Arial")
        .map((n) => document.fonts.load(`400 36px "${n}"`).catch(() => [])),
    ).then(() => {
      if (document.querySelector(".cs-samples")) {
        document.querySelectorAll(".cs-sample").forEach((e, i) => {
          if (e.classList.contains("lib-card")) return;
          const old = e.querySelector("svg");
          if (old && project?.posts[i])
            old.outerHTML = renderSVG(project.posts[i]);
        });
      }
      if (window.SmeziLibrary) SmeziLibrary.refresh();
      if (view === editorView() && document.getElementById("cs-canvas") && project?.posts[editing])
        document.getElementById("cs-canvas").innerHTML = renderSVG(
          project.posts[editing],
        );
    });
  window.SmeziStudio = { openContent, setBrand, newBrand };
  document.querySelector("#homeBtn").onclick = showHome;
  window.addEventListener("keydown", (e) => {
    if (
      view !== editorView() ||
      !document.getElementById("cs-canvas") ||
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
    )
      return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      action(e.shiftKey ? "redo" : "undo");
    }
  });
  const boot = window.SmeziKnowledge && SmeziKnowledge.ready ? SmeziKnowledge.ready : Promise.resolve();
  boot.then(() => showHome());
})();
