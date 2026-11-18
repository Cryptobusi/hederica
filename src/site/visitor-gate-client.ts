export const visitorGateScript = String.raw`
/* Visitor gate. lgme.app contract: start {ok}|{ok:false,error}, verify {token}|{error}, check {ok}. */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HedericaVisitorGate = api;
  if (typeof document === "undefined") return;

  function boot() {
    var storage = null;
    try {
      storage = root.localStorage;
    } catch {
      storage = null;
    }
    var fetchImpl = typeof root.fetch === "function" ? root.fetch.bind(root) : null;
    try {
      api.mount(document, root.location, storage, fetchImpl);
    } catch {
      // Fail closed: leave the overlay up when the gate script hits an unexpected error.
    }
  }

  if (document.getElementById("visitor-gate") || document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})(typeof globalThis !== "undefined" ? globalThis : this, function visitorGateFactory() {
  "use strict";

  var STORAGE_KEY = "hederica.gate.token";
  var START_URL = "https://lgme.app/api/gate/start";
  var VERIFY_URL = "https://lgme.app/api/gate/verify";
  var CHECK_URL = "https://lgme.app/api/gate/check";
  var SITE = "hederica";
  var NETWORK_MESSAGE = "We couldn't reach the visitor gate. Try again.";
  var START_FALLBACK = "The visitor gate didn't send a code. Try again.";
  var VERIFY_FALLBACK = "That code didn't verify. Try again.";
  var CHECK_INVALID =
    "This visit confirmation is no longer valid. Enter your email to get a new code.";
  var CHECK_UNREADABLE = "We couldn't confirm this visit. Try again.";
  var STORAGE_MESSAGE = "This browser didn't save the visit confirmation. Try again.";
  var EMAIL_INVALID = "Enter a valid email address.";
  var CODE_INVALID = "Enter the 6-digit code from your email.";

  function isEnforcedHost(hostname) {
    var host = String(hostname || "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
    return host === "hederica.com" || host === "www.hederica.com";
  }

  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function isEmail(value) {
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function normalizeCode(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function asRecord(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload;
  }

  function errorText(payload) {
    var record = asRecord(payload);
    if (!record || typeof record.error !== "string") return "";
    return record.error.trim();
  }

  function interpretStart(payload, failed) {
    if (failed) return { ok: false, message: NETWORK_MESSAGE };
    var record = asRecord(payload);
    if (record && record.ok === true) return { ok: true };
    return { ok: false, message: errorText(payload) || START_FALLBACK };
  }

  function interpretVerify(payload, failed) {
    if (failed) return { ok: false, message: NETWORK_MESSAGE };
    var record = asRecord(payload);
    var token = record && typeof record.token === "string" ? record.token.trim() : "";
    if (token) return { ok: true, token: token };
    return { ok: false, message: errorText(payload) || VERIFY_FALLBACK };
  }

  function interpretCheck(payload, failed) {
    if (!failed) {
      var record = asRecord(payload);
      if (record && record.ok === true) return { outcome: "valid" };
      if (record && record.ok === false) {
        return { outcome: "invalid", message: errorText(payload) || CHECK_INVALID };
      }
    }
    return { outcome: "error", message: errorText(payload) || CHECK_UNREADABLE };
  }

  function readStoredToken(storage) {
    if (!storage) return "";
    try {
      var value = storage.getItem(STORAGE_KEY);
      return typeof value === "string" ? value.trim() : "";
    } catch {
      return "";
    }
  }

  function writeStoredToken(storage, token) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, token);
      return readStoredToken(storage) === token;
    } catch {
      return false;
    }
  }

  function clearStoredToken(storage) {
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore a blocked storage API. The overlay stays closed either way.
    }
  }

  function request(fetchImpl, url, options) {
    return Promise.resolve()
      .then(function () {
        return fetchImpl(url, options);
      })
      .then(function (response) {
        if (!response || typeof response.text !== "function")
          return { failed: true, payload: null };
        return response.text().then(function (text) {
          if (!text || !String(text).trim()) return { failed: true, payload: null };
          try {
            var payload = JSON.parse(String(text));
            if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
              return { failed: true, payload: null };
            }
            return { failed: false, payload: payload };
          } catch {
            return { failed: true, payload: null };
          }
        });
      })
      .catch(function () {
        return { failed: true, payload: null };
      });
  }

  function mount(doc, loc, storage, fetchImpl) {
    if (!doc || typeof doc.getElementById !== "function") return;
    var root = doc.getElementById("visitor-gate");
    if (!root || !doc.documentElement) return;
    var note = doc.getElementById("visitor-gate-note");
    var hostname = loc && loc.hostname;

    if (!isEnforcedHost(hostname)) {
      doc.documentElement.setAttribute("data-visitor-gate", "bypass");
      doc.documentElement.removeAttribute("data-visitor-gate-pending");
      root.hidden = true;
      if (note) note.hidden = false;
      return;
    }

    var emailForm = doc.getElementById("visitor-gate-email-form");
    var codeForm = doc.getElementById("visitor-gate-code-form");
    var checking = doc.getElementById("visitor-gate-checking");
    var checkingText = doc.getElementById("visitor-gate-checking-text");
    var errorBox = doc.getElementById("visitor-gate-error");
    var errorTextNode = doc.getElementById("visitor-gate-error-text");
    var retryBtn = doc.getElementById("visitor-gate-retry");
    var emailInput = doc.getElementById("visitor-gate-email");
    var codeInput = doc.getElementById("visitor-gate-code");
    var changeEmail = doc.getElementById("visitor-gate-change-email");
    var title = doc.getElementById("visitor-gate-title");
    var lead = doc.getElementById("visitor-gate-lead");
    if (
      !emailForm ||
      !codeForm ||
      !checking ||
      !checkingText ||
      !errorBox ||
      !errorTextNode ||
      !retryBtn ||
      !emailInput ||
      !codeInput ||
      !changeEmail ||
      !title ||
      !lead
    ) {
      return;
    }

    var doFetch =
      typeof fetchImpl === "function"
        ? fetchImpl
        : function () {
            return Promise.reject(new Error("unavailable"));
          };
    var pendingEmail = "";
    var retryAction = "email";

    doc.documentElement.setAttribute("data-visitor-gate", "closed");
    doc.documentElement.removeAttribute("data-visitor-gate-pending");
    root.hidden = false;
    if (note) note.hidden = true;
    freezePage();
    if (typeof doc.addEventListener === "function") doc.addEventListener("keydown", onKeydown);

    var token = readStoredToken(storage);
    if (token) runCheck(token);
    else show("email");

    emailForm.addEventListener("submit", function (event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      if (root.getAttribute("aria-busy") === "true") return;
      var email = normalizeEmail(emailInput.value);
      if (!isEmail(email)) {
        fail(EMAIL_INVALID, "email");
        return;
      }
      pendingEmail = email;
      setBusy(true);
      lead.hidden = false;
      lead.textContent = "Sending the code…";
      request(doFetch, START_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: email, site: SITE }),
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      }).then(function (result) {
        var parsed = interpretStart(result.payload, result.failed);
        if (!parsed.ok) {
          fail(parsed.message, "email");
          return;
        }
        setBusy(false);
        codeInput.value = "";
        show("code");
      });
    });

    codeForm.addEventListener("submit", function (event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      if (root.getAttribute("aria-busy") === "true") return;
      var email = pendingEmail || normalizeEmail(emailInput.value);
      var code = normalizeCode(codeInput.value);
      if (!isEmail(email)) {
        fail(EMAIL_INVALID, "email");
        return;
      }
      if (!/^[0-9]{6}$/.test(code)) {
        fail(CODE_INVALID, "code");
        return;
      }
      pendingEmail = email;
      codeInput.value = code;
      setBusy(true);
      lead.hidden = false;
      lead.textContent = "Checking the code…";
      request(doFetch, VERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: email, code: code }),
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      }).then(function (result) {
        var parsed = interpretVerify(result.payload, result.failed);
        if (!parsed.ok) {
          fail(parsed.message, "code");
          return;
        }
        if (!writeStoredToken(storage, parsed.token)) {
          fail(STORAGE_MESSAGE, "email");
          return;
        }
        admit();
      });
    });

    changeEmail.addEventListener("click", function () {
      if (root.getAttribute("aria-busy") === "true") return;
      codeInput.value = "";
      show("email");
    });

    retryBtn.addEventListener("click", function () {
      if (retryAction === "check") {
        var saved = readStoredToken(storage);
        if (!saved) {
          show("email");
          return;
        }
        runCheck(saved);
        return;
      }
      show(retryAction === "code" ? "code" : "email");
    });

    function show(step) {
      emailForm.hidden = step !== "email";
      codeForm.hidden = step !== "code";
      checking.hidden = step !== "checking";
      errorBox.hidden = step !== "error";
      lead.hidden = step === "error" || step === "checking";
      if (step === "email") {
        title.textContent = "Confirm your email";
        lead.textContent = "Enter your email. We'll send a 6-digit code.";
        emailInput.focus();
      } else if (step === "code") {
        title.textContent = "Enter your code";
        lead.textContent = pendingEmail
          ? "Enter the 6-digit code sent to " + pendingEmail + "."
          : "Enter the 6-digit code from your email.";
        codeInput.focus();
      } else if (step === "checking") {
        title.textContent = "Confirming your visit";
        checkingText.focus();
      } else {
        title.textContent = "Visitor gate";
        retryBtn.focus();
      }
    }

    function fail(message, action) {
      setBusy(false);
      retryAction = action;
      errorTextNode.textContent = message;
      show("error");
    }

    function setBusy(busy) {
      root.setAttribute("aria-busy", busy ? "true" : "false");
      if (typeof root.querySelectorAll !== "function") return;
      var controls = root.querySelectorAll("button, input");
      for (var i = 0; i < controls.length; i += 1) controls[i].disabled = busy;
    }

    function admit() {
      setBusy(false);
      doc.documentElement.setAttribute("data-visitor-gate", "open");
      doc.documentElement.removeAttribute("data-visitor-gate-pending");
      root.hidden = true;
      unfreezePage();
    }

    function runCheck(savedToken) {
      setBusy(true);
      show("checking");
      request(doFetch, CHECK_URL + "?token=" + encodeURIComponent(savedToken), {
        method: "GET",
        headers: { accept: "application/json" },
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      }).then(function (result) {
        var parsed = interpretCheck(result.payload, result.failed);
        if (parsed.outcome === "valid") {
          if (!writeStoredToken(storage, savedToken)) {
            fail(STORAGE_MESSAGE, "email");
            return;
          }
          admit();
          return;
        }
        if (parsed.outcome === "invalid") {
          clearStoredToken(storage);
          fail(parsed.message, "email");
          return;
        }
        fail(parsed.message, "check");
      });
    }

    function isHidden(el) {
      var node = el;
      while (node) {
        if (node.hidden) return true;
        node = node.parentElement || null;
      }
      return false;
    }

    function focusable(container) {
      if (!container || typeof container.querySelectorAll !== "function") return [];
      var nodes = container.querySelectorAll("button, input, a, [tabindex]");
      var list = [];
      for (var i = 0; i < nodes.length; i += 1) {
        var el = nodes[i];
        if (!el || el.disabled || isHidden(el)) continue;
        if (el.getAttribute && el.getAttribute("tabindex") === "-1") continue;
        list.push(el);
      }
      return list;
    }

    function onKeydown(event) {
      if (!event || doc.documentElement.getAttribute("data-visitor-gate") !== "closed") return;
      if (event.key === "Escape") {
        if (typeof event.preventDefault === "function") event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      var items = focusable(root);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var active = doc.activeElement;
      var backward = event.shiftKey && (active === first || !root.contains(active));
      var forward = !event.shiftKey && (active === last || !root.contains(active));
      if (!backward && !forward) return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      (backward ? last : first).focus();
    }

    function freezePage() {
      var body = doc.body;
      if (!body || !body.children) return;
      for (var i = 0; i < body.children.length; i += 1) {
        var child = body.children[i];
        if (child === root || child === note) continue;
        child.setAttribute("inert", "");
        child.setAttribute("aria-hidden", "true");
        child.setAttribute("data-visitor-gate-inert", "");
      }
      if (doc.documentElement.style) doc.documentElement.style.overflow = "hidden";
    }

    function unfreezePage() {
      if (typeof doc.querySelectorAll !== "function") {
        if (doc.documentElement.style) doc.documentElement.style.overflow = "";
        return;
      }
      var marked = doc.querySelectorAll("[data-visitor-gate-inert]");
      for (var i = 0; i < marked.length; i += 1) {
        marked[i].removeAttribute("inert");
        marked[i].removeAttribute("aria-hidden");
        marked[i].removeAttribute("data-visitor-gate-inert");
      }
      if (doc.documentElement.style) doc.documentElement.style.overflow = "";
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    START_URL: START_URL,
    VERIFY_URL: VERIFY_URL,
    CHECK_URL: CHECK_URL,
    SITE: SITE,
    isEnforcedHost: isEnforcedHost,
    normalizeEmail: normalizeEmail,
    normalizeCode: normalizeCode,
    interpretStart: interpretStart,
    interpretVerify: interpretVerify,
    interpretCheck: interpretCheck,
    mount: mount,
  };
});
`;
