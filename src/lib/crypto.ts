import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM encryption for 10Bis credentials/tokens at rest (PRD §4.4).
 *
 * Key comes from CREDENTIALS_ENC_KEY (64 hex chars = 32 bytes). The key lives
 * only in Vercel env vars — never in the database, never in git. Ciphertext is
 * stored as: base64(iv).base64(authTag).base64(ciphertext).
 */
const ALGO = 'aes-256-gcm';

function key(): Buffer {
  const hex = process.env.CREDENTIALS_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('CREDENTIALS_ENC_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
