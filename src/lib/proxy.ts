/**
 * Proxy URL parsing + formatting.
 *
 * Handles the formats commonly issued by mobile/residential proxy vendors,
 * including sticky-session tokens embedded in the username, e.g.:
 *
 *   http://790456858556842ab885__cr.fr__sessid-35af16d74a524060:540b445952b72d46@74.81.81.81:823
 *   socks5://USER:PASS@74.81.81.81:1000
 *   USER:PASS@74.81.81.81:823            (protocol defaults to http)
 *   74.81.81.81:823                       (no auth)
 */

export type ProxyProtocol = 'http' | 'https' | 'socks5';

export interface ProxyConfig {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  /** The original pasted string, kept verbatim for round-tripping. */
  raw?: string;
}

const PROTOCOL_RE = /^(https?|socks5):\/\//i;

export interface ParseResult {
  ok: true;
  proxy: ProxyConfig;
}
export interface ParseError {
  ok: false;
  error: string;
}

/**
 * Parse a proxy URL into structured fields. Returns either `{ok: true, proxy}`
 * or `{ok: false, error}` — never throws.
 */
export function parseProxyUrl(input: string): ParseResult | ParseError {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Empty input' };

  let working = raw;
  let protocol: ProxyProtocol = 'http';

  const protoMatch = working.match(PROTOCOL_RE);
  if (protoMatch) {
    const p = protoMatch[1]!.toLowerCase();
    protocol = (p === 'https' ? 'https' : p === 'socks5' ? 'socks5' : 'http') as ProxyProtocol;
    working = working.slice(protoMatch[0].length);
  }

  // Split userinfo from host:port using the LAST '@' so passwords containing
  // '@' survive correctly.
  const atIdx = working.lastIndexOf('@');
  let userinfo = '';
  let hostport = working;
  if (atIdx >= 0) {
    userinfo = working.slice(0, atIdx);
    hostport = working.slice(atIdx + 1);
  }

  // hostport: split on LAST ':' so IPv6 doesn't confuse it (we don't really
  // support IPv6 here but be defensive).
  const colonIdx = hostport.lastIndexOf(':');
  if (colonIdx < 0) {
    return { ok: false, error: 'Missing port (expected host:port)' };
  }
  const host = hostport.slice(0, colonIdx).trim();
  const portStr = hostport.slice(colonIdx + 1).trim();
  const port = Number(portStr);
  if (!host) return { ok: false, error: 'Missing host' };
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: `Invalid port: ${portStr}` };
  }

  // userinfo: split on FIRST ':' so passwords containing ':' stay intact.
  let username: string | undefined;
  let password: string | undefined;
  if (userinfo) {
    const colon = userinfo.indexOf(':');
    if (colon >= 0) {
      username = decodeURIComponent(userinfo.slice(0, colon));
      password = decodeURIComponent(userinfo.slice(colon + 1));
    } else {
      username = decodeURIComponent(userinfo);
    }
  }

  return {
    ok: true,
    proxy: {
      enabled: true,
      protocol,
      host,
      port,
      username,
      password,
      raw,
    },
  };
}

/**
 * Reconstruct a proxy URL from a config. Used when the user edits one of the
 * structured fields and we want to keep the textarea in sync.
 */
export function formatProxyUrl(p: ProxyConfig): string {
  const auth =
    p.username || p.password
      ? `${encodeURIComponent(p.username ?? '')}:${encodeURIComponent(p.password ?? '')}@`
      : '';
  return `${p.protocol}://${auth}${p.host}:${p.port}`;
}

/**
 * Detect any session-sticky tokens embedded in the username field (vendor
 * specific markers like `__cr.fr__`, `__sessid-XYZ`, `-zone-`, etc).
 * Used to surface info in the UI without altering the value.
 */
export interface ProxyTokens {
  country?: string;
  session?: string;
}

export function extractProxyTokens(username = ''): ProxyTokens {
  const out: ProxyTokens = {};
  // __cr.<country>__   → country code (e.g. cr.fr, cr.us)
  const country = username.match(/__cr\.([a-z]{2})__/i);
  if (country) out.country = country[1]!.toUpperCase();
  // __sessid-<hex>     → sticky session id
  const sess = username.match(/sessid[-_:=]([a-z0-9]+)/i);
  if (sess) out.session = sess[1];
  return out;
}

/** Public-facing default for new phones — proxy off. */
export const DEFAULT_PROXY: ProxyConfig = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: 0,
};
