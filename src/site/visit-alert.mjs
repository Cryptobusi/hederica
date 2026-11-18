/**
 * Decide whether a request is one human HTML visit worth emailing.
 * Pure and edge-safe: no logging, and the API key never enters these objects.
 */

export const SEEN_COOKIE = "va_seen";
export const SEEN_MAX_AGE = 86400;
export const ALERT_TO = "egonomist@mail.grokbot.com";
export const ALERT_FROM = "Site Visits <onboarding@resend.dev>";

const BOT_UA =
  /bot|crawl|spider|slurp|preview|monitor|headless|curl|wget|python|gptbot|chatgpt|claudebot|anthropic|perplexity|bytespider|ccbot|amazonbot|applebot|facebookexternal|meta-external|google-extended|googleother|cohere|diffbot|omgili|youbot|timpibot|imagesiftbot|ai2bot|webzio|semrush|ahrefs|petalbot|ia_archiver|scrapy|httpclient|go-http|libwww|httpx|lighthouse|pingdom|uptimerobot/i;

const ASSET_EXT =
  /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot|mp4|webm|mp3|json|xml|txt|webmanifest|pdf|wasm)$/i;

/**
 * @param {string} raw
 * @returns {string}
 */
export function maskIp(raw) {
  if (!raw) return "";
  let ip = String(raw).split(",")[0].trim();
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]"));
  const v4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (v4WithPort) ip = v4WithPort[1];
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) ip = mapped[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    if (parts.some((part) => Number(part) > 255)) return "";
    parts[3] = "0";
    return parts.join(".");
  }
  if (ip.includes(":")) {
    const groups = ip.split(":");
    const first = groups.slice(0, 3).map((group) => (group === "" ? "0" : group));
    while (first.length < 3) first.push("0");
    return `${first.join(":")}:*`;
  }
  return "";
}

/**
 * @param {string} ua
 * @returns {string}
 */
