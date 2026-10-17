const assert = require("assert");
const brain = require("../lib/brain-core");

function sample() {
  return {
    name: "Lume",
    site: "https://lume.example",
    segment: "clínica odontológica",
    description: "Cuida do sorriso de quem tem medo de dentista.",
    competitors: ["Sorridents"],
    references: ["Aesop"],
    traits: ["humana", "calma"],
    avoid: ["infantil", "fria"],
    styles: ["organic"],
    font: "playfair",
    palette: "warm",
    logo: "wordmark",
    axes: [20, 30, 80, 40, 70],
    axesTouched: true,
    confirmedVisual: true,
    touchedFont: true,
    touchedPalette: true,
    touchedLogo: true,
  };
}

const emptyScore = brain.completeness({});
assert.strictEqual(emptyScore.percent, 0);
assert.strictEqual(emptyScore.done, 0);
assert.strictEqual(emptyScore.total, 12);

const full = brain.completeness(sample());
assert.strictEqual(full.percent, 100, "todos os campos respondidos");

const partial = brain.completeness({ name: "Lume", traits: ["humana"] });
assert.strictEqual(partial.done, 2);
assert.notStrictEqual(partial.percent, 92);

const result = brain.buildFallbackBrain(sample());
assert.strictEqual(result.source, "knowledge");
assert.ok(result.positioning.includes("Lume"));
assert.ok(result.positioning.toLowerCase().includes("sorriso"));
assert.ok(result.reading.includes("Sorridents"));
assert.ok(result.reading.includes("Aesop"));
assert.ok(result.reading.includes("humana"));
assert.ok(result.reading.includes("calma"));
assert.ok(result.reading.includes("infantil"));
assert.ok(result.reading.includes("Playfair"));
assert.ok(result.reading.includes("Wordmark"));
assert.ok(result.reading.toLowerCase().includes("orgânica"));
assert.ok(result.reading.includes("Eixos"));
assert.ok(!brain.buildFallbackBrain({ name: "Lume", axes: [62, 38, 54, 58, 72] }).reading.includes("Eixos"));
assert.deepStrictEqual(
  result.palette.map((color) => color.hex),
  ["#201b17", "#c37053", "#e8c79f", "#f7efe6"],
);
assert.ok(result.palette.every((color) => color.role && color.usage));
assert.ok(result.tone.do.length >= 2 && result.tone.dont.length >= 2);
assert.ok(result.keyMessages.length >= 3);
assert.ok(result.typography.hierarchy.length >= 3);
assert.ok(result.photography.direction.includes("Aesop") || result.photography.direction.length > 20);
assert.ok(result.composition.do.length >= 3 && result.composition.dont.length >= 3);
assert.strictEqual(result.logo.type, "wordmark");
assert.ok(result.cta.length > 0 && result.cta.length <= 42);

const untouched = brain.applyAccentEdit(sample(), "#c37053");
assert.strictEqual(untouched.changed, false);
assert.strictEqual(untouched.palette, "warm");
assert.ok(!untouched.colors.includes("#f8f7f4"));
assert.ok(!untouched.colors.includes("#0b0f1a"));

const edited = brain.applyAccentEdit(sample(), "#123456");
assert.strictEqual(edited.changed, true);
assert.deepStrictEqual(edited.colors, ["#201b17", "#123456", "#e8c79f", "#f7efe6"]);
assert.strictEqual(edited.palette, "custom");

const sanitized = brain.sanitizeBrain(
  {
    positioning: "Posição do modelo.",
    palette: [
      { hex: "#ffffff", role: "Papel inventado" },
      { hex: "#000000", role: "Outro" },
      { hex: "#ff00ff", role: "Mais um" },
      { hex: "#123456", role: "Último" },
    ],
    typography: { display: "Comic Sans", hierarchy: ["Título curto."] },
    logo: { type: "mono", usage: "Usar o nome por extenso." },
    tone: { summary: "Calma.", do: ["Olá."], dont: ["Disruptivo."] },
    keyMessages: ["Mensagem do modelo."],
  },
  sample(),
  "gpt-4o-mini",
);
assert.deepStrictEqual(
  sanitized.palette.map((color) => color.hex),
  ["#201b17", "#c37053", "#e8c79f", "#f7efe6"],
);
assert.strictEqual(sanitized.palette[0].role, "Papel inventado");
assert.strictEqual(sanitized.typography.display, "Playfair Display");
assert.notStrictEqual(sanitized.typography.display, "Comic Sans");
assert.strictEqual(sanitized.logo.type, "wordmark");
assert.strictEqual(sanitized.source, "llm");
assert.strictEqual(sanitized.model, "gpt-4o-mini");

const noSegment = brain.competitorFallback({ name: "Lume" });
assert.deepStrictEqual(noSegment.competitors, []);
assert.ok(/segmento/i.test(noSegment.note));

const dental = brain.competitorFallback({ segment: "clínica odontológica" });
assert.ok(dental.competitors.length >= 1);
assert.ok(dental.competitors.every((item) => item.url.startsWith("https://")));
assert.ok(/confirmar/i.test(dental.note));

const vague = brain.competitorFallback({ segment: "ateliê de cerâmica" });
assert.deepStrictEqual(vague.competitors, []);

const cleaned = brain.sanitizeCompetitors({
  note: "Confira.",
  competitors: [
    { name: "Real", url: "https://exemplo.com", why: "Disputa o mesmo cliente." },
    { name: "Ruim", url: "javascript:alert(1)", why: "não" },
    { name: "", url: "https://vazia.com", why: "sem nome" },
  ],
});
assert.strictEqual(cleaned.competitors.length, 2);
assert.strictEqual(cleaned.competitors[1].url, "");

const openings = new Set();
for (let variant = 0; variant < 6; variant++) {
  const rivals = brain.competitorFallback({ segment: "educação online", name: "Curso Norte", competitorVariant: variant });
  assert.ok(rivals.competitors.some((item) => item.name === "Alura"), "Alura na variante " + variant);
  assert.ok(rivals.competitors.every((item) => item.url.startsWith("https://")));
  openings.add(rivals.competitors[0].name);
}
assert.ok(openings.size > 1, "mostrar outras muda a ordem");
console.log("brain-core ok");
