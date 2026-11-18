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
    /register\(\s*(["'])\/sw\.js\1\s*\)/g,
    (_match, quote: string) => `register(${quote}sw.js${quote})`,
  );
}

/** Footer link and first-visit notice. Injected so article HTML stays unchanged. */
export function visitNoticeMarkup(): string {
  return `<style>
#visit-notice[hidden]{display:none !important}
#visit-notice{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.45rem .8rem;box-sizing:border-box;width:100%;max-width:100%;margin:0;padding:.55rem 1rem calc(.55rem + env(safe-area-inset-bottom));background:#141a13;color:#f4f1e8;border-top:1px solid #c6a15b;font-family:Figtree,sans-serif;font-size:.86rem;line-height:1.4}
#visit-notice p{margin:0;flex:1 1 16rem}
#visit-notice a{color:#c6a15b}
#visit-notice button{cursor:pointer;background:transparent;color:#f4f1e8;border:1px solid #2c352b;border-radius:2px;padding:.4rem .7rem;font:inherit}
footer.visit-colophon{margin-top:2.5rem;padding-top:.8rem;border-top:1px solid #2c352b;font-size:.92rem}
body{padding-bottom:5.5rem}
</style>
<footer class="visit-colophon"><a href="privacy">Privacy</a></footer>
<div id="visit-notice" hidden>
<p>This site logs visits (page, approximate location, browser) to its owner. <a href="privacy">Privacy</a></p>
<button type="button">Dismiss</button>
</div>
<script>
(function(){
  var key="hederica.visit-notice.dismissed";
  var el=document.getElementById("visit-notice");
  if(!el)return;
  var dismissed=false;
  try{dismissed=localStorage.getItem(key)==="1";}catch(e){}
  if(dismissed)return;
  el.hidden=false;
  var btn=el.querySelector("button");
  if(!btn)return;
  btn.addEventListener("click",function(){
    el.hidden=true;
    try{localStorage.setItem(key,"1");}catch(e){}
  });
})();
</script>`;
}

export function renderSiteDocument(html: string, routes: readonly string[]): string {
  const body = relativizeHtml(html);
  const boot =
    `<script>window.__LGME_ROUTES=${JSON.stringify(routes)};</script>` +
    `<script src="lgme-preview-bridge.js" defer></script>` +
    visitNoticeMarkup();
  const closer = body.lastIndexOf("</body>");
  if (closer === -1) return body + boot;
  return `${body.slice(0, closer)}${boot}${body.slice(closer)}`;
}
