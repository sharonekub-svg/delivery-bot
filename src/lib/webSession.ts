import type { NextApiRequest, NextApiResponse } from 'next';
import { decrypt, encrypt } from './crypto';
import type { TenbisSession } from '../tenbis/types';

/**
 * Stateless server: the user's (encrypted) 10Bis session rides in an httpOnly
 * cookie instead of a database. The ciphertext can be larger than a single
 * cookie's ~4KB limit (10Bis cookie jars are chunky), so we split it across
 * `${BASE}_0..N` value cookies plus a `${BASE}_n` count cookie.
 *
 * Only the AES-256-GCM ciphertext ever reaches the browser, and the key lives
 * only in CREDENTIALS_ENC_KEY (env), so a stolen cookie is useless without it.
 */
const BASE = 'tb_sess';
const CHUNK = 3000; // keep each cookie comfortably under the 4KB limit
const MAX_CHUNKS = 12; // safety bound for clearing/reading
const MAX_AGE_S = 12 * 60 * 60; // mirror the session TTL (~12h)

function attrs(maxAgeS: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure}`;
}

export function writeSession(res: NextApiResponse, session: TenbisSession): void {
  const payload = encodeURIComponent(encrypt(JSON.stringify(session)));
  const chunks: string[] = [];
  for (let i = 0; i < payload.length; i += CHUNK) chunks.push(payload.slice(i, i + CHUNK));

  const cookies = chunks.map((c, i) => `${BASE}_${i}=${c}; ${attrs(MAX_AGE_S)}`);
  cookies.push(`${BASE}_n=${chunks.length}; ${attrs(MAX_AGE_S)}`);
  // Expire any stale chunks beyond the current count.
  for (let i = chunks.length; i < MAX_CHUNKS; i++) {
    cookies.push(`${BASE}_${i}=; ${attrs(0)}`);
  }
  appendSetCookie(res, cookies);
}

export function readSession(req: NextApiRequest): TenbisSession | null {
  const count = Number(req.cookies[`${BASE}_n`] ?? '0');
  if (!count || Number.isNaN(count)) return null;
  let payload = '';
  for (let i = 0; i < count; i++) {
    const part = req.cookies[`${BASE}_${i}`];
    if (part == null) return null;
    payload += part;
  }
  try {
    return JSON.parse(decrypt(decodeURIComponent(payload))) as TenbisSession;
  } catch {
    return null;
  }
}

export function clearSession(res: NextApiResponse): void {
  const cookies = [`${BASE}_n=; ${attrs(0)}`];
  for (let i = 0; i < MAX_CHUNKS; i++) cookies.push(`${BASE}_${i}=; ${attrs(0)}`);
  appendSetCookie(res, cookies);
}

function appendSetCookie(res: NextApiResponse, cookies: string[]): void {
  const existing = res.getHeader('Set-Cookie');
  const prior = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...prior, ...cookies]);
}
