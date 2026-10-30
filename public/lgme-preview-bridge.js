/* Guest bridge so the preview chrome can move between the live lgme pages. */
(function () {
  if (window.parent === window) return;

  var CHANNEL = "grok-preview-bridge";
  var VERSION = 1;
  var ROOT = "__grokPreviewBridgeRoot";

  function allowedParent(origin) {
    try {
      var url = new URL(origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") return false;
      var host = url.hostname.toLowerCase();
      if (host === "grok.com" || host.slice(-9) === ".grok.com") return true;
      if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
      var guest = location.hostname.toLowerCase();
      if (guest === "grok-sandbox.com" || guest.slice(-17) === ".grok-sandbox.com") return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function parentOrigin() {
    var anc =
      location.ancestorOrigins && location.ancestorOrigins.length
        ? location.ancestorOrigins[0]
        : "";
    var candidates = [document.referrer, anc];
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (!candidate) continue;
      try {
        var url = new URL(candidate.indexOf("://") >= 0 ? candidate : "https://" + candidate);
        if (allowedParent(url.origin)) return url.origin;
      } catch (e) {}
    }
    return null;
  }

  var origin = parentOrigin();
  if (!origin) return;

  function previewPrefix() {
    var host = location.hostname.toLowerCase();
    if (
      host !== "preview.grok.genai.mil" &&
      host !== "preview.grok.mil" &&
      host !== "preview.grokgsac.com"
    ) {
      return "";
    }
    var match = location.pathname.match(/^\/hds-[a-z0-9]+-\d+-[a-z0-9]+/i);
    return match ? match[0] : "";
  }

  function post(message) {
    window.parent.postMessage(message, origin);
  }

  function report() {
    post({
      channel: CHANNEL,
      version: VERSION,
      type: "location",
      path: location.pathname || "/",
      search: location.search,
      hash: location.hash,
    });
  }

  function announce() {
    var paths = Array.isArray(window.__LGME_ROUTES) ? window.__LGME_ROUTES : [];
    report();
    post({ channel: CHANNEL, version: VERSION, type: "routes", paths: paths });
    post({ channel: CHANNEL, version: VERSION, type: "ready" });
  }

  try {
    var state = history.state;
    var tagged = state && typeof state === "object" && Object.prototype.hasOwnProperty.call(state, ROOT);
    if (!tagged) {
      var marked = {};
      if (state && typeof state === "object") {
        for (var key in state) marked[key] = state[key];
      }
      marked[ROOT] = history.length <= 1;
      history.replaceState(marked, "", location.href);
    }
  } catch (e) {}

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent || event.origin !== origin) return;
    var data = event.data;
    if (!data || data.channel !== CHANNEL || data.version !== VERSION || typeof data.type !== "string") return;
    if (data.type === "hello") {
      announce();
      return;
    }
    if (data.type === "navigate" && typeof data.path === "string") {
      if (data.path.charAt(0) !== "/" || data.path.charAt(1) === "/" || data.path.indexOf("\\") !== -1) return;
      var prefix = previewPrefix();
      var dest = prefix && data.path.indexOf(prefix) !== 0 ? prefix + data.path : data.path;
      location.assign(dest);
      return;
    }
    if (data.type === "history" && (data.delta === -1 || data.delta === 1)) {
      var atRoot = history.state && history.state[ROOT] === true;
      if (data.delta === -1 && atRoot) return;
      history.go(data.delta);
    }
  });

  window.addEventListener("hashchange", report);
  window.addEventListener("popstate", report);
  announce();
})();
