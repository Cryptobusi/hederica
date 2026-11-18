import assert from "node:assert/strict";
import test from "node:test";
import {
  decideVisit,
  describeClient,
  hasSeenCookie,
  isBot,
  maskIp,
  seenCookie,
  sendVisitEmail,
} from "../src/site/visit-alert.mjs";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function headers(extra = {}) {
  return new Headers({
    accept: "text/html,application/xhtml+xml",
    "user-agent": CHROME,
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    ...extra,
  });
}

function decide(overrides = {}) {
  const url = overrides.url ?? new URL("https://hederica.com/study");
  return decideVisit({
    method: overrides.method ?? "GET",
    url,
    headers: overrides.headers ?? headers(),
    env: overrides.env ?? "production",
    hasApiKey: overrides.hasApiKey ?? true,
    now: new Date("2026-11-18T18:00:00.000Z"),
  });
}

test("masks an IPv4 address by zeroing the last octet", () => {
  assert.equal(maskIp("203.0.113.44"), "203.0.113.0");
  assert.equal(maskIp("203.0.113.44, 10.0.0.8"), "203.0.113.0");
  assert.equal(maskIp("::ffff:198.51.100.22"), "198.51.100.0");
});

test("keeps the first three IPv6 groups", () => {
  assert.equal(maskIp("2001:db8:85a3:0000:0000:8a2e:0370:7334"), "2001:db8:85a3:*");
  assert.equal(maskIp("2001:db8::1"), "2001:db8:0:*");
});

test("names a browser and device without treating a normal browser as a bot", () => {
  assert.equal(describeClient(CHROME), "Chrome on Windows (Desktop)");
  assert.equal(isBot(headers()), false);
  assert.equal(
    describeClient(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    "Safari on iOS (Mobile)",
  );
});

test("skips bots, crawlers, and Vercel bot headers", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "curl/8.4.0",
    "python-requests/2.31",
    "Mozilla/5.0 HeadlessChrome/131.0.0.0",
    "GPTBot/1.0",
    "ClaudeBot/1.0",
    "meta-externalagent/1.1",
    "Wget/1.21",
  ]) {
    assert.equal(isBot(headers({ "user-agent": ua })), true, ua);
    assert.equal(decide({ headers: headers({ "user-agent": ua }) }).send, false, ua);
  }
  const flagged = headers({ "x-vercel-verified-bot": "1" });
  assert.equal(isBot(flagged), true);
  assert.equal(isBot(headers({ "x-vercel-verified-bot": "0" })), false);
});

test("sends one production HTML navigation and skips the rest", () => {
  const sent = decide();
  assert.equal(sent.send, true);
  if (!sent.send) return;
  assert.equal(sent.email.subject, "[hederica.com] Visit: /study");
  assert.match(sent.email.text, /Time \(New York\)/);
  assert.match(sent.email.text, /Time \(UTC\): 2026-11-18T18:00:00.000Z/);
  assert.match(sent.email.text, /Environment: production/);
  assert.match(sent.email.html, /A page on hederica.com was opened/);

  assert.equal(decide({ method: "HEAD" }).send, false);
  assert.equal(decide({ method: "POST" }).send, false);
  assert.equal(decide({ url: new URL("https://hederica.com/api/auth") }).send, false);
  assert.equal(decide({ url: new URL("https://hederica.com/icons/icon-192.png") }).send, false);
  assert.equal(decide({ headers: headers({ accept: "image/avif" }) }).send, false);
  assert.equal(decide({ headers: headers({ purpose: "prefetch" }) }).send, false);
  assert.equal(decide({ headers: headers({ "sec-fetch-dest": "empty" }) }).send, false);
  assert.equal(decide({ headers: headers({ cookie: "va_seen=1" }) }).send, false);
  assert.equal(decide({ headers: headers({ cookie: "theme=dark; va_seen=1" }) }).send, false);
  assert.equal(decide({ env: "preview" }).send, false);
  assert.equal(decide({ env: "preview", url: new URL("https://hederica.com/study?va_test=1") }).send, true);
  assert.equal(decide({ env: "development" }).send, false);
  assert.equal(decide({ hasApiKey: false }).send, false);
});

