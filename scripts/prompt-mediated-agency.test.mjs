import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/site/html/prompt-mediated-agency.html", "utf8");
const index = readFileSync("src/site/html/index.html", "utf8");
const study = readFileSync("src/site/html/study.html", "utf8");

const PASSAGES = [
  "DOCTORAL DISSERTATION DRAFT • HUMAN-COMPUTER INTERACTION",
  "Prompt-Mediated Agency: Individual Sovereignty and Self-Actualization in Generative Interfaces",
  "A Mixed-Methods Investigation of Cognitive Offloading, Metacognitive Scaffolding, and Provenance-Bound Interaction",
  "individual sovereignty—defined here as epistemic and decisional autonomy—and self-actualization",
  "an effort–time dissociation and a speedup illusion",
  "shift a user’s judgments and priorities toward model tendencies",
  "Collapsed Provenance:",
  "Self-Determination Theory (SDT)",
  "Sovereign Prompting Interface:",
  "4. Provenance-Bound",
  "RQ1 (Metacognition and Transfer):",
  "RQ2 (Epistemic Vigilance):",
  "RQ3 (Autonomy and Longitudinal Authorship):",
  "conditions—Delegative Baseline, Socratic Scaffold, and Provenance-Bound Workspace—followed",
  "NASA-TLX) Hart and Staveland (1988)",
  "Lukošiūtė, K., et al. (2022)",
  "International Conference on Learning Representations (ICLR).",
];

test("the dissertation page reproduces the draft and offers the PDF", () => {
  assert.match(page, /Doctoral dissertation draft/);
  for (const passage of PASSAGES) assert.ok(page.includes(passage), passage);
  assert.match(page, /href="\/docs\/Prompt_Mediated_Agency\.pdf"/);
  assert.equal(page.includes("$Trust") || page.includes("$TRUST"), false);
  assert.equal(/<img\b/i.test(page), false);
  assert.equal(/<figure\b/i.test(page), false);
});

test("the PDF is the four-page source file", () => {
  const pdf = readFileSync("public/docs/Prompt_Mediated_Agency.pdf");
  assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.ok(pdf.length > 1000);
});

test("study and the desk link the dissertation", () => {
  assert.match(index, /href="\/prompt-mediated-agency"/);
  assert.match(index, /href="\/docs\/Prompt_Mediated_Agency\.pdf"/);
  assert.match(study, /href="\/prompt-mediated-agency"/);
  assert.match(study, /Doctoral dissertation draft/);
  assert.equal(index.includes("$Trust") || study.includes("$Trust"), false);
});
