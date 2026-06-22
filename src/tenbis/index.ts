import type { TenbisClient } from './client';
import { MockTenbisClient } from './mock';
import { LocalTenbisClient } from './local';

let singleton: TenbisClient | null = null;

/** Returns the configured 10Bis client. TENBIS_CLIENT=mock|local. */
export function getTenbisClient(): TenbisClient {
  if (singleton) return singleton;
  const which = process.env.TENBIS_CLIENT ?? 'mock';
  singleton = which === 'local' ? new LocalTenbisClient() : new MockTenbisClient();
  return singleton;
}

export type { TenbisClient };
