import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { visitorGateScript } from "./visitor-gate-client.ts";
import { renderSiteDocument } from "./render.ts";
import {
  VISITOR_GATE_BYPASS_NOTE,
  VISITOR_GATE_PRIVACY,
  visitorGateHead,
} from "./visitor-gate-document.ts";

type GateApi = {
  STORAGE_KEY: string;
  START_URL: string;
  VERIFY_URL: string;
  CHECK_URL: string;
  SITE: string;
  isEnforcedHost: (hostname: string) => boolean;
  normalizeEmail: (value: string) => string;
  normalizeCode: (value: string) => string;
  interpretStart: (payload: unknown, failed: boolean) => { ok: boolean; message?: string };
  interpretVerify: (
    payload: unknown,
    failed: boolean,
  ) => { ok: boolean; token?: string; message?: string };
  interpretCheck: (payload: unknown, failed: boolean) => { outcome: string; message?: string };
  mount: (
    doc: MockDoc,
    loc: { hostname: string },
    storage: MockStorage | null,
    fetchImpl: MockFetch,
  ) => void;
};

type GateListener = (event?: {
  preventDefault?: () => void;
  key?: string;
  shiftKey?: boolean;
}) => void;

type MockEl = {
  id: string | null;
  tag: string;
  hidden: boolean;
  disabled: boolean;
  value: string;
  textContent: string;
  parentElement: MockEl | null;
  children: MockEl[];
  style: { overflow?: string };
  attributes: Record<string, string>;
  listeners: Record<string, GateListener>;
  focusCount: number;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  removeAttribute: (name: string) => void;
  addEventListener: (type: string, fn: GateListener) => void;
  focus: () => void;
  contains: (node: MockEl) => boolean;
  querySelectorAll: (sel: string) => MockEl[];
};

