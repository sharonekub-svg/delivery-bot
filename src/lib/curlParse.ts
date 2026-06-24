/**
 * Parse whatever the user pastes from DevTools into the two things we need to
 * act as them against 10Bis:
 *   - the `cookie` header (drives the stateful NextApi calls)
 *   - the `authorization` bearer token (drives the catalog api.10bis.co.il calls)
 *
 * Accepts three shapes, in order of how forgiving we are:
 *   1. A full "Copy as cURL" command (bash or Windows/cmd style).
 *   2. A raw `Cookie:`/`Authorization:` header block (e.g. copied from the
 *      Request Headers panel).
 *   3. A bare cookie string (`name=value; name2=value2`).
 *
 * Nothing here talks to the network — it's pure string wrangling so it can be
 * unit-tested and reused on the client for a quick "this looks valid" check.
 */

export interface ParsedCredentials {
  cookie?: string;
  bearer?: string;
}

/** Pull the value of a single `-H 'name: value'` / `--header "name: value"` flag. */
function headersFromCurl(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Match -H or --header followed by a single- or double-quoted "name: value".
  const re = /(?:-H|--header)\s+(['"])([^]*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const raw = m[2];
    const idx = raw.indexOf(':');
    if (idx > 0) {
      const name = raw.slice(0, idx).trim().toLowerCase();
      out[name] = raw.slice(idx + 1).trim();
    }
  }
  // `--cookie '...'` / `-b '...'` is an alternative way curl carries cookies.
  const ck = /(?:-b|--cookie)\s+(['"])([^]*?)\1/.exec(input);
  if (ck && !out.cookie) out.cookie = ck[2].trim();
  return out;
}

/** Parse a raw header block (one `Name: value` per line). */
function headersFromBlock(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of input.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    if (name === 'cookie' || name === 'authorization') out[name] = line.slice(idx + 1).trim();
  }
  return out;
}

export function parseCredentials(input: string): ParsedCredentials {
  const text = (input ?? '').trim();
  if (!text) return {};

  const looksLikeCurl = /^\s*curl\b/i.test(text) || /(?:-H|--header)\s+['"]/.test(text);
  const headers = looksLikeCurl ? headersFromCurl(text) : headersFromBlock(text);

  let cookie = headers.cookie;
  let bearer: string | undefined;
  const auth = headers.authorization;
  if (auth) bearer = auth.replace(/^bearer\s+/i, '').trim();

  // Fallback: the whole paste is just a bare cookie string.
  if (!cookie && !bearer && /=/.test(text) && /;|\bAuth-?\w*=|\boauth\b/i.test(text + ';')) {
    cookie = text.replace(/^cookie:\s*/i, '').trim();
  }

  return { cookie: cookie || undefined, bearer: bearer || undefined };
}

/** Turn a cookie header string into a { name: value } jar. */
export function cookieStringToJar(cookie: string): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    if (name) jar[name] = part.slice(idx + 1).trim();
  }
  return jar;
}