test("the mailed note keeps a masked address and drops the raw one", () => {
  const sent = decide({
    headers: headers({
      "x-real-ip": "198.51.100.77",
      "x-vercel-ip-city": "New%20York",
      "x-vercel-ip-country-region": "NY",
      "x-vercel-ip-country": "US",
      referer: "https://example.com/from",
      "accept-language": "en-US,en;q=0.8",
    }),
    url: new URL("https://hederica.com/privacy?ref=desk"),
  });
  assert.equal(sent.send, true);
  if (!sent.send) return;
  assert.match(sent.email.text, /Masked IP: 198\.51\.100\.0/);
  assert.equal(sent.email.text.includes("198.51.100.77"), false);
  assert.match(sent.email.text, /Approximate location: New York, NY, US/);
  assert.match(sent.email.text, /Query: \?ref=desk/);
  assert.match(sent.email.text, /Referrer: https:\/\/example\.com\/from/);
  assert.match(sent.email.text, /Language: en-US/);
  assert.equal(sent.email.text.includes("re_secret"), false);
  assert.equal(JSON.stringify(sent.email).includes("RESEND_API_KEY"), false);
});

test("escapes markup that arrives in a header", () => {
  const sent = decide({
    headers: headers({ referer: "https://example.com/?q=<script>" }),
  });
  assert.equal(sent.send, true);
  if (!sent.send) return;
  assert.match(sent.email.html, /&lt;script&gt;/);
  assert.equal(sent.email.html.includes("<script>"), false);
});

test("the seen cookie is first-party and lasts a day", () => {
  assert.equal(hasSeenCookie(null), false);
  assert.equal(hasSeenCookie("va_seen=1"), true);
  assert.equal(hasSeenCookie("va_seen=0"), false);
  assert.equal(hasSeenCookie("not_va_seen=1"), false);
  assert.match(seenCookie(), /va_seen=1/);
  assert.match(seenCookie(), /HttpOnly/);
  assert.match(seenCookie(), /Secure/);
  assert.match(seenCookie(), /SameSite=Lax/);
  assert.match(seenCookie(), /Max-Age=86400/);
  assert.match(seenCookie(), /Path=\//);
});

test("sendVisitEmail posts to Resend and returns only the id", async () => {
  let called = null;
  const id = await sendVisitEmail(
    "test-key-should-not-leak",
    { subject: "[hederica.com] Visit: /", text: "Site: hederica.com", html: "<p>Site</p>" },
    async (url, init) => {
      called = { url, init };
      return new Response(JSON.stringify({ id: "abc123" }), { status: 200 });
    },
  );
  assert.equal(id, "abc123");
  assert.equal(called.url, "https://api.resend.com/emails");
  const body = JSON.parse(called.init.body);
  assert.equal(body.from, "Site Visits <onboarding@resend.dev>");
  assert.deepEqual(body.to, ["egonomist@mail.grokbot.com"]);
  assert.equal(called.init.headers.Authorization, "Bearer test-key-should-not-leak");
  assert.equal(body.text.includes("test-key-should-not-leak"), false);
  assert.equal(await sendVisitEmail("", { subject: "x", text: "y", html: "z" }, async () => {
    throw new Error("should not be called");
  }), null);
});

test("a failed or slow send is swallowed", async () => {
  assert.equal(
    await sendVisitEmail("k", { subject: "s", text: "t", html: "h" }, async () => new Response("no", { status: 500 })),
    null,
  );
  assert.equal(
    await sendVisitEmail("k", { subject: "s", text: "t", html: "h" }, async () => {
      throw new Error("network");
    }),
    null,
  );
});
