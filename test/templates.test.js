const assert = require("assert");
const templates = require("../lib/templates");
const render = require("../templates-render");

function brainFor(name) {
  return {
    positioning: name + " recebe com clareza e sem pressa.",
    audience: "Quem chega pela primeira vez.",
    tone: { summary: "Calma e direta.", do: ["A gente explica antes de oferecer."], dont: ["Somos a melhor do mercado."] },
    keyMessages: [
      "O cuidado aparece no detalhe.",
      "Uma ideia por conversa.",
      "Presença reconhecível, sem exagero.",
    ],
    cta: "Falar com a gente",
    photography: { direction: "Luz de janela, gente de verdade e o lugar em volta." },
  };
}

function ctx(extra) {
  return Object.assign({
    name: "Casa",
    segment: "padaria",
    description: "Pão de fermentação longa.",
    traits: ["humana"],
    styles: ["organic"],
    brief: { theme: "Pão de fermentação", audience: "Quem mora no bairro", goal: "Apresentar produto", message: "Massa de longo descanso, vendida no balcão ainda quente.", tone: "Próxima" },
    brain: brainFor("A casa"),
  }, extra || {});
}

assert.strictEqual(templates.moodOf({ segment: "padaria" }), "warm");
assert.strictEqual(templates.moodOf({ segment: "boteco brasileiro", traits: ["ousada"] }), "warm");
assert.strictEqual(templates.moodOf({ segment: "clínica odontológica", traits: ["humana"], styles: ["organic"] }), "sober");
assert.strictEqual(templates.moodOf({ segment: "indústria metalúrgica" }), "sober");
assert.strictEqual(templates.moodOf({ segment: "software de gestão", styles: ["tech"] }), "sober");
assert.strictEqual(templates.moodOf({ traits: ["ousada"] }), "warm");
assert.strictEqual(templates.moodOf({}), "sober");
assert.strictEqual(templates.moodOf({ segment: "barbearia" }), "warm");

assert.strictEqual(templates.fit("Padaria do centro da cidade", 16), "Padaria");
assert.strictEqual(templates.fit("Uma marca humana", 40), "Uma marca humana");
assert.strictEqual(templates.fit("fermentação natural", 6), "fermentação");
assert.ok(!templates.fit("Texto longo demais para o título desta peça", 24).includes("…"));
assert.ok(!templates.fit("Texto longo demais para o título desta peça", 24).includes("..."));

const clipped = templates.fit("Texto longo demais para o título desta peça", 24);
assert.ok("Texto longo demais para o título desta peça".startsWith(clipped));
assert.ok(!clipped.endsWith("para") && !clipped.endsWith("de"));

assert.strictEqual(templates.safeCta("Saiba mais sobre a clínica", 40), "");
assert.strictEqual(templates.safeCta("Falar com a gente", 28), "Falar com a gente");

const warmPlan = templates.planCampaign(ctx());
const soberPlan = templates.planCampaign(ctx({ segment: "clínica", traits: ["técnica"], styles: ["minimal"] }));
assert.deepStrictEqual(warmPlan.map((item) => item.template), ["cartaz", "lista", "bastidor", "oferta"]);
assert.deepStrictEqual(soberPlan.map((item) => item.template), ["margem", "pergunta", "fotografia", "coluna"]);
assert.ok(new Set(warmPlan.map((item) => item.format)).size >= 3);
assert.ok(new Set(soberPlan.map((item) => item.format)).size >= 3);
assert.notDeepStrictEqual(warmPlan.map((item) => item.template), soberPlan.map((item) => item.template));

const deck = templates.planDeck();
assert.deepStrictEqual(deck.map((item) => item.template), ["capa", "secao", "conteudo", "dados", "fecho"]);
assert.ok(deck.every((item) => item.format === "deck"));

function paint(plan, source) {
  return plan.map((spec) => templates.previewPost(spec.template, source, spec.format, { kicker: spec.kicker }));
}
for (const post of paint(warmPlan, ctx()).concat(paint(soberPlan, ctx({ name: "Lume", segment: "clínica", traits: ["técnica"], styles: ["minimal"], brain: brainFor("Lume") })), paint(deck, ctx({ name: "Lume", segment: "clínica" })))) {
  const template = templates.get(post.template);
  assert.ok(post.title, post.template);
  assert.ok(!post.title.includes("…"), post.title);
  assert.ok(!/saiba mais/i.test(post.title + " " + post.copy + " " + post.cta), post.template);
  assert.ok(!templates.badClaim(post.title + " " + post.copy), post.template + " " + post.copy);
  if (post.title.split(" ").length > 1) assert.ok(post.title.length <= template.limits.title, post.template + " " + post.title);
}
const bakery = paint(warmPlan, ctx());
assert.strictEqual(bakery.find((item) => item.template === "evento"), undefined);
const eventPost = templates.previewPost("evento", ctx(), "post");
assert.ok(eventPost.copy.includes("quando você confirmar"));
assert.strictEqual(templates.previewPost("retrato", ctx({ name: "Padaria do Centro" }), "post").copy, "Padaria do Centro");
assert.strictEqual(templates.previewPost("citacao", ctx({ name: "Padaria do Centro" }), "square").copy, "Padaria do Centro");
const data = templates.previewPost("dados", ctx(), "deck");
assert.match(data.title, /^\d+ pontos?$/);
assert.ok(!data.copy.includes("%"));

