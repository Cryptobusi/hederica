export const VISITOR_GATE_PRIVACY =
  "By verifying, you share your email with the site administrator, who is notified of new visitors.";

export const VISITOR_GATE_BYPASS_NOTE = "Preview: gate bypassed (CORS only allows hederica.com)";

/** Critical CSS plus a blocking host check so preview paints unblocked and production stays covered. */
export const visitorGateHead = `<style id="visitor-gate-style">
#visitor-gate, #visitor-gate *, .visitor-gate-note { box-sizing: border-box; }
#visitor-gate {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  overscroll-behavior: contain;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  background: #0c100c;
  color: #f4f1e8;
  font-family: Figtree, sans-serif;
  font-size: 1rem;
  line-height: 1.5;
}
html[data-visitor-gate="bypass"] #visitor-gate,
html[data-visitor-gate="open"] #visitor-gate { display: none !important; }
#visitor-gate[hidden] { display: none !important; }
#visitor-gate [hidden] { display: none !important; }
html[data-visitor-gate-pending="check"] #visitor-gate-email-form,
html[data-visitor-gate-pending="check"] #visitor-gate-code-form,
html[data-visitor-gate-pending="check"] #visitor-gate-error,
html[data-visitor-gate-pending="check"] #visitor-gate-lead { display: none !important; }
html[data-visitor-gate-pending="check"] #visitor-gate-checking { display: block !important; }
.visitor-gate__panel {
  width: min(100%, 26rem);
  margin: auto;
  padding: 1.5rem 1.25rem 1.25rem;
  background: #141a13;
  color: #f4f1e8;
  border: 1px solid #2c352b;
  border-top: 2px solid #c6a15b;
}
.visitor-gate__kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #c6a15b;
}
#visitor-gate h2 {
  margin: 0.45rem 0 0;
  font-family: Newsreader, serif;
  font-weight: 500;
  font-size: clamp(1.7rem, 5vw, 2.15rem);
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: #f4f1e8;
}
.visitor-gate__lead { margin: 0.75rem 0 0; color: #c5d0c2; }
#visitor-gate label {
  display: block;
  width: auto;
  margin: 1rem 0 0.4rem;
  color: #c5d0c2;
  font-family: Figtree, sans-serif;
  font-size: 0.92rem;
  font-weight: 500;
}
#visitor-gate input {
  display: block;
  width: 100%;
  margin: 0;
  min-height: 44px;
  padding: 0.55rem 0.75rem;
  appearance: none;
  background: #0c100c;
  color: #f4f1e8;
  border: 1px solid #2c352b;
  border-radius: 0;
  box-shadow: none;
  font-family: Figtree, sans-serif;
  font-size: 1rem;
  line-height: 1.4;
}
#visitor-gate input#visitor-gate-code {
  font-family: ui-monospace, monospace;
  font-size: 1.25rem;
  letter-spacing: 0.28em;
  text-align: center;
}
.visitor-gate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}
#visitor-gate .visitor-gate__actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-height: 44px;
  margin: 0;
  padding: 0.55rem 1.15rem;
  border-radius: 0;
  font-family: Figtree, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
}
#visitor-gate .visitor-gate__primary {
  background: #f4f1e8;
  color: #0c100c;
  border: 1px solid #f4f1e8;
}
#visitor-gate .visitor-gate__primary:hover {
  background: #c6a15b;
  border-color: #c6a15b;
  color: #0c100c;
}
#visitor-gate .visitor-gate__secondary {
  background: transparent;
  color: #c5d0c2;
  border: 1px solid #2c352b;
  font-weight: 500;
}
#visitor-gate .visitor-gate__secondary:hover { color: #c6a15b; border-color: #c6a15b; }
#visitor-gate button:disabled { opacity: 0.55; cursor: wait; }
#visitor-gate :focus { outline: none; }
#visitor-gate :focus-visible { outline: 2px solid #c6a15b; outline-offset: 2px; }
#visitor-gate-error-text {
  margin: 0.9rem 0 0;
  padding-left: 0.85rem;
  border-left: 2px solid #c6a15b;
  color: #e4d3a2;
}
#visitor-gate-checking-text { margin: 0.9rem 0 0; color: #c5d0c2; }
.visitor-gate__privacy {
  margin: 1.15rem 0 0;
  color: #c5d0c2;
  font-size: 0.88rem;
  line-height: 1.45;
}
.visitor-gate-note {
  display: none;
  position: fixed;
  z-index: 35;
  left: max(0.75rem, env(safe-area-inset-left));
  bottom: max(0.75rem, env(safe-area-inset-bottom));
  max-width: min(18rem, calc(100vw - 1.5rem));
  margin: 0;
  padding: 0.4rem 0.6rem;
  background: #141a13;
  color: #c5d0c2;
  border: 1px solid #2c352b;
  font-family: Figtree, sans-serif;
  font-size: 0.75rem;
  line-height: 1.35;
}
html[data-visitor-gate="bypass"] .visitor-gate-note { display: block; }
@media (max-width: 480px) {
  #visitor-gate .visitor-gate__actions button { width: 100%; }
}
</style>
<script>
(function () {
  var host = String(location.hostname || "").trim().toLowerCase().replace(/\\.$/, "");
  var enforced = host === "hederica.com" || host === "www.hederica.com";
  if (!enforced) {
    document.documentElement.setAttribute("data-visitor-gate", "bypass");
    return;
  }
  document.documentElement.setAttribute("data-visitor-gate", "closed");
  var token = "";
  try {
    token = localStorage.getItem("hederica.gate.token") || "";
  } catch (err) {
    token = "";
  }
  if (String(token).trim()) {
    document.documentElement.setAttribute("data-visitor-gate-pending", "check");
  }
})();
</script>
`;

