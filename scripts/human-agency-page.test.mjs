import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/site/html/human-agency.html", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/site/html/index.html", import.meta.url), "utf8");
const hederica = readFileSync(new URL("../src/site/html/hederica.html", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");

test("human agency essay keeps the source sections and the comparison table", () => {
  for (const heading of [
    "AI + DLT for Human Agency",
    "When the two layers are aimed at agency",
    "Core mechanics",
    "A reading for the Hederica cooperative aim",
    "1. The core economic thesis",
    "2. The constitutional principles",
    "3. Strengths and real-world friction",
    "Value accounting",
    "Agent role",
    "Safety floor",
    "Market clearing",
    "Floor seniority",
    "The public tape",
    "The third seat",
  ]) {
    assert.match(page, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /Legacy Web2 \/ centralized model/);
  assert.match(page, /Proposed AI \+ DLT architecture/);
});

test("human agency essay stays a proposal and drops unsupported claims", () => {
  for (const phrase of [
    "design research",
    "not a live protocol",
    "No membership is offered or admitted",
    "not legal fiduciaries",
    "Not a legal fiduciary",
    "does not prove",
    "named surplus",
    "no funded guarantee",
    "testnet",
    "HBAR",
    "published schedule",
    "does not erase a legal obligation",
    "does not bind a person who never joined",
    "not an exchange this site runs",
    "does not claim near-zero overhead",
    "not an ungameable account of reality",
    "research directions",
  ]) {
    assert.match(page, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const banned of [
    "$0.0001",
    "$0.0008",
    "$TRUST",
    "$Trust",
    "ClubHbar",
    "ClubHBAR",
    "ungameable reality",
    "10-30",
    "10–30",
    "Add to all 3 sites",
    "Fiduciary personal agents",
    "Ultimate Architecture",
  ]) {
    assert.equal(page.includes(banned), false, `unexpected phrase: ${banned}`);
  }
});

test("homepage summary and nav link the essay without replacing the Hederica section", () => {
  assert.match(home, /id="human-agency"/);
  assert.match(home, /href="\/human-agency"/);
  assert.match(home, /Read AI \+ DLT for Human Agency/);
  assert.match(home, /not a live market, not a membership, and not a funded guarantee/);
  assert.match(home, /A public book for work the banks never counted/);
  assert.match(hederica, /href="\/human-agency"/);
  assert.match(sitemap, /https:\/\/hederica\.com\/human-agency/);
});
