import type { TenbisClient } from './client';
import { MockTenbisClient } from './mock';
import { LocalTenbisClient } from './local';

let singleton: TenbisClient | null = null;

/** Returns the configured 10Bis client. TENBIS_CLIENT=mock|local (default local). */
export function getTenbisClient(): TenbisClient {
  if (singleton) return singleton;
  const which = process.env.TENBIS_CLIENT ?? 'local';
  singleton = which === 'mock' ? new MockTenbisClient() : new LocalTenbisClient();
  return singleton;
}

export type { TenbisClient };
