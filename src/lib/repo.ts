import { db } from './supabase';
import { decrypt, encrypt } from './crypto';
import { defaultPreferences } from '../domain/preferences';
import type { OrderRecord, Preferences, User } from '../domain/types';
import type { TenbisSession } from '../tenbis/types';

/** Find or create a user by their WhatsApp phone (the primary unique ID). */
export async function getOrCreateUser(phone: string): Promise<User> {
  const sb = db();
  const existing = await sb.from('users').select('*').eq('whatsapp_phone', phone).maybeSingle();
  if (existing.data) return rowToUser(existing.data);
  const created = await sb
    .from('users')
    .insert({ whatsapp_phone: phone, onboarding_complete: false })
    .select('*')
    .single();
  if (created.error) throw created.error;
  // Seed default preferences.
  await sb.from('preferences').insert({ user_id: created.data.id, data: defaultPreferences() });
  return rowToUser(created.data);
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  const { data } = await db().from('users').select('*').eq('whatsapp_phone', phone).maybeSingle();
  return data ? rowToUser(data) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data } = await db().from('users').select('*').eq('id', id).maybeSingle();
  return data ? rowToUser(data) : null;
}

/** All onboarded users due for a daily prompt; cron fans out over these. */
export async function getOnboardedUsers(): Promise<User[]> {
  const { data } = await db().from('users').select('*').eq('onboarding_complete', true);
  return (data ?? []).map(rowToUser);
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const { data } = await db().from('preferences').select('data').eq('user_id', userId).maybeSingle();
  return { ...defaultPreferences(), ...(data?.data ?? {}) };
}

export async function savePreferences(userId: string, prefs: Preferences): Promise<void> {
  const { error } = await db()
    .from('preferences')
    .upsert({ user_id: userId, data: prefs }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function markOnboarded(userId: string): Promise<void> {
  await db().from('users').update({ onboarding_complete: true }).eq('id', userId);
}

// ---- Encrypted 10Bis session storage (PRD §4.4) ----

export async function saveSession(userId: string, session: TenbisSession): Promise<void> {
  const { error } = await db()
    .from('food_app_tokens')
    .upsert(
      { user_id: userId, encrypted_token: encrypt(JSON.stringify(session)), expires_at: new Date(session.expiresAt).toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

export async function loadSession(userId: string): Promise<TenbisSession | null> {
  const { data } = await db().from('food_app_tokens').select('encrypted_token').eq('user_id', userId).maybeSingle();
  if (!data?.encrypted_token) return null;
  return JSON.parse(decrypt(data.encrypted_token)) as TenbisSession;
}

// ---- Orders ----

export async function createOrder(o: Omit<OrderRecord, 'id' | 'createdAt'>): Promise<OrderRecord> {
  const { data, error } = await db()
    .from('orders')
    .insert({
      user_id: o.userId,
      dish_id: o.dishId,
      dish_name: o.dishName,
      restaurant_id: o.restaurantId,
      restaurant_name: o.restaurantName,
      price_nis: o.priceNis,
      status: o.status,
      tenbis_order_id: o.tenbisOrderId,
      tracker_deep_link: o.trackerDeepLink,
      execute_at: o.executeAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToOrder(data);
}

export async function updateOrder(id: string, patch: Partial<OrderRecord>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.tenbisOrderId) row.tenbis_order_id = patch.tenbisOrderId;
  if (patch.trackerDeepLink) row.tracker_deep_link = patch.trackerDeepLink;
  await db().from('orders').update(row).eq('id', id);
}

export async function lastOrder(userId: string): Promise<OrderRecord | null> {
  const { data } = await db()
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'placed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToOrder(data) : null;
}

/** Autopilot orders whose cancel window has elapsed and are ready to execute. */
export async function duePendingOrders(now: Date): Promise<OrderRecord[]> {
  const { data } = await db()
    .from('orders')
    .select('*')
    .eq('status', 'autopilot_pending')
    .lte('execute_at', now.toISOString());
  return (data ?? []).map(rowToOrder);
}

/** Today's suggested options, in the order they were offered (option 1, 2, ...). */
export async function todaysSuggestions(userId: string): Promise<OrderRecord[]> {
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data } = await db()
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'suggested')
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  return (data ?? []).map(rowToOrder);
}

export async function pendingOrderForUser(userId: string): Promise<OrderRecord | null> {
  const { data } = await db()
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['autopilot_pending', 'awaiting_confirmation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToOrder(data) : null;
}

// ---- row mappers ----
function rowToUser(r: any): User {
  return { id: r.id, whatsappPhone: r.whatsapp_phone, displayName: r.display_name ?? undefined, onboardingComplete: r.onboarding_complete, createdAt: r.created_at };
}
function rowToOrder(r: any): OrderRecord {
  return {
    id: r.id,
    userId: r.user_id,
    dishId: r.dish_id,
    dishName: r.dish_name,
    restaurantId: r.restaurant_id,
    restaurantName: r.restaurant_name,
    priceNis: r.price_nis,
    status: r.status,
    tenbisOrderId: r.tenbis_order_id ?? undefined,
    trackerDeepLink: r.tracker_deep_link ?? undefined,
    executeAt: r.execute_at ?? undefined,
    createdAt: r.created_at,
  };
}