export const visitorGateBody = `<div id="visitor-gate" class="visitor-gate" role="dialog" aria-modal="true" aria-labelledby="visitor-gate-title" aria-describedby="visitor-gate-privacy">
  <div class="visitor-gate__panel">
    <p class="visitor-gate__kicker">Hederica</p>
    <h2 id="visitor-gate-title">Confirm your visit</h2>
    <p id="visitor-gate-lead" class="visitor-gate__lead">Enter your email. We'll send a 6-digit code.</p>
    <form id="visitor-gate-email-form">
      <label for="visitor-gate-email">Email</label>
      <input id="visitor-gate-email" name="email" type="email" autocomplete="email" inputmode="email" enterkeyhint="send" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="254" />
      <div class="visitor-gate__actions">
        <button class="visitor-gate__primary" type="submit">Send code</button>
      </div>
    </form>
    <form id="visitor-gate-code-form" hidden>
      <label for="visitor-gate-code">Confirmation code</label>
      <input id="visitor-gate-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" enterkeyhint="done" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="32" />
      <div class="visitor-gate__actions">
        <button class="visitor-gate__primary" type="submit">Verify</button>
        <button class="visitor-gate__secondary" id="visitor-gate-change-email" type="button">Use a different email</button>
      </div>
    </form>
    <div id="visitor-gate-checking" hidden>
      <p id="visitor-gate-checking-text" role="status" tabindex="-1">Checking your visit...</p>
    </div>
    <div id="visitor-gate-error" hidden>
      <p id="visitor-gate-error-text" role="alert" tabindex="-1"></p>
      <div class="visitor-gate__actions">
        <button class="visitor-gate__primary" id="visitor-gate-retry" type="button">Try again</button>
      </div>
    </div>
    <p id="visitor-gate-privacy" class="visitor-gate__privacy">${VISITOR_GATE_PRIVACY}</p>
  </div>
</div>
<p id="visitor-gate-note" class="visitor-gate-note">${VISITOR_GATE_BYPASS_NOTE}</p>
`;
