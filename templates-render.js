/* SVG layouts for the template library. Geometry changes with mood.
   Classic script sets globalThis.SmeziRender. Node require() gets module.exports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmeziRender = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function valid(color) {
    return /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#f6f3ec";
  }
  function channels(hex) {
    return valid(hex)
      .slice(1)
      .match(/../g)
      .map((part) => parseInt(part, 16) / 255);
  }
  function lum(hex) {
    const [r, g, b] = channels(hex).map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function sat(hex) {
    const [r, g, b] = channels(hex);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;
    if (max === min) return 0;
    return (max - min) / (1 - Math.abs(2 * light - 1));
  }
  function colorsOf(palette) {
    const raw = (palette || []).slice(0, 4).map(valid);
    while (raw.length < 4) raw.push("#f6f3ec");
    const paper = raw.find((color) => lum(color) > 0.78 && sat(color) < 0.28) || "#f6f3ec";
    const ink = lum(raw[0]) < 0.45 ? raw[0] : "#14120f";
    return {
      base: raw[0],
      accent: raw[1],
      support: raw[2],
      signal: raw[3],
      paper,
      ink,
      on(fill) {
        return lum(fill) > 0.62 ? ink : paper;
      },
    };
  }
  function wrap(value, maxChars) {
    const words = String(value || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      if (!line) {
        line = word;
        continue;
      }
      if ((line + " " + word).length > maxChars) {
        lines.push(line);
        line = word;
      } else line += " " + word;
    }
    if (line) lines.push(line);
    return lines;
  }
  function fontOf(ctx) {
    const name = String(ctx.fontName || "Arial").replace(/["']/g, "");
    return "StudioExport,'" + name + "',Arial,sans-serif";
  }
  function ratio(ctx) {
    return /playfair/i.test(ctx.fontName || "") ? 0.56 : 0.5;
  }
  function text(api, value, x, y, width, size, fill, maxLines, tracking) {
    if (!value || size < 8 || width < 8) return y;
    const maxChars = Math.max(4, Math.floor(width / (size * ratio(api.ctx))));
    const lead = size * (size > api.unit * 0.05 ? 1.12 : 1.28);
    const room = Math.max(0, Math.floor((api.h - api.m * 0.35 - y) / lead));
    const lines = wrap(value, maxChars).slice(0, Math.min(maxLines || 4, room));
    if (!lines.length) return y;
    const anchor = api.anchor || "start";
    api.parts.push(
      `<text fill="${fill}" font-size="${Math.round(size)}" font-family="${fontOf(api.ctx)}" letter-spacing="${tracking || 0}" text-anchor="${anchor}">${lines
        .map((line, index) => `<tspan x="${Math.round(x)}" y="${Math.round(y + index * lead)}">${api.esc(line)}</tspan>`)
        .join("")}</text>`,
    );
    api.anchor = "start";
    return y + lines.length * lead;
  }
  function rect(api, x, y, w, h, fill) {
    api.parts.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${fill}"/>`);
  }
  function rule(api, x, y, w, color) {
    rect(api, x, y, w, Math.max(2, Math.round(api.unit * 0.003)), color);
  }
  function brand(api, x, y, fill) {
    if (!api.post.showBrand || !api.ctx.name) return;
    text(api, api.ctx.name, x, y, api.w * 0.62, api.kicker, fill, 1, 1.4);
  }
  function photo(api, x, y, w, h, mode) {
    if (w < 8 || h < 8) return;
    const id = "ph" + String(api.clip || api.post.id || "x").replace(/[^a-zA-Z0-9]/g, "") + Math.round(x) + Math.round(y);
    api.parts.push(`<g data-photo="${mode || "fill"}">`);
    api.parts.push(`<defs><clipPath id="${id}"><rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}"/></clipPath></defs>`);
    if (api.post.image) {
      api.parts.push(`<image href="${api.esc(api.post.image)}" x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`);
      api.parts.push("</g>");
      return;
    }
    const art = api.art;
    const ground = lum(art.support) > 0.55 ? art.ink : art.support;
    const sky = lum(art.ink) < 0.4 ? art.ink : art.base;
    api.parts.push(`<g clip-path="url(#${id})">`);
    rect(api, x, y, w, h, sky);
    rect(api, x, y + h * 0.62, w, h * 0.38, ground);
    rect(api, x + w * 0.1, y + h * 0.28, Math.max(28, w * 0.16), Math.max(2, api.unit * 0.004), art.accent);
    rect(api, x + w * 0.74, y + h * 0.12, Math.max(2, api.unit * 0.002), h * 0.36, art.paper);
    const previous = api.anchor;
    api.anchor = "start";
    const buried = h > api.h * 0.85;
    text(api, api.note, x + w * 0.08, y + h * (buried ? 0.4 : 0.76), w * 0.8, Math.max(16, Math.round(Math.min(w, h) * 0.045)), art.on(ground), 2, 0);
    text(api, "sua fotografia", x + w * 0.08, y + h * (buried ? 0.52 : 0.9), w * 0.8, Math.max(13, Math.round(Math.min(w, h) * 0.032)), art.on(ground), 1, 1.6);
    api.anchor = previous;
    api.parts.push("</g></g>");
  }
  function stage(api, fill) {
    rect(api, 0, 0, api.w, api.h, fill);
  }
  function items(post) {
    return String(post.copy || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  function margem(api) {
    const warm = api.mood === "warm";
    stage(api, api.art.paper);
    if (warm) {
      api.structure = "flush";
      photo(api, api.w * 0.56, api.h * 0.08, api.w * 0.44, api.h * 0.5, "bleed");
      brand(api, api.m, api.m + api.kicker, api.art.ink);
      text(api, api.post.kicker, api.m, api.h * 0.22, api.w * 0.48, api.kicker, api.art.accent, 1, 2);
      const y = text(api, api.post.title, api.m, api.h * 0.3, api.w * 0.48, api.title, api.art.ink, 3, 0);
      rule(api, api.m, y + api.unit * 0.02, api.unit * 0.12, api.art.accent);
      text(api, api.post.copy, api.m, Math.max(y + api.body * 2, api.h * 0.62), api.w * 0.5, api.body, api.art.ink, 5, 0);
    } else {
      api.structure = "inset";
      brand(api, api.m, api.m + api.kicker, api.art.ink);
      text(api, api.post.kicker, api.m, api.h * 0.2, api.w * 0.7, api.kicker, api.art.accent, 1, 2.2);
      const y = text(api, api.post.title, api.m, api.h * 0.28, api.w * 0.72, api.title, api.art.ink, 3, 0);
      rule(api, api.m, y + api.unit * 0.03, api.unit * 0.08, api.art.accent);
      text(api, api.post.copy, api.m, y + api.body * 2.4, api.w * 0.46, api.body, api.art.ink, 5, 0);
      photo(api, api.w * 0.58, api.h * 0.64, api.w * 0.28, api.h * 0.22, "mat");
    }
    text(api, api.post.cta, api.m, api.h - api.m, api.w * 0.6, api.small, api.art.ink, 1, 1.2);
  }
  function fotografia(api) {
    const warm = api.mood === "warm";
    if (warm) {
      api.structure = "bleed";
      stage(api, api.art.paper);
      photo(api, 0, 0, api.w, api.h * 0.66, "bleed");
      brand(api, api.m, api.m + api.kicker, api.art.paper);
      text(api, api.post.kicker, api.m, api.m + api.kicker * 2.6, api.w * 0.6, api.kicker, api.art.paper, 1, 2);
      text(api, api.post.title, api.m, api.h * 0.76, api.w - api.m * 2, api.title * 0.92, api.art.ink, 2, 0);
      text(api, api.post.cta, api.m, api.h - api.m, api.w * 0.6, api.small, api.art.ink, 1, 1.2);
    } else {
      api.structure = "mat";
      stage(api, api.art.paper);
      brand(api, api.m, api.m + api.kicker, api.art.ink);
      text(api, api.post.kicker, api.m, api.h * 0.16, api.w * 0.7, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.m, api.h * 0.22, api.w - api.m * 2, api.title * 0.86, api.art.ink, 2, 0);
      photo(api, api.m, api.h * 0.36, api.w - api.m * 2, api.h * 0.4, "mat");
      text(api, api.post.copy, api.m, api.h * 0.82, api.w - api.m * 2, api.body, api.art.ink, 2, 0);
      text(api, api.post.cta, api.m, api.h - api.m * 0.6, api.w * 0.6, api.small, api.art.ink, 1, 1.2);
    }
  }
  function coluna(api) {
    const warm = api.mood === "warm";
    stage(api, api.art.paper);
    if (warm) {
      api.structure = "stack";
      brand(api, api.m, api.m + api.kicker, api.art.ink);
      text(api, api.post.kicker, api.m, api.h * 0.16, api.w * 0.7, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.m, api.h * 0.24, api.w - api.m * 2, api.title, api.art.ink, 3, 0);
      const lines = String(api.post.copy || "").split(/(?<=[.!?])\s+|\n+/).filter(Boolean).slice(0, 3);
      lines.forEach((line, index) => {
        const y = api.h * (0.58 + index * (api.tall ? 0.1 : 0.09));
        const x = api.m + index * api.unit * 0.04;
        rule(api, x, y - api.body, api.unit * 0.06, api.art.accent);
        text(api, line, x, y, api.w * 0.72, api.body, api.art.ink, 2, 0);
      });
    } else {
      api.structure = "panel";
      rect(api, 0, 0, api.w * 0.38, api.h, api.art.ink);
      text(api, api.post.kicker, api.m * 0.7, api.h * 0.18, api.w * 0.28, api.kicker, api.art.accent, 1, 1.6);
      text(api, api.post.title, api.m * 0.7, api.h * 0.28, api.w * 0.3, api.title * 0.78, api.art.paper, 5, 0);
      if (api.post.showBrand) text(api, api.ctx.name, api.m * 0.7, api.h - api.m, api.w * 0.28, api.small, api.art.paper, 1, 1);
      text(api, api.post.copy, api.w * 0.46, api.h * 0.28, api.w * 0.46, api.body, api.art.ink, 8, 0);
      text(api, api.post.cta, api.w * 0.46, api.h - api.m, api.w * 0.4, api.small, api.art.ink, 1, 1.2);
    }
  }
  function lista(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "stagger" : "index";
    stage(api, api.art.paper);
    brand(api, api.m, api.m + api.kicker, api.art.ink);
    text(api, api.post.kicker, api.m, api.h * 0.16, api.w * 0.7, api.kicker, api.art.accent, 1, 2);
    const yTitle = text(api, api.post.title, api.m, api.h * 0.23, api.w - api.m * 2, api.title * 0.9, api.art.ink, 2, 0);
    items(api.post).forEach((line, index) => {
      const y = Math.max(yTitle + api.body, api.h * 0.42) + index * (api.tall ? api.h * 0.14 : api.h * 0.13);
      const x = api.m + (warm ? index * api.unit * 0.035 : 0);
      if (warm) rect(api, x, y - api.body * 0.95, api.body * 1.15, api.body * 1.15, api.art.accent);
      text(api, String(index + 1).padStart(2, "0"), x + (warm ? api.body * 0.15 : 0), y, api.w * 0.2, api.body, warm ? api.art.on(api.art.accent) : api.art.accent, 1, 0);
      text(api, line, x + api.w * 0.16, y, api.w * 0.68, api.body, api.art.ink, 2, 0);
    });
    text(api, api.post.cta, api.m, api.h - api.m, api.w * 0.6, api.small, api.art.ink, 1, 1.2);
  }
  function citacao(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "ink" : "paper";
    const bg = warm ? api.art.ink : api.art.paper;
    const fg = warm ? api.art.paper : api.art.ink;
    stage(api, bg);
    text(api, "“", api.m, api.h * 0.22, api.w, api.title * 1.8, api.art.accent, 1, 0);
    if (api.post.showBrand) text(api, api.ctx.name, api.m, api.m + api.kicker, api.w * 0.6, api.kicker, fg, 1, 1.5);
    text(api, api.post.title, api.m, api.h * 0.38, api.w - api.m * 2.2, api.title * 0.82, fg, 5, 0);
    text(api, api.post.copy, api.m, api.h - api.m, api.w * 0.7, api.small, api.art.accent, 1, 1.4);
  }
  function cartaz(api) {
    const warm = api.mood === "warm";
    stage(api, api.art.paper);
    if (warm) {
      api.structure = "field";
      rect(api, 0, 0, api.w, api.h * 0.4, api.art.accent);
      text(api, api.post.kicker, api.m, api.h * 0.16, api.w * 0.7, api.kicker, api.art.on(api.art.accent), 1, 2.4);
      if (api.post.showBrand) text(api, api.ctx.name, api.m, api.h * 0.28, api.w * 0.7, api.small, api.art.on(api.art.accent), 1, 1);
      text(api, api.post.title, api.m, api.h * 0.56, api.w - api.m * 2, api.title * 1.15, api.art.ink, 3, 0);
      text(api, api.post.copy, api.m, api.h * 0.78, api.w * 0.7, api.body, api.art.ink, 3, 0);
    } else {
      api.structure = "quiet";
      text(api, api.post.kicker, api.m, api.h * 0.28, api.w * 0.6, api.kicker, api.art.accent, 1, 2.6);
      text(api, api.post.title, api.m, api.h * 0.4, api.w - api.m * 2, api.title * 1.2, api.art.ink, 3, 0);
      if (api.post.showBrand) text(api, api.ctx.name, api.m, api.h - api.m * 1.8, api.w * 0.5, api.small, api.art.ink, 1, 1.2);
    }
    text(api, api.post.cta, api.m, api.h - api.m, api.w * 0.6, api.small, warm ? api.art.ink : api.art.accent, 1, 1.2);
  }
  function oferta(api) {
    const warm = api.mood === "warm";
    stage(api, api.art.paper);
    if (warm) {
      api.structure = "ticket";
      rect(api, api.w * 0.68, 0, api.w * 0.32, api.h, api.art.support);
      text(api, api.post.kicker, api.m, api.h * 0.2, api.w * 0.55, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.m, api.h * 0.32, api.w * 0.55, api.title, api.art.ink, 4, 0);
      text(api, api.post.copy, api.m, api.h * 0.62, api.w * 0.55, api.body, api.art.ink, 5, 0);
      text(api, api.post.cta, api.w * 0.72, api.h * 0.5, api.w * 0.22, api.small, api.art.on(api.art.support), 3, 1);
    } else {
      api.structure = "frame";
      api.parts.push(`<rect x="${api.m}" y="${api.m}" width="${Math.round(api.w - api.m * 2)}" height="${Math.round(api.h - api.m * 2)}" fill="none" stroke="${api.art.ink}" stroke-width="1.5"/>`);
      text(api, api.post.kicker, api.m * 1.8, api.h * 0.22, api.w * 0.7, api.kicker, api.art.accent, 1, 2.4);
      text(api, api.post.title, api.m * 1.8, api.h * 0.34, api.w - api.m * 4, api.title, api.art.ink, 3, 0);
      text(api, api.post.copy, api.m * 1.8, api.h * 0.58, api.w * 0.62, api.body, api.art.ink, 4, 0);
      text(api, api.post.cta, api.m * 1.8, api.h - api.m * 2, api.w * 0.6, api.small, api.art.ink, 1, 1.2);
    }
    if (api.post.showBrand && !warm) text(api, api.ctx.name, api.w - api.m * 3.2, api.h - api.m * 2, api.w * 0.3, api.small, api.art.ink, 1, 1);
    if (api.post.showBrand && warm) brand(api, api.m, api.m + api.kicker, api.art.ink);
  }
  function retrato(api) {
    const warm = api.mood === "warm";
    stage(api, api.art.paper);
    if (warm) {
      api.structure = "bleed";
      photo(api, 0, 0, api.w * 0.48, api.h, "bleed");
      text(api, api.post.kicker, api.w * 0.54, api.h * 0.22, api.w * 0.38, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.w * 0.54, api.h * 0.32, api.w * 0.38, api.title * 0.78, api.art.ink, 6, 0);
      text(api, api.post.copy, api.w * 0.54, api.h - api.m * 1.8, api.w * 0.38, api.small, api.art.ink, 1, 1.2);
    } else {
      api.structure = "mat";
      photo(api, api.m, api.h * 0.16, api.w * 0.38, api.h * 0.62, "mat");
      text(api, api.post.kicker, api.w * 0.5, api.h * 0.24, api.w * 0.4, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.w * 0.5, api.h * 0.34, api.w * 0.4, api.title * 0.72, api.art.ink, 6, 0);
      text(api, api.post.copy, api.w * 0.5, api.h * 0.78, api.w * 0.4, api.small, api.art.ink, 1, 1.2);
    }
    text(api, api.post.cta, warm ? api.w * 0.54 : api.w * 0.5, api.h - api.m, api.w * 0.4, api.small, api.art.accent, 1, 1);
  }
  function bastidor(api) {
    const warm = api.mood === "warm";
    if (warm) {
      api.structure = "bleed";
      photo(api, 0, 0, api.w, api.h, "bleed");
      const bw = api.w * 0.62;
      const bh = api.tall ? api.h * 0.22 : api.h * 0.28;
      rect(api, api.m, api.h - bh - api.m, bw, bh, api.art.paper);
      text(api, api.post.kicker, api.m * 1.5, api.h - bh - api.m + api.kicker * 2, bw - api.m, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.m * 1.5, api.h - bh + api.title * 0.2, bw - api.m * 2, api.title * 0.72, api.art.ink, 3, 0);
    } else {
      api.structure = "mat";
      stage(api, api.art.paper);
      photo(api, api.w * 0.12, api.h * 0.1, api.w * 0.76, api.h * 0.58, "mat");
      text(api, api.post.kicker, api.m, api.h * 0.76, api.w * 0.7, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.m, api.h * 0.82, api.w - api.m * 2, api.title * 0.8, api.art.ink, 2, 0);
      text(api, api.post.cta, api.m, api.h - api.m * 0.7, api.w * 0.6, api.small, api.art.ink, 1, 1);
    }
  }
  function evento(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "stripe" : "quiet";
    stage(api, api.art.paper);
    if (warm) rect(api, 0, 0, Math.max(12, api.unit * 0.018), api.h, api.art.accent);
    brand(api, api.m, api.m + api.kicker, api.art.ink);
    text(api, api.post.kicker, api.m, api.h * 0.22, api.w * 0.6, api.kicker, api.art.accent, 1, 2.5);
    text(api, api.post.title, api.m, api.h * 0.34, api.w - api.m * 2, api.title * 1.05, api.art.ink, 3, 0);
    rule(api, api.m, api.h * 0.62, warm ? api.unit * 0.18 : api.unit * 0.08, api.art.accent);
    text(api, api.post.copy, api.m, api.h * 0.7, api.w * 0.7, api.body, api.art.ink, 3, 0);
    text(api, api.post.cta, api.m, api.h - api.m, api.w * 0.6, api.small, api.art.ink, 1, 1);
  }
  function pergunta(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "band" : "column";
    stage(api, api.art.paper);
    brand(api, api.m, api.m + api.kicker, api.art.ink);
    text(api, api.post.kicker, api.m, api.h * 0.18, api.w * 0.6, api.kicker, api.art.accent, 1, 2);
    text(api, api.post.title, api.m, api.h * 0.32, warm ? api.w - api.m * 2 : api.w * 0.78, api.title, api.art.ink, 4, 0);
    if (warm) {
      rect(api, 0, api.h * 0.72, api.w, api.h * 0.28, api.art.ink);
      text(api, api.post.copy, api.m, api.h * 0.84, api.w - api.m * 2, api.body, api.art.paper, 3, 0);
    } else {
      rule(api, api.m, api.h * 0.58, api.unit * 0.1, api.art.accent);
      text(api, api.post.copy, api.m, api.h * 0.66, api.w * 0.62, api.body, api.art.ink, 4, 0);
      text(api, api.post.cta, api.m, api.h - api.m, api.w * 0.5, api.small, api.art.accent, 1, 1);
    }
  }
  function capa(api) {
    const warm = api.mood === "warm";
    stage(api, api.art.paper);
    if (warm) {
      api.structure = "split";
      photo(api, api.w * 0.54, 0, api.w * 0.46, api.h, "bleed");
      text(api, api.post.kicker, api.m, api.h * 0.28, api.w * 0.42, api.kicker, api.art.accent, 1, 2);
      text(api, api.post.title, api.m, api.h * 0.4, api.w * 0.44, api.title * 1.05, api.art.ink, 3, 0);
      text(api, api.post.copy, api.m, api.h * 0.72, api.w * 0.4, api.body, api.art.ink, 3, 0);
    } else {
      api.structure = "type";
      text(api, api.post.kicker, api.m, api.h * 0.26, api.w * 0.5, api.kicker, api.art.accent, 1, 2.4);
      text(api, api.post.title, api.m, api.h * 0.4, api.w * 0.62, api.title * 1.15, api.art.ink, 3, 0);
      text(api, api.post.copy, api.m, api.h * 0.68, api.w * 0.4, api.body, api.art.ink, 3, 0);
      photo(api, api.w * 0.72, api.h * 0.58, api.w * 0.2, api.h * 0.28, "mat");
    }
  }
  function secao(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "corner" : "quiet";
    stage(api, warm ? api.art.ink : api.art.paper);
    const fg = warm ? api.art.paper : api.art.ink;
    if (warm) api.anchor = "end";
    text(api, api.post.kicker || "01", warm ? api.w - api.m : api.m, warm ? api.m + api.title : api.h * 0.22, api.w * 0.3, api.title * 0.7, api.art.accent, 1, 0);
    api.anchor = "start";
    text(api, api.post.title, api.m, warm ? api.h * 0.72 : api.h * 0.5, api.w * 0.7, api.title * 1.3, fg, 2, 0);
  }
  function conteudo(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "columns" : "column";
    stage(api, api.art.paper);
    text(api, api.post.kicker, api.m, api.h * 0.18, api.w * 0.4, api.kicker, api.art.accent, 1, 2);
    if (warm) {
      text(api, api.post.title, api.m, api.h * 0.36, api.w * 0.4, api.title, api.art.ink, 4, 0);
      text(api, api.post.copy, api.w * 0.52, api.h * 0.36, api.w * 0.38, api.body, api.art.ink, 8, 0);
    } else {
      text(api, api.post.title, api.m, api.h * 0.32, api.w * 0.7, api.title, api.art.ink, 3, 0);
      rule(api, api.m, api.h * 0.52, api.unit * 0.08, api.art.accent);
      text(api, api.post.copy, api.m, api.h * 0.6, api.w * 0.46, api.body, api.art.ink, 5, 0);
    }
  }
  function dados(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "figure" : "quiet";
    stage(api, api.art.paper);
    const match = String(api.post.title || "").match(/^(\d+)/);
    const figure = match ? match[1] : api.post.title;
    text(api, api.post.kicker, warm ? api.w * 0.42 : api.m, api.h * 0.18, api.w * 0.5, api.kicker, api.art.accent, 1, 2);
    text(api, figure, api.m, api.h * 0.48, api.w * 0.32, api.title * 2.1, warm ? api.art.accent : api.art.ink, 1, 0);
    if (!warm) text(api, "pontos", api.m, api.h * 0.62, api.w * 0.3, api.body, api.art.ink, 1, 1);
    items(api.post).forEach((line, index) => {
      const y = api.h * 0.36 + index * api.h * 0.14;
      text(api, line, warm ? api.w * 0.42 : api.w * 0.38, y, warm ? api.w * 0.48 : api.w * 0.5, api.body, api.art.ink, 2, 0);
    });
  }
  function fecho(api) {
    const warm = api.mood === "warm";
    api.structure = warm ? "aside" : "center";
    stage(api, warm ? api.art.ink : api.art.paper);
    const fg = warm ? api.art.paper : api.art.ink;
    if (!warm) api.anchor = "middle";
    const x = warm ? api.m : api.w / 2;
    text(api, api.post.title, x, api.h * 0.46, warm ? api.w * 0.7 : api.w * 0.7, api.title * 1.2, fg, 2, 0);
    api.anchor = warm ? "start" : "middle";
    text(api, api.post.copy, x, api.h * 0.64, warm ? api.w * 0.55 : api.w * 0.5, api.body, fg, 3, 0);
    api.anchor = warm ? "start" : "middle";
    text(api, api.post.cta, x, api.h * 0.8, api.w * 0.4, api.small, api.art.accent, 1, 1.5);
    api.anchor = "start";
  }

  const layouts = { margem, fotografia, coluna, lista, citacao, cartaz, oferta, retrato, bastidor, evento, pergunta, capa, secao, conteudo, dados, fecho };

  function render(post, ctx) {
    const context = ctx || {};
    const w = context.w || 1080;
    const h = context.h || 1350;
    const art = colorsOf(context.palette);
    const mood = post && post.mood === "warm" ? "warm" : "sober";
    const unit = Math.min(w, h);
    const esc = context.escapeHTML || function (value) {
      return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
    };
    const api = {
      w,
      h,
      art,
      mood,
      unit,
      esc,
      post: post || {},
      ctx: context,
      parts: [],
      note: String(context.photoNote || "Luz de verdade, com o lugar em volta.").replace(/\s+/g, " ").trim(),
      clip: context.clip || (post && post.id) || "x",
      m: Math.round(unit * (mood === "warm" ? 0.07 : 0.09)),
      title: Math.round(unit * 0.064),
      body: Math.round(unit * 0.028),
      kicker: Math.round(unit * 0.02),
      small: Math.round(unit * 0.02),
      tall: h / w > 1.35,
      wide: w / h > 1.35,
      structure: "type",
      anchor: "start",
    };
    const draw = layouts[post && post.layout] || margem;
    draw(api);
    const style = context.embedded ? `<style>@font-face{font-family:StudioExport;src:url(data:font/ttf;base64,${context.embedded}) format('truetype');font-weight:400}</style>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" data-layout="${esc(post && post.layout)}" data-mood="${mood}" data-structure="${esc(api.structure)}" aria-label="${esc((post && post.title) || "")}">${style}${api.parts.join("")}</svg>`;
  }

  return { render, colorsOf };
});