const kept = templates.applyCopy(
  [{ id: "1", template: "oferta", title: "Pão de fermentação", copy: "Massa de longo descanso.", cta: "Conhecer", kicker: "Um convite", limits: templates.get("oferta").limits }],
  [{ id: "1", title: "50% off no pão", body: "Desconto de R$ 10", cta: "Saiba mais", kicker: "Promo" }],
  "llm",
);
assert.strictEqual(kept[0].title, "Pão de fermentação");
assert.strictEqual(kept[0].cta, "Conhecer");
assert.notStrictEqual(kept[0].copySource, "llm");

const replaced = templates.applyCopy(
  [{ id: "2", template: "cartaz", title: "Antigo", copy: "Antigo demais.", cta: "Seguir", kicker: "Lançamento", copySource: "fallback" }],
  [{ id: "2", title: "Forno novo", body: "A massa descansa dois dias.", cta: "Conhecer", kicker: "Lançamento" }],
  "llm",
);
assert.strictEqual(replaced[0].title, "Forno novo");
assert.strictEqual(replaced[0].copySource, "llm");
assert.strictEqual(templates.applyCopy([{ id: "3", template: "cartaz", title: "Meu título", copy: "Meu texto", cta: "Seguir", copySource: "user" }], [{ id: "3", title: "Outro", body: "Outro", cta: "Outro" }], "llm")[0].title, "Meu título");

function svg(post, palette) {
  return render.render(post, {
    w: post.format === "deck" ? 1920 : 1080,
    h: post.format === "story" ? 1920 : post.format === "square" ? 1080 : post.format === "deck" ? 1080 : 1350,
    fontName: "Manrope",
    palette,
    name: post.copy === "Padaria do Centro" ? "Padaria do Centro" : "Lume",
    photoNote: "Luz de janela e o lugar em volta.",
  });
}
const warmPhoto = templates.previewPost("fotografia", ctx(), "post");
const soberPhoto = templates.previewPost("fotografia", ctx({ segment: "clínica", traits: ["técnica"], styles: ["minimal"] }), "post");
const warmSvg = svg(warmPhoto, ["#201b17", "#c37053", "#e8c79f", "#f7efe6"]);
const soberSvg = svg(soberPhoto, ["#0d1825", "#b89a5c", "#e7dfd0", "#ffffff"]);
assert.ok(warmSvg.includes('data-mood="warm"'));
assert.ok(soberSvg.includes('data-mood="sober"'));
assert.ok(warmSvg.includes('data-structure="bleed"'));
assert.ok(soberSvg.includes('data-structure="mat"'));
assert.notStrictEqual(warmSvg, soberSvg);
assert.ok(warmSvg.includes("sua fotografia"));
assert.ok(!warmSvg.includes("Adicionar sua imagem"));
assert.ok(!warmSvg.includes("Saiba mais"));
const warmColumn = svg(templates.previewPost("coluna", ctx(), "post"), ["#201b17", "#c37053", "#e8c79f", "#f7efe6"]);
const soberColumn = svg(templates.previewPost("coluna", ctx({ segment: "clínica", traits: ["técnica"] }), "post"), ["#0d1825", "#b89a5c", "#e7dfd0", "#ffffff"]);
assert.ok(warmColumn.includes('data-structure="stack"'));
assert.ok(soberColumn.includes('data-structure="panel"'));
const withImage = Object.assign({}, warmPhoto, { image: "data:image/png;base64,aaaa" });
assert.ok(svg(withImage, ["#201b17", "#c37053", "#e8c79f", "#f7efe6"]).includes("<image "));
assert.ok(!svg(withImage, ["#201b17", "#c37053", "#e8c79f", "#f7efe6"]).includes("sua fotografia"));

assert.strictEqual(templates.previewPost("margem", ctx(), "post").copySource, "knowledge");
const turned = templates.previewPost("cartaz", Object.assign(ctx(), { variant: 3 }), "post");
assert.ok(turned.title);
assert.ok(!/saiba mais/i.test(turned.title + " " + turned.copy + " " + turned.cta));
console.log("templates ok");
