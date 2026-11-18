import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderSiteDocument } from "./render.ts";

test("every book page gains a privacy footer and a dismissible visit notice", () => {
  const html = renderSiteDocument("<html><body><p>Hello</p></body></html>", ["/"]);
  assert.match(html, /<footer class="visit-colophon"><a href="privacy">Privacy<\/a><\/footer>/);
  assert.match(
    html,
    /This site logs visits \(page, approximate location, browser\) to its owner\. <a href="privacy">Privacy<\/a>/,
  );
  assert.match(html, /hederica\.visit-notice\.dismissed/);
  assert.match(html, /localStorage\.setItem\(key,"1"\)/);
});

test("the homepage article is unchanged by the notice injection", () => {
  const source = readFileSync("src/site/html/index.html", "utf8");
  assert.match(source, /The nonprofit is not an arbiter/);
  assert.equal(source.includes("visit-notice"), false);
  assert.equal(source.includes("id=\"privacy\""), false);
  const rendered = renderSiteDocument(source, ["/"]);
  assert.match(rendered, /The nonprofit is not an arbiter/);
  assert.match(rendered, /visit-notice/);
});