type MockDoc = {
  activeElement: MockEl | null;
  documentElement: MockEl;
  body: MockEl;
  listeners: Record<string, GateListener>;
  addEventListener: MockEl["addEventListener"];
  getElementById: (id: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
};

type MockStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type MockFetch = (
  url: string,
  options: { method?: string; body?: string },
) => Promise<{ text: () => Promise<string> }>;

const gate = loadGate();

function loadGate(): GateApi {
  const code = visitorGateScript;
  const sandbox = {
    module: { exports: {} as GateApi },
    console,
  };
  vm.runInNewContext(code, sandbox, { filename: "visitor-gate.js" });
  return sandbox.module.exports;
}

function jsonResponse(body: unknown) {
  return { text: () => Promise.resolve(JSON.stringify(body)) };
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function memoryStorage(
  initial?: string,
  failWrite = false,
): MockStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(gate.STORAGE_KEY, initial);
  return {
    data,
    getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    setItem(key, value) {
      if (failWrite) throw new Error("blocked");
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function createHarness() {
  const elements = new Map<string, MockEl>();
  function make(id: string | null, tag: string, parent: MockEl | null): MockEl {
    const el: MockEl = {
      id,
      tag,
      hidden: false,
      disabled: false,
      value: "",
      textContent: "",
      parentElement: parent,
      children: [],
      style: {},
      attributes: {},
      listeners: {},
      focusCount: 0,
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
          ? this.attributes[name]
          : null;
      },
      hasAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name);
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
      addEventListener(type, fn) {
        this.listeners[type] = fn;
      },
      focus() {
        this.focusCount += 1;
        doc.activeElement = this;
      },
      contains(node) {
        if (node === this) return true;
        return this.children.some((child) => child.contains(node));
      },
      querySelectorAll() {
        const found: MockEl[] = [];
        const walk = (node: MockEl) => {
          if (node.tag === "button" || node.tag === "input" || node.hasAttribute("tabindex"))
            found.push(node);
          for (const child of node.children) walk(child);
        };
        walk(this);
        return found;
      },
    };
    if (parent) parent.children.push(el);
    if (id) elements.set(id, el);
    return el;
  }

  const doc = {
    activeElement: null as MockEl | null,
    documentElement: null as unknown as MockEl,
    body: null as unknown as MockEl,
    listeners: {} as MockDoc["listeners"],
    addEventListener(type: string, fn: GateListener) {
      this.listeners[type] = fn;
    },
    getElementById(id: string) {
      return elements.get(id) ?? null;
    },
    querySelectorAll(sel: string) {
      if (sel !== "[data-visitor-gate-inert]") return [];
      return doc.body.children.filter((child) => child.hasAttribute("data-visitor-gate-inert"));
    },
  } as MockDoc;

  doc.documentElement = make(null, "html", null);
  doc.body = make(null, "body", doc.documentElement);
  const page = make(null, "main", doc.body);
  const root = make("visitor-gate", "div", doc.body);
  const panel = make(null, "div", root);
  const title = make("visitor-gate-title", "h2", panel);
  const lead = make("visitor-gate-lead", "p", panel);
  const emailForm = make("visitor-gate-email-form", "form", panel);
  const emailInput = make("visitor-gate-email", "input", emailForm);
  const emailActions = make(null, "div", emailForm);
  const sendButton = make(null, "button", emailActions);
  const codeForm = make("visitor-gate-code-form", "form", panel);
  codeForm.hidden = true;
  const codeInput = make("visitor-gate-code", "input", codeForm);
  const codeActions = make(null, "div", codeForm);
  const verifyButton = make(null, "button", codeActions);
  const changeEmail = make("visitor-gate-change-email", "button", codeActions);
  const checking = make("visitor-gate-checking", "div", panel);
  checking.hidden = true;
  const checkingText = make("visitor-gate-checking-text", "p", checking);
  checkingText.setAttribute("tabindex", "-1");
  const errorBox = make("visitor-gate-error", "div", panel);
  errorBox.hidden = true;
  const errorText = make("visitor-gate-error-text", "p", errorBox);
  errorText.setAttribute("tabindex", "-1");
  const retry = make("visitor-gate-retry", "button", errorBox);
  const note = make("visitor-gate-note", "p", doc.body);

  return {
    doc,
    page,
    root,
    title,
    lead,
    emailForm,
    emailInput,
    sendButton,
    codeForm,
    codeInput,
    verifyButton,
    changeEmail,
    checking,
    errorBox,
    errorText,
    retry,
    note,
  };
}

const enforcedHosts = ["hederica.com", "www.hederica.com", "Hederica.COM", "www.hederica.com."];
const openHosts = ["localhost", "127.0.0.1", "hederica.vercel.app", "preview.hederica.com", ""];

test("gate contract urls and storage key", () => {
  assert.equal(gate.START_URL, "https://lgme.app/api/gate/start");
  assert.equal(gate.VERIFY_URL, "https://lgme.app/api/gate/verify");
  assert.equal(gate.CHECK_URL, "https://lgme.app/api/gate/check");
  assert.equal(gate.SITE, "hederica");
  assert.equal(gate.STORAGE_KEY, "hederica.gate.token");
});

test("only hederica.com and www.hederica.com enforce the gate", () => {
  for (const host of enforcedHosts) assert.equal(gate.isEnforcedHost(host), true, host);
  for (const host of openHosts) assert.equal(gate.isEnforcedHost(host), false, host);
});

test("start, verify, and check follow the published response shapes", () => {
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  assert.deepEqual(plain(gate.interpretStart({ ok: true }, false)), { ok: true });
  assert.deepEqual(plain(gate.interpretStart({ ok: false, error: "Unknown address" }, false)), {
    ok: false,
    message: "Unknown address",
  });
  assert.equal(plain(gate.interpretStart({ ok: false }, false)).ok, false);
  assert.match(String(plain(gate.interpretStart(null, true)).message), /Try again/);

  assert.deepEqual(plain(gate.interpretVerify({ token: "abc123" }, false)), {
    ok: true,
    token: "abc123",
  });
  assert.deepEqual(plain(gate.interpretVerify({ token: "  abc123  " }, false)), {
    ok: true,
    token: "abc123",
  });
  assert.equal(plain(gate.interpretVerify({ error: "Bad code" }, false)).message, "Bad code");
  assert.equal(plain(gate.interpretVerify({ token: "" }, false)).ok, false);
  assert.match(String(plain(gate.interpretVerify(null, true)).message), /Try again/);

  assert.deepEqual(plain(gate.interpretCheck({ ok: true }, false)), { outcome: "valid" });
  assert.equal(plain(gate.interpretCheck({ ok: false }, false)).outcome, "invalid");
  assert.equal(
    plain(gate.interpretCheck({ ok: false, error: "Expired" }, false)).message,
    "Expired",
  );
  assert.equal(plain(gate.interpretCheck(null, true)).outcome, "error");
  assert.equal(plain(gate.interpretCheck({}, false)).outcome, "error");
});

test("code and email normalization", () => {
  assert.equal(gate.normalizeEmail("  Person@Example.com "), "person@example.com");
  assert.equal(gate.normalizeCode("12 34-56"), "123456");
});

test("head boot matches host enforcement and keeps a saved token covered", () => {
  const script = visitorGateHead.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  for (const host of enforcedHosts) {
    assert.equal(bootHost(script, host, ""), "closed");
    assert.equal(bootPending(script, host, "saved-token"), "check");
  }
  for (const host of openHosts) assert.equal(bootHost(script, host, "saved-token"), "bypass");
});

test("render injects the gate without altering page copy", () => {
  const index = readFileSync(new URL("./html/index.html", import.meta.url), "utf8");
  assert.match(index, /<strong>Debit<\/strong>: you owe\./);
  assert.match(index, /<strong>Credit<\/strong>: you lend\./);
  assert.match(index, /<strong>Creo<\/strong>: value you create, the IdidIt currency\./);
  assert.match(index, /Creo is not a coin/);
  assert.equal(index.includes("$Trust"), false);

  const rendered = renderSiteDocument(index, ["/"]);
  assert.match(rendered, /<strong>Debit<\/strong>: you owe\./);
  assert.match(rendered, /<strong>Credit<\/strong>: you lend\./);
  assert.match(rendered, /Creo is not a coin/);
  assert.equal(rendered.includes("$Trust"), false);
  assert.equal(rendered.includes(VISITOR_GATE_PRIVACY), true);
  assert.equal(rendered.includes(VISITOR_GATE_BYPASS_NOTE), true);
  assert.equal(rendered.includes('role="dialog"'), true);
  assert.equal(rendered.includes(">Send code<"), true);
  assert.equal(rendered.includes(">Verify<"), true);
  assert.equal(rendered.includes(">Try again<"), true);
  assert.equal(rendered.split('id="visitor-gate"').length, 2);
  assert.equal(rendered.includes("https://lgme.app/api/gate/verify"), true);
  assert.match(rendered, /href="study"/);
});

test("preview hosts bypass and hederica.com asks for an email", () => {
  const preview = createHarness();
  gate.mount(preview.doc, { hostname: "hederica.vercel.app" }, memoryStorage(), fetchStub());
  assert.equal(preview.doc.documentElement.getAttribute("data-visitor-gate"), "bypass");
  assert.equal(preview.root.hidden, true);
  assert.equal(preview.note.hidden, false);
  assert.equal(preview.page.hasAttribute("inert"), false);

  const locked = createHarness();
  gate.mount(locked.doc, { hostname: "www.hederica.com" }, memoryStorage(), fetchStub());
  assert.equal(locked.doc.documentElement.getAttribute("data-visitor-gate"), "closed");
  assert.equal(locked.root.hidden, false);
  assert.equal(locked.emailForm.hidden, false);
  assert.equal(locked.title.textContent, "Confirm your email");
  assert.equal(locked.page.getAttribute("aria-hidden"), "true");
  assert.equal(locked.doc.documentElement.style.overflow, "hidden");
  assert.equal(locked.doc.activeElement, locked.emailInput);
});

test("send code posts the contract body and verify stores the token", async () => {
  const ui = createHarness();
  const storage = memoryStorage();
  const calls: { url: string; body?: string }[] = [];
  const responses = [jsonResponse({ ok: true }), jsonResponse({ token: "token-30-day" })];
  gate.mount(ui.doc, { hostname: "hederica.com" }, storage, (url, options) => {
    calls.push({ url, body: options.body });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error("no response"));
    return Promise.resolve(next);
  });

  ui.emailInput.value = "Reader@Example.com";
  ui.emailForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  assert.deepEqual(JSON.parse(calls[0].body ?? "{}"), {
    email: "reader@example.com",
    site: "hederica",
  });
  assert.equal(calls[0].url, gate.START_URL);
  assert.equal(ui.codeForm.hidden, false);
  assert.match(ui.lead.textContent, /reader@example.com/);

  ui.codeInput.value = "12 34-56";
  ui.codeForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  assert.deepEqual(JSON.parse(calls[1].body ?? "{}"), {
    email: "reader@example.com",
    code: "123456",
  });
  assert.equal(calls[1].url, gate.VERIFY_URL);
  assert.equal(storage.data.get(gate.STORAGE_KEY), "token-30-day");
  assert.equal(ui.doc.documentElement.getAttribute("data-visitor-gate"), "open");
  assert.equal(ui.root.hidden, true);
  assert.equal(ui.page.hasAttribute("inert"), false);
});

test("API error strings are shown and Try again returns to the failed step", async () => {
  const ui = createHarness();
  gate.mount(ui.doc, { hostname: "hederica.com" }, memoryStorage(), () =>
    Promise.resolve(jsonResponse({ ok: false, error: "Mailbox refused" })),
  );
  ui.emailInput.value = "a@b.co";
  ui.emailForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  assert.equal(ui.errorBox.hidden, false);
  assert.equal(ui.errorText.textContent, "Mailbox refused");
  assert.equal(ui.doc.activeElement, ui.retry);

  ui.retry.listeners.click?.();
  assert.equal(ui.emailForm.hidden, false);
  assert.equal(ui.emailInput.value, "a@b.co");

  const verify = createHarness();
  let calls = 0;
  gate.mount(verify.doc, { hostname: "hederica.com" }, memoryStorage(), () => {
    calls += 1;
    if (calls === 1) return Promise.resolve(jsonResponse({ ok: true }));
    return Promise.resolve(jsonResponse({ error: "That code expired" }));
  });
  verify.emailInput.value = "a@b.co";
  verify.emailForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  verify.codeInput.value = "12";
  verify.codeForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  assert.equal(verify.errorText.textContent, "Enter the 6-digit code from your email.");
  verify.retry.listeners.click?.();
  verify.codeInput.value = "111111";
  verify.codeForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  assert.equal(verify.errorText.textContent, "That code expired");
  assert.equal(calls, 2);
});

test("a saved token is checked, kept when the network fails, and cleared when rejected", async () => {
  const kept = createHarness();
  const keptStorage = memoryStorage("saved");
  const checks: string[] = [];
  let fail = true;
  gate.mount(kept.doc, { hostname: "hederica.com" }, keptStorage, (url) => {
    checks.push(url);
    if (fail) return Promise.reject(new Error("down"));
    return Promise.resolve(jsonResponse({ ok: true }));
  });
  await flush();
  assert.equal(kept.errorBox.hidden, false);
  assert.match(kept.errorText.textContent, /couldn't confirm/i);
  assert.equal(keptStorage.data.get(gate.STORAGE_KEY), "saved");
  assert.equal(checks[0], "https://lgme.app/api/gate/check?token=saved");

  fail = false;
  kept.retry.listeners.click?.();
  await flush();
  assert.equal(kept.doc.documentElement.getAttribute("data-visitor-gate"), "open");
  assert.equal(checks.length, 2);

  const dropped = createHarness();
  const droppedStorage = memoryStorage("old");
  gate.mount(dropped.doc, { hostname: "hederica.com" }, droppedStorage, () =>
    Promise.resolve(jsonResponse({ ok: false })),
  );
  await flush();
  assert.equal(droppedStorage.data.has(gate.STORAGE_KEY), false);
  assert.equal(dropped.errorBox.hidden, false);
  assert.match(dropped.errorText.textContent, /no longer valid/);
});

test("a token that cannot be stored does not open the gate", async () => {
  const ui = createHarness();
  let calls = 0;
  gate.mount(ui.doc, { hostname: "hederica.com" }, memoryStorage(undefined, true), () => {
    calls += 1;
    if (calls === 1) return Promise.resolve(jsonResponse({ ok: true }));
    return Promise.resolve(jsonResponse({ token: "abc" }));
  });
  ui.emailInput.value = "a@b.co";
  ui.emailForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  ui.codeInput.value = "123456";
  ui.codeForm.listeners.submit?.({ preventDefault() {} });
  await flush();
  assert.equal(ui.root.hidden, false);
  assert.match(ui.errorText.textContent, /didn't save/);
  assert.notEqual(ui.doc.documentElement.getAttribute("data-visitor-gate"), "open");
});

test("Tab wraps inside the dialog and Escape does not dismiss it", () => {
  const ui = createHarness();
  gate.mount(ui.doc, { hostname: "hederica.com" }, memoryStorage(), fetchStub());
  ui.doc.activeElement = ui.sendButton;
  let prevented = false;
  ui.doc.listeners.keydown?.({
    key: "Tab",
    shiftKey: false,
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(ui.doc.activeElement, ui.emailInput);
  prevented = false;
  ui.doc.listeners.keydown?.({
    key: "Escape",
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(ui.root.hidden, false);
});

test("gate sources do not mention $Trust", () => {
  const files = [
    "src/site/visitor-gate-client.ts",
    "src/site/visitor-gate-document.ts",
    "src/site/render.ts",
  ];
  for (const file of files) {
    assert.equal(readFileSync(file, "utf8").includes("$Trust"), false, file);
  }
});

function fetchStub(): MockFetch {
  return () => Promise.reject(new Error("unexpected"));
}

function bootHost(script: string, hostname: string, token: string) {
  const state = { gate: "", pending: "" };
  vm.runInNewContext(script, bootSandbox(hostname, token, state));
  return state.gate;
}

function bootPending(script: string, hostname: string, token: string) {
  const state = { gate: "", pending: "" };
  vm.runInNewContext(script, bootSandbox(hostname, token, state));
  return state.pending;
}

function bootSandbox(hostname: string, token: string, state: { gate: string; pending: string }) {
  return {
    location: { hostname },
    localStorage: {
      getItem(key: string) {
        return key === "hederica.gate.token" ? token : null;
      },
    },
    document: {
      documentElement: {
        setAttribute(name: string, value: string) {
          if (name === "data-visitor-gate") state.gate = value;
          if (name === "data-visitor-gate-pending") state.pending = value;
        },
      },
    },
  };
}
