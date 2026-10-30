/**
 * Serves the mirrored lgme.app pages (clean URLs) on the production build.
 * Dev uses the matching Vite middleware so edits to src/site/html show on refresh.
 */
import { pages } from "virtual:lgme-pages";
import { renderSiteDocument, resolvePageFile, routesFromFiles } from "../../src/site/render";

interface LgmeSiteEvent {
  url: URL;
  req: { method: string };
}

export default function lgmeSiteMiddleware(
  event: LgmeSiteEvent,
  next: () => unknown,
): unknown {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();

  const file = resolvePageFile(event.url.pathname);
  if (!file) return next();
  const raw = pages[file];
  if (typeof raw !== "string") return next();

  const html = renderSiteDocument(raw, routesFromFiles(Object.keys(pages)));
  return new Response(method === "HEAD" ? null : html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