export function describeClient(ua) {
  const agent = ua || "";
  let browser = "Unknown browser";
  if (/Edg\//.test(agent)) browser = "Edge";
  else if (/OPR\/|Opera/.test(agent)) browser = "Opera";
  else if (/Firefox\//.test(agent)) browser = "Firefox";
  else if (/Chrome\//.test(agent)) browser = "Chrome";
  else if (/Safari\//.test(agent)) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows/.test(agent)) os = "Windows";
  else if (/Android/.test(agent)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(agent)) os = "iOS";
  else if (/Mac OS X/.test(agent)) os = "macOS";
  else if (/Linux/.test(agent)) os = "Linux";

  let device = "Desktop";
  if (/iPad|Tablet/.test(agent)) device = "Tablet";
  else if (/Mobi|iPhone|Android/.test(agent)) device = "Mobile";

  return `${browser} on ${os} (${device})`;
}

/**
 * @param {Headers} headers
 * @returns {boolean}
 */
export function isBot(headers) {
  const ua = headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua)) return true;
  for (const [name, value] of headers.entries()) {
    const header = name.toLowerCase();
    if (!header.startsWith("x-vercel-") || !header.includes("bot")) continue;
    const flag = value.trim();
    if (!flag) continue;
    if (/^(0|false|no|human)$/i.test(flag)) continue;
    return true;
  }
  return false;
}

/**
 * @param {Headers} headers
 * @returns {boolean}
 */
export function isPrefetch(headers) {
  const purpose = [
    headers.get("purpose"),
    headers.get("sec-purpose"),
    headers.get("x-purpose"),
    headers.get("x-middleware-prefetch"),
    headers.get("next-router-prefetch"),
  ]
    .filter(Boolean)
    .join(" ");
  if (/prefetch/i.test(purpose)) return true;
  if (headers.get("x-middleware-prefetch") === "1") return true;
  if (headers.get("next-router-prefetch") === "1") return true;
  return false;
}

/**
 * @param {string | null} cookieHeader
 * @returns {boolean}
 */
export function hasSeenCookie(cookieHeader) {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => {
    const eq = part.indexOf("=");
    if (eq === -1) return false;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    return name === SEEN_COOKIE && value === "1";
  });
}

/** @returns {string} */
export function seenCookie() {
  return `${SEEN_COOKIE}=1; HttpOnly; Secure; SameSite=Lax; Max-Age=${SEEN_MAX_AGE}; Path=/`;
}

/**
 * @param {string} method
 * @param {URL} url
 * @param {Headers} headers
 * @returns {boolean}
 */
export function isHtmlNavigation(method, url, headers) {
  if (method.toUpperCase() !== "GET") return false;
  const path = url.pathname || "/";
  if (path === "/api" || path.startsWith("/api/")) return false;
  if (ASSET_EXT.test(path)) return false;
  if (isPrefetch(headers)) return false;
  const dest = headers.get("sec-fetch-dest");
  if (dest && dest.toLowerCase() !== "document") return false;
  const accept = (headers.get("accept") ?? "").toLowerCase();
  return accept.includes("text/html");
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
function clip(value, max) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/**
 * @param {Headers} headers
 * @param {string} name
 * @returns {string}
 */
function headerText(headers, name) {
  const raw = headers.get(name);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * @param {string | undefined} env
 * @param {URL} url
 * @returns {boolean}
 */
export function environmentAllowsSend(env, url) {
  if (env === "production") return true;
  return env === "preview" && url.searchParams.get("va_test") === "1";
}

/**
 * @param {Headers} headers
 * @returns {string}
 */
function clientIp(headers) {
  return (
    headers.get("x-real-ip") ||
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-forwarded-for") ||
    ""
  );
}

/**
 * @param {{
 *   method: string;
 *   url: URL;
 *   headers: Headers;
 *   env: string | undefined;
 *   hasApiKey: boolean;
 *   now?: Date;
 * }} input
 * @returns {{ send: false } | { send: true; email: { subject: string; text: string; html: string } }}
 */
export function decideVisit(input) {
  const { method, url, headers, env, hasApiKey } = input;
  if (!isHtmlNavigation(method, url, headers)) return { send: false };
  if (isBot(headers)) return { send: false };
  if (hasSeenCookie(headers.get("cookie"))) return { send: false };
  if (!environmentAllowsSend(env, url)) return { send: false };
  if (!hasApiKey) return { send: false };

  const now = input.now ?? new Date();
  const path = url.pathname || "/";
  const query = url.search || "";
  const site = headers.get("x-forwarded-host") || headers.get("host") || url.host || "hederica.com";
  const referrer = headers.get("referer") || "";
  const language = headers.get("accept-language") || "";
  const userAgent = headers.get("user-agent") || "";
  const country = headerText(headers, "x-vercel-ip-country");
  const region = headerText(headers, "x-vercel-ip-country-region");
  const city = headerText(headers, "x-vercel-ip-city");
  const where = [city, region, country].filter(Boolean).join(", ") || "unavailable";
  const masked = maskIp(clientIp(headers)) || "unavailable";
  const ny = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(now);
  const utc = now.toISOString();
  const rows = [
    ["Site", clip(site, 200)],
    ["Time (New York)", ny],
    ["Time (UTC)", utc],
    ["Path", clip(path, 300)],
    ["Query", clip(query || "(none)", 500)],
    ["Referrer", clip(referrer || "(none)", 500)],
    ["Approximate location", clip(where, 200)],
    ["Masked IP", masked],
    ["Browser / device", describeClient(userAgent)],
    ["User-Agent", clip(userAgent || "(none)", 400)],
    ["Language", clip(language || "(none)", 200)],
    ["Environment", env || "unknown"],
  ];
  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.5;color:#1c1915"><p style="margin:0 0 12px">A page on hederica.com was opened.</p><table style="border-collapse:collapse">${rows
    .map(
      ([label, value]) =>
        `<tr><th style="text-align:left;vertical-align:top;padding:4px 12px 4px 0;color:#6b5a32">${escapeHtml(label)}</th><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table></div>`;

  return {
    send: true,
    email: {
      subject: `[hederica.com] Visit: ${clip(path, 180)}`,
      text,
      html,
    },
  };
}

/**
 * @param {string | undefined} apiKey
 * @param {{ subject: string; text: string; html: string }} email
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string | null>}
 */
export async function sendVisitEmail(apiKey, email, fetchImpl = fetch) {
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: [ALERT_TO],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const id = data && typeof data.id === "string" ? data.id : "";
    return /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
