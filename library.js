/* Templates screen: filters and previews painted with the current brand. */
(() => {
  "use strict";
  const FORMATS = [
    ["post", "Post 1080×1350"],
    ["square", "Quadrado 1080×1080"],
    ["story", "Story 1080×1920"],
    ["deck", "Apresentação 1920×1080"],
  ];
  const PURPOSES = [
    ["todas", "Todas"],
    ["lançamento", "Lançamento"],
    ["educativo", "Educativo"],
    ["institucional", "Institucional"],
    ["oferta", "Oferta"],
    ["depoimento", "Depoimento"],
    ["bastidores", "Bastidores"],
    ["evento", "Evento"],
    ["citação", "Citação"],
  ];
  const SIZES = {
    post: { w: 1080, h: 1350 },
    square: { w: 1080, h: 1080 },
    story: { w: 1080, h: 1920 },
    deck: { w: 1920, h: 1080 },
  };
  let last = null;

  function esc(value) {
    return typeof escapeHTML === "function"
      ? escapeHTML(value)
      : String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function contextOf(opts) {
    const state = opts.state || {};
    return {
      name: state.name,
      segment: state.segment,
      description: state.description,
      traits: state.traits || [],
      styles: state.styles || [],
      avoid: state.avoid || [],
      brain: state.brain,
      brief: (opts.project && opts.project.brief) || {},
    };
  }
  function paint(root, opts, format, purpose) {
    const ctx = contextOf(opts);
    const templates = SmeziTemplates.forFilter(format, purpose);
    const size = SIZES[format] || SIZES.post;
    const fontName = { manrope: "Manrope", playfair: "Playfair Display", dm: "DM Sans", sora: "Sora" }[opts.project && opts.project.font] || "Manrope";
    const note = (opts.state && opts.state.brain && opts.state.brain.photography && opts.state.brain.photography.direction) || "";
    const grid = root.querySelector(".lib-grid");
    grid.classList.toggle("wide", format === "deck" || format === "story");
    if (!templates.length) {
      grid.innerHTML = `<p class="lib-empty">Nenhum modelo de ${esc(purpose === "todas" ? "peça" : purpose)} neste formato.</p>`;
      return;
    }
    grid.innerHTML = templates
      .map((template) => {
        const post = SmeziTemplates.previewPost(template.id, ctx, format);
        post.id = template.id + format;
        const svg = SmeziRender.render(post, {
          w: size.w,
          h: size.h,
          fontName,
          palette: opts.project.palette,
          name: opts.project.name,
          escapeHTML: esc,
          photoNote: note,
          clip: template.id + format,
        });
        return `<button type="button" class="cs-sample lib-card" data-template="${esc(template.id)}" data-format="${esc(format)}"><span class="lib-svg">${svg}</span><span><strong>${esc(template.name)}</strong> · ${esc(template.purposes[0])}</span></button>`;
      })
      .join("");
    grid.querySelectorAll("[data-template]").forEach((button) => {
      button.onclick = () => {
        if (root.dataset.busy === "1") return;
        root.dataset.busy = "1";
        Promise.resolve(opts.onPick(button.dataset.template, button.dataset.format)).finally(() => {
          if (root.isConnected) root.dataset.busy = "0";
        });
      };
    });
  }
  function mount(root, opts) {
    if (!root || !window.SmeziTemplates || !window.SmeziRender) return;
    const format = FORMATS.some(([id]) => id === opts.format) ? opts.format : (opts.project && opts.project.format) || "post";
    last = { root, opts, format, purpose: "todas" };
    const pieces = (opts.project && opts.project.posts) || [];
    root.innerHTML = `<div class="lib-filters" role="group" aria-label="Formato">${FORMATS.map(([id, label]) => `<button type="button" data-format-filter="${id}" aria-pressed="${id === format}">${label}</button>`).join("")}</div><div class="lib-filters" role="group" aria-label="Função">${PURPOSES.map(([id, label]) => `<button type="button" data-purpose-filter="${id}" aria-pressed="${id === "todas"}">${label}</button>`).join("")}</div>${pieces.length ? `<div class="lib-rail">${pieces.map((piece, index) => `<button type="button" data-open-piece="${index}">${esc((SmeziTemplates.get(piece.template) || {}).name || piece.model || "Peça")} ${index + 1}</button>`).join("")}</div>` : ""}<div class="lib-grid"></div>`;
    const refresh = () => paint(root, opts, last.format, last.purpose);
    root.querySelectorAll("[data-format-filter]").forEach((button) => {
      button.onclick = () => {
        last.format = button.dataset.formatFilter;
        root.querySelectorAll("[data-format-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        refresh();
      };
    });
    root.querySelectorAll("[data-purpose-filter]").forEach((button) => {
      button.onclick = () => {
        last.purpose = button.dataset.purposeFilter;
        root.querySelectorAll("[data-purpose-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        refresh();
      };
    });
    root.querySelectorAll("[data-open-piece]").forEach((button) => {
      button.onclick = () => opts.onOpen && opts.onOpen(+button.dataset.openPiece);
    });
    refresh();
  }
  function refresh() {
    if (last && last.root && last.root.isConnected) paint(last.root, last.opts, last.format, last.purpose);
  }
  window.SmeziLibrary = { mount, refresh, FORMATS, PURPOSES };
})();
