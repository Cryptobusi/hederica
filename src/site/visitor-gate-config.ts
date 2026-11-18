/**
 * Master switch for the hederica.com visitor email gate.
 *
 * Off because lgme.app's confirmation-code emails are failing. While this is
 * false, `renderSiteDocument` injects no gate overlay, no gate head script,
 * and no preview bypass note, so pages render as they did before the gate.
 *
 * The gate itself stays in `visitor-gate-client.ts` and
 * `visitor-gate-document.ts`. To turn it back on, set this to `true`.
 */
export const VISITOR_GATE_ENABLED = false;
