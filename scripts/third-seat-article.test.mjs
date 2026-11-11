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

const INTERIM =
  "lgme is open source. Until the member-governance threshold is met (a majority of members, as the charter will define), the original developer is the sole decider on changes, in service of the Egonomic mission. This is a temporary rule and ends when that threshold is reached.";

test("charter interim governance sits outside the Third Seat article", () => {
  const html = readFileSync("src/site/html/charter.html", "utf8");
  const start = html.indexOf('<section id="third-seat"');
  const end = html.indexOf("</section>", start);
  const article = html.slice(start, end);
  assert.equal(article.includes("Interim governance"), false);
  assert.equal(article.includes("original developer"), false);
  assert.ok(html.includes("<h2>Interim governance (lgme)</h2>"));
  assert.ok(html.includes(INTERIM));
  assert.equal(html.includes("$Trust") || html.includes("$TRUST"), false);
});
