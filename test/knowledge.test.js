const assert = require("assert");
const knowledge = require("../lib/knowledge");
const brain = require("../lib/brain-core");

const list = knowledge.list();
assert.ok(list.length >= 25, "ofícios na base: " + list.length);
for (const id of ["padaria", "clinica", "industria", "boteco", "educacao", "farmacia", "autoral"]) {
  assert.ok(list.some((item) => item.id === id), id);
}

assert.strictEqual(knowledge.moodOf({ segment: "padaria" }), "warm");
assert.strictEqual(knowledge.moodOf({ segment: "boteco de esquina" }), "warm");
assert.strictEqual(knowledge.moodOf({ segment: "clínica médica" }), "sober");
assert.strictEqual(knowledge.moodOf({ segment: "clínica odontológica" }), "sober");
assert.strictEqual(knowledge.match("clínica odontológica", "").id, "odontologia");
assert.strictEqual(knowledge.moodOf({ segment: "indústria metalúrgica" }), "sober");
assert.strictEqual(knowledge.match("barbearia", "").id, "salao");
assert.notStrictEqual(knowledge.match("barbearia", "").id, "boteco");

const vague = knowledge.competitors({ segment: "ateliê de cerâmica" });
assert.deepStrictEqual(vague.competitors, []);
assert.ok(/inventa/i.test(vague.note));

const dental = knowledge.competitors({ segment: "clínica odontológica" });
assert.ok(dental.competitors.length >= 1);
assert.ok(dental.competitors.every((item) => item.url.startsWith("https://")));

const author = knowledge.competitors({ segment: "artista autoral" });
assert.deepStrictEqual(author.competitors, []);

const padaria = knowledge.compose({ name: "Forno do Bairro", segment: "padaria", description: "Pão de fermentação longa.", traits: ["humana", "acessível"], styles: ["organic"] });
const again = knowledge.compose({ name: "Forno do Bairro", segment: "padaria", description: "Pão de fermentação longa.", traits: ["humana", "acessível"], styles: ["organic"], knowledgeVariant: 2 });
assert.notStrictEqual(padaria.keyMessages.join("|"), again.keyMessages.join("|"));
assert.strictEqual(padaria.humor, "leve");
assert.ok(!/saiba mais/i.test(JSON.stringify(padaria)));

const clinic = knowledge.compose({ name: "Lume", segment: "clínica", description: "Consulta com explicação.", traits: ["ousada", "criativa"] });
assert.strictEqual(clinic.humor, "fora");
assert.ok(clinic.tone.dont.some((line) => /humor/i.test(line)));
assert.strictEqual(clinic.nicheId, "clinica");

const industry = brain.buildFallbackBrain({
  name: "Usina Norte",
  segment: "indústria",
  description: "Peças sob desenho.",
  palette: "premium",
  font: "manrope",
  traits: ["técnica"],
});
assert.strictEqual(industry.source, "knowledge");
assert.strictEqual(industry.nicheId, "industria");
assert.deepStrictEqual(
  industry.palette.map((color) => color.hex),
  ["#0d1825", "#b89a5c", "#e7dfd0", "#ffffff"],
);

const banned = /saiba mais|ecossistema|disruptiv|alavancar|potencializar|experiência única/i;
for (const niche of list) {
  const text = knowledge.compose({ name: "Casa", segment: niche.name, traits: ["humana"] });
  const blob = [text.positioning, text.audience, text.tone.summary, text.cta].concat(text.keyMessages, text.tone.do).join("\n");
  assert.ok(!banned.test(blob), niche.id + " " + blob.match(banned));
}

const line = knowledge.phrase({ segment: "padaria", name: "Forno" }, { purpose: "lançamento", max: 80, salt: "cartaz" });
assert.ok(line);
assert.ok(line.length <= 80);
assert.ok(!/saiba mais/i.test(line));
console.log("knowledge ok", list.length);
