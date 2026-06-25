import type { NextApiRequest, NextApiResponse } from 'next';
import { getTenbisClient } from '../../tenbis';
import { defaultPreferences } from '../../domain/preferences';
import { spendThisMonth } from '../../domain/history';
import { checkMonthlyBudget } from '../../domain/budget';
import type { Preferences } from '../../domain/types';
import type { TenbisBudget, TenbisSession } from '../../tenbis/types';

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

  const tenbis = getTenbisClient();
  const priceNis = Number(body.priceNis);

  // Monthly cap: keep the whole month's orders under the employer's monthly
  // limit. We read the limit + this month's spend live, so it holds even across
  // devices. Skipped when the user already approved going over, or when we can't
  // determine a price/limit.
  if (!body.approveOverBudget && Number.isFinite(priceNis) && priceNis > 0) {
    try {
      const [budget, history] = await Promise.all([
        tenbis.getBudget(session).catch((): TenbisBudget => ({})),
        tenbis.getHistory(session, 31).catch(() => []),
      ]);
      const check = checkMonthlyBudget(budget.monthlyNis, spendThisMonth(history), priceNis);
      if (!check.withinBudget) {
        return res.status(200).json({
          ok: false,
          result: {
            ok: false,
            errorCode: 'budget_exceeded',
            errorMessage: `ההזמנה תחרוג מהתקציב החודשי שלך — נשאר ₪${check.remainingNis} מתוך ₪${budget.monthlyNis} החודש.`,
          },
        });
      }
    } catch {
      /* if the live check fails, fall through to the per-order ceiling below */
    }
  }

  try {
    const result = await tenbis.placeOrder(session, {
      dishId,
      restaurantId,
      categoryId: body.categoryId ? String(body.categoryId) : undefined,
      addressId,
      includeBeverage: prefs.includeBeverage,
      maxTotalNis: body.approveOverBudget ? undefined : prefs.dailyBudgetNis,
      pickup: body.pickup === true,
      deliverAt: body.deliverAt ? String(body.deliverAt) : undefined,
      dontWantCutlery: body.dontWantCutlery === true,
      orderRemarks: body.orderRemarks ? String(body.orderRemarks) : undefined,
      useCoupons: body.useCoupons !== false, // default on — use available discounts
    });
    return res.status(200).json({ ok: result.ok, result });
  } catch (err) {
    console.error('order error', err);
    return res.status(500).json({ ok: false, error: 'ההזמנה נכשלה. נסו שוב.' });
  }
}
