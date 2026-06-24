import type { NextApiRequest, NextApiResponse } from 'next';
import { getTenbisClient } from '../../tenbis';
import { defaultPreferences } from '../../domain/preferences';
import type { Preferences } from '../../domain/types';
import type { TenbisSession } from '../../tenbis/types';

/**
 * Place a real 10Bis order for a dish the user picked. The daily budget is a
 * hard ceiling unless the user explicitly approved going over.
 */
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const body = req.body ?? {};
  const session = body.session as TenbisSession | undefined;
  if (!session?.token) return res.status(401).json({ ok: false, error: 'not_connected' });

  const prefs: Preferences = { ...defaultPreferences(), ...(body.preferences ?? {}) };
  const addressId = String(body.addressId ?? '');
  const dishId = String(body.dishId ?? '');
  const restaurantId = String(body.restaurantId ?? '');
  if (!addressId || !dishId || !restaurantId) return res.status(400).json({ ok: false, error: 'missing_fields' });

  try {
    const result = await getTenbisClient().placeOrder(session, {
      dishId,
      restaurantId,
      categoryId: body.categoryId ? String(body.categoryId) : undefined,
      addressId,
      includeBeverage: prefs.includeBeverage,
      maxTotalNis: body.approveOverBudget ? undefined : prefs.dailyBudgetNis,
    });
    return res.status(200).json({ ok: result.ok, result });
  } catch (err) {
    console.error('order error', err);
    return res.status(500).json({ ok: false, error: 'The order failed. Please try again.' });
  }
}
