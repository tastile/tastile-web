// Strict loopback-only allowlist for the `redirect_uri` of
// /cli/authorize (Issue #153, plan D4).
//
// The CLI's local HttpServerBridge listens on http://127.0.0.1:<port>/callback
// and only ever redirects there with no query / no hash / no credentials.
// We mirror those invariants 1:1 so a malformed `redirect_uri` from a CLI
// build that diverges from the wire contract (or from a malicious browser
// extension that rewrote the URL before submit) is rejected at the boundary.

export type RedirectValidation =
  | { ok: true }
  | { ok: false; reason: string };

const LOOPBACK_HOST = "127.0.0.1";
const CALLBACK_PATH = "/callback";

// URL parser throws on out-of-range / non-integer ports, but we want a
// specific failure reason for those. Pre-check the port so out-of-range or
// non-integer ports produce `port_out_of_range` instead of the generic
// `unparseable` we would get if the WHATWG URL constructor rejected the
// whole URI.
const PORT_PREFIX = /^http:\/\/127\.0\.0\.1:([^/]*)/u;

export function validateLoopbackRedirect(uri: string): RedirectValidation {
  const portMatch = PORT_PREFIX.exec(uri);
  if (portMatch) {
    const rawPort = portMatch[1] ?? "";
    if (rawPort === "") {
      return { ok: false, reason: "port_out_of_range" };
    }
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      return { ok: false, reason: "port_out_of_range" };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return { ok: false, reason: "unparseable" };
  }
  if (parsed.protocol !== "http:") {
    return { ok: false, reason: "scheme_must_be_http" };
  }
  // `URL` treats `127.0.0.1.attacker.example` as a single DNS label, so the
  // exact host check catches the suffix-confusion attack.
  if (parsed.hostname !== LOOPBACK_HOST) {
    return { ok: false, reason: "host_must_be_loopback" };
  }
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { ok: false, reason: "port_out_of_range" };
  }
  if (parsed.pathname !== CALLBACK_PATH) {
    return { ok: false, reason: "path_must_be_callback" };
  }
  if (parsed.search !== "") {
    return { ok: false, reason: "query_not_allowed" };
  }
  if (parsed.hash !== "") {
    return { ok: false, reason: "fragment_not_allowed" };
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, reason: "credentials_not_allowed" };
  }
  return { ok: true };
}
