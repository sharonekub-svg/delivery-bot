/**
 * Client-side "memory". The whole point of the app per the user: fill in your
 * taste profile once and the site remembers it. We keep it (and the validated
 * 10Bis session) in localStorage on the user's own device — no server database.
 */
const KEYS = { session: 'lh_session', prefs: 'lh_prefs', address: 'lh_address' } as const;

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export interface StoredProfile {
  inclusions: string[];
  exclusions: string[];
  favoriteRestaurantNames: string[];
  macroFocus: 'balanced' | 'high_protein' | 'low_carb';
  goal?: string;
  weeklyProteinTargetG?: number;
  dailyBudgetNis: number;
  includeBeverage: boolean;
  /** Preferred ordering window, local HH:mm. */
  timeFrom: string;
  timeTo: string;
  /** Days the bot is allowed to order on (0=Sun..6=Sat). Default work days. */
  activeDays: number[];
  /** 'autopilot' = order on its own; 'ask' = ask for approval first. */
  mode: 'ask' | 'autopilot';
  /** How many times per week the user wants to order (informational). */
  ordersPerWeek?: number;
  /** When on, the bot times delivery around the connected calendar's meetings. */
  scheduleAroundMeetings?: boolean;
  /** ICS feed URL (e.g. Google Calendar secret iCal address) used for timing. */
  calendarUrl?: string;
}

export const store = {
  getSession: () => read<{ token: string; expiresAt: number }>(KEYS.session),
  setSession: (s: unknown) => write(KEYS.session, s),
  getProfile: () => read<StoredProfile>(KEYS.prefs),
  setProfile: (p: StoredProfile) => write(KEYS.prefs, p),
  getAddress: () => read<string>(KEYS.address),
  setAddress: (id: string) => write(KEYS.address, id),
  clear: () => {
    if (typeof window === 'undefined') return;
    Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  },
};
