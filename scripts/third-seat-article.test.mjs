import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const SHORT =
  "The Third Seat is your seat, held by you alone, with equal standing beside the state and the firm. You may decline any exchange at no cost, no unpublished rule can bind you, and any hold on your exchange must give a reason and can be challenged, decided within 7 days or it lapses. Holds the law requires are cited, recorded, and kept no broader or longer than the law demands.";

const DEFINITION =
  "The Third Seat is the seat each member holds as an individual, beside the state and the firm, under one published set of rules. It is personal and cannot be delegated, sold, or held by any organization, including the nonprofit.";

const SOVEREIGNTY =
  "Sovereignty simply means final and absolute authority. Therefore, those who have it are not subject to any outside authority on Earth.";

const pages = [
  "src/site/html/index.html",
  "src/site/html/charter.html",
  "src/site/html/bylaws.html",
  "src/site/html/membership.html",
  "src/site/html/the-third-seat.html",
];

for (const file of pages) {
  test(`${file} carries the Third Seat article`, () => {
    const html = readFileSync(file, "utf8");
    assert.match(html, /<section id="third-seat"/);
    assert.match(html, /The nonprofit is not an arbiter/);
    assert.ok(html.includes(DEFINITION));
    assert.ok(html.includes(SHORT));
    assert.ok(html.includes("does not decide anyone's legal rights"));
    assert.equal(html.includes("$Trust") || html.includes("$TRUST"), false);
    assert.equal(html.includes("equal footing with institutions"), false);
  });
}

test("desk glossary uses the short form", () => {
  const html = readFileSync("src/site/html/index.html", "utf8");
  const glossary = html.slice(html.indexOf('id="glossary"'), html.indexOf('id="third-seat"'));
  assert.ok(glossary.includes(SHORT));
});

test("the Jefferson sovereignty sentence is unchanged", () => {
  assert.ok(readFileSync("src/site/html/index.html", "utf8").includes(SOVEREIGNTY));
  assert.ok(readFileSync("public/docs/Sovereignty_Jefferson.md", "utf8").includes(SOVEREIGNTY));
});

test("the American Dream section cites the 1980 cohort and the Chetty papers", () => {
  const html = readFileSync("src/site/html/index.html", "utf8");
  const start = html.indexOf('id="american-dream"');
  const end = html.indexOf('id="sovereignty"');
  assert.ok(start > 0 && end > start);
  const section = html.slice(start, end);
  assert.match(section, /born in 1980/);
  assert.equal(section.includes("1990"), false);
  assert.ok(section.includes("https://opportunityinsights.org/paper/the-fading-american-dream/"));
  assert.ok(section.includes("https://www.nature.com/articles/s41586-022-04996-4"));
  assert.ok(section.includes("https://lgme.app/chetty-review"));
  assert.ok(section.includes("a small amount of Creo, value you create,"));
  assert.ok(section.includes("Deeds earn Creo, not coins."));
  const dreamEnd = html.indexOf("</section>", start);
  const dream = html.slice(start, dreamEnd);
  assert.equal(/credit/i.test(dream), false);
  assert.ok(html.includes("The message is the credit."));
  assert.equal(section.includes("$Trust") || section.includes("$TRUST") || section.includes("$LGME"), false);
  assert.ok(html.includes(SOVEREIGNTY));
});
