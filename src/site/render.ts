/** Map a request path to a single HTML file in src/site/html. */
export function resolvePageFile(pathname: string): string | null {
  let path = pathname || "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (path.includes("\0") || path.includes("\\")) return null;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/" || path === "") return "index.html";
  if (!path.startsWith("/")) return null;
  const rest = path.slice(1);
  if (rest.includes("/") || rest.includes("..")) return null;
  if (rest.endsWith(".html")) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(rest)) return null;
    return rest;
  }
  if (rest.includes(".")) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(rest)) return null;
  return `${rest}.html`;
}

export function routesFromFiles(files: readonly string[]): string[] {
  return files
    .filter((name) => name.endsWith(".html"))
    .map((name) => (name === "index.html" ? "/" : `/${name.slice(0, -".html".length)}`))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Root-absolute links (`/study`) break path-prefixed previews. Make them
 * relative so they resolve against the current page directory.
 */
export function relativizeHtml(html: string): string {
  const attrs = html.replace(
    /(<[^>]*?\s)(href|src|poster|action)(\s*=\s*)(["'])\/(?!\/)([^"']*)\4/gi,
    (_match, before: string, attr: string, eq: string, quote: string, path: string) => {
      const rel =
        path === "" || path.startsWith("#") || path.startsWith("?") ? `./${path}` : path;
      return `${before}${attr}${eq}${quote}${rel}${quote}`;
    },
  );
  return attrs.replace(
    /register\(\s*(["'])\/sw\.js\1/g,
    (_match, quote: string) => `register(${quote}sw.js${quote})`,
  );
}

export function renderSiteDocument(html: string, routes: readonly string[]): string {
  const body = relativizeHtml(html);
  const boot =
    `<script>window.__LGME_ROUTES=${JSON.stringify(routes)};</script>` +
    `<script src="lgme-preview-bridge.js" defer></script>`;
  const closer = body.lastIndexOf("</body>");
  if (closer === -1) return body + boot;
  return `${body.slice(0, closer)}${boot}${body.slice(closer)}`;
}
