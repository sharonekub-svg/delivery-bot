import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import { getTenbisClient } from '../tenbis';
import { recommend } from '../domain/recommendation';
import { checkBudget } from '../domain/budget';
import type { Preferences } from '../domain/types';
import type { TenbisDish, TenbisSession } from '../tenbis/types';

/**
 * The chatbot brain. A single conversational agent that interviews the user
 * about how they want to eat, records it into their Preferences, then pulls
 * live 10Bis dishes through the existing recommendation engine and (only on an
 * explicit OK) places the order.
 *
 * The server stays stateless: the full Anthropic message array is round-tripped
 * to the browser between turns. Preferences ride along the same way.
 */

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: config.anthropic.apiKey() });
  return anthropic;
}

export interface RecCard {
  dishId: string;
  restaurantId: string;
  categoryId?: string;
  dishName: string;
  restaurantName: string;
  priceNis: number;
  proteinG?: number;
  description?: string;
  deepLink?: string;
}

export interface OrderCard {
  ok: boolean;
  dishName?: string;
  restaurantName?: string;
  totalNis?: number;
  etaMinutes?: number;
  trackerDeepLink?: string;
  error?: string;
}

export interface ChatTurnResult {
  messages: Anthropic.MessageParam[];
  reply: string;
  preferences: Preferences;
  artifacts: { recommendations?: RecCard[]; order?: OrderCard };
}

const SYSTEM = `You are "Lunch Helper", a warm, upbeat food concierge for the Israeli 10Bis lunch service.
The user has already connected their 10Bis account, so you can browse the live menu and place a real order for them.

Your job is to interview them naturally — like a friend who's about to order lunch for them — and capture their tastes. Cover, over the course of the chat (not all at once):
- What they feel like eating today (mood/craving).
- Their dietary goal (lose weight, build muscle, just eat healthier, no goal).
- Protein target, if they care about it.
- Foods and cuisines they generally like.
- Favourite restaurants or go-to dishes.
- Allergies or anything they never want (this is a hard rule — never recommend it).
- Roughly how much they want to spend (daily budget in ₪).

Guidelines:
- Ask ONE or TWO questions at a time. Keep messages short and friendly. A little emoji is fine.
- As you learn things, call update_preferences to record them. Don't announce the tool calls.
- Use list_restaurants to see what's actually available and match the user's favourites to real restaurants.
- When you have enough to suggest something, call get_recommendations and present the top options conversationally (mention the protein/health angle and price).
- NEVER call place_order until the user has clearly confirmed a specific dish. After ordering, confirm cheerfully and share the tracking link if there is one.
- If a tool returns an error (e.g. session expired, restaurant closed), explain it plainly and suggest a next step.`;

const tools: Anthropic.Tool[] = [
  {
    name: 'update_preferences',
    description: 'Record or update what you have learned about the user. Call whenever you learn something new. Only include the fields you are updating.',
    input_schema: {
      type: 'object',
      properties: {
        macroFocus: { type: 'string', enum: ['balanced', 'high_protein', 'low_carb'], description: 'Nutritional focus.' },
        weeklyProteinTargetG: { type: 'number', description: 'Weekly protein target in grams, if they mention one.' },
        dailyBudgetNis: { type: 'number', description: 'Daily budget in NIS (₪).' },
        includeBeverage: { type: 'boolean' },
        exclusions: { type: 'array', items: { type: 'string' }, description: 'Allergens / things to NEVER include, e.g. ["gluten","nuts"]. Lowercase keywords.' },
        inclusions: { type: 'array', items: { type: 'string' }, description: 'Foods/cuisines they like, e.g. ["sushi","grilled chicken"].' },
        favoriteRestaurantNames: { type: 'array', items: { type: 'string' }, description: 'Favourite restaurants or go-to dishes they name.' },
      },
    },
  },
  {
    name: 'list_restaurants',
    description: 'List 10Bis restaurants currently delivering to the user, so you can match their favourites to real options.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recommendations',
    description: 'Get the best dish options right now from the live 10Bis menu, scored against the user\'s preferences. Optionally focus a single restaurant by id.',
    input_schema: {
      type: 'object',
      properties: {
        restaurantId: { type: 'string', description: 'Optional: limit to one restaurant (id from list_restaurants).' },
      },
    },
  },
  {
    name: 'place_order',
    description: 'Place a REAL 10Bis order. Only call after the user explicitly confirms a specific dish.',
    input_schema: {
      type: 'object',
      properties: {
        dishId: { type: 'string' },
        restaurantId: { type: 'string' },
        categoryId: { type: 'string' },
        approveOverBudget: { type: 'boolean', description: 'Set true only if the user explicitly agreed to go over their daily budget.' },
      },
      required: ['dishId', 'restaurantId'],
    },
  },
];

interface ToolCtx {
  prefs: Preferences;
  addressId: string;
  session: TenbisSession;
  /** Dishes seen this turn, so place_order can resolve names/prices/categories. */
  dishIndex: Map<string, TenbisDish>;
  artifacts: { recommendations?: RecCard[]; order?: OrderCard };
}

/** Pull dishes from a set of restaurants for the address, capping network fan-out. */
async function gatherDishes(ctx: ToolCtx, restaurantId?: string): Promise<TenbisDish[]> {
  const tenbis = getTenbisClient();
  if (restaurantId) {
    return tenbis.getAvailableDishes(ctx.session, ctx.addressId, restaurantId);
  }
  const restaurants = (await tenbis.getRestaurants(ctx.session, ctx.addressId)).filter((r) => r.isOpenNow);
  const favs = (ctx.prefs.favoriteRestaurantNames ?? []).map((s) => s.toLowerCase());
  const ranked = restaurants.sort((a, b) => {
    const af = favs.some((f) => a.name.toLowerCase().includes(f) || f.includes(a.name.toLowerCase())) ? 0 : 1;
    const bf = favs.some((f) => b.name.toLowerCase().includes(f) || f.includes(b.name.toLowerCase())) ? 0 : 1;
    return af - bf;
  });
  const dishes: TenbisDish[] = [];
  for (const r of ranked.slice(0, 5)) {
    try {
      dishes.push(...(await tenbis.getAvailableDishes(ctx.session, ctx.addressId, r.id)));
    } catch {
      /* skip restaurants whose menu fails to load */
    }
  }
  return dishes;
}

async function runTool(name: string, input: any, ctx: ToolCtx): Promise<any> {
  switch (name) {
    case 'update_preferences': {
      const p = ctx.prefs;
      if (input.macroFocus) p.macroFocus = input.macroFocus;
      if (typeof input.weeklyProteinTargetG === 'number') p.weeklyProteinTargetG = input.weeklyProteinTargetG;
      if (typeof input.dailyBudgetNis === 'number') { p.dailyBudgetNis = input.dailyBudgetNis; p.budgetIsManual = true; }
      if (typeof input.includeBeverage === 'boolean') p.includeBeverage = input.includeBeverage;
      if (Array.isArray(input.exclusions)) p.exclusions = Array.from(new Set([...p.exclusions, ...input.exclusions.map((s: string) => s.toLowerCase())]));
      if (Array.isArray(input.inclusions)) p.inclusions = Array.from(new Set([...p.inclusions, ...input.inclusions]));
      if (Array.isArray(input.favoriteRestaurantNames)) p.favoriteRestaurantNames = Array.from(new Set([...(p.favoriteRestaurantNames ?? []), ...input.favoriteRestaurantNames]));
      return { ok: true, preferences: p };
    }
    case 'list_restaurants': {
      const restaurants = await getTenbisClient().getRestaurants(ctx.session, ctx.addressId);
      return { restaurants: restaurants.map((r) => ({ id: r.id, name: r.name, open: r.isOpenNow, etaMinutes: r.deliveryEtaMinutes })) };
    }
    case 'get_recommendations': {
      const dishes = await gatherDishes(ctx, input.restaurantId);
      for (const d of dishes) ctx.dishIndex.set(d.id, d);
      const tenbis = getTenbisClient();
      const history = await tenbis.getHistory(ctx.session, 30).catch(() => []);
      const picks = recommend(dishes, ctx.prefs, history);
      const cards: RecCard[] = picks.map((s) => ({
        dishId: s.dish.id,
        restaurantId: s.dish.restaurantId,
        categoryId: s.dish.categoryId,
        dishName: s.dish.name,
        restaurantName: s.dish.restaurantName,
        priceNis: s.dish.priceNis,
        proteinG: s.dish.proteinG,
        description: s.dish.description,
        deepLink: s.dish.deepLink,
      }));
      ctx.artifacts.recommendations = cards;
      return { count: cards.length, recommendations: cards };
    }
    case 'place_order': {
      const dish = ctx.dishIndex.get(String(input.dishId));
      const tenbis = getTenbisClient();
      const maxTotalNis = input.approveOverBudget ? undefined : ctx.prefs.dailyBudgetNis;
      if (dish && !input.approveOverBudget) {
        const budget = checkBudget(dish, ctx.prefs);
        if (!budget.withinBudget) {
          return { ok: false, error: `That dish is ₪${budget.overByNis} over the daily budget of ₪${ctx.prefs.dailyBudgetNis}. Ask the user if they want to go over budget, then retry with approveOverBudget=true.` };
        }
      }
      const result = await tenbis.placeOrder(ctx.session, {
        dishId: String(input.dishId),
        restaurantId: String(input.restaurantId),
        categoryId: input.categoryId ? String(input.categoryId) : dish?.categoryId,
        addressId: ctx.addressId,
        includeBeverage: ctx.prefs.includeBeverage,
        maxTotalNis,
      });
      const card: OrderCard = result.ok
        ? { ok: true, dishName: dish?.name, restaurantName: dish?.restaurantName, totalNis: result.totalNis ?? dish?.priceNis, etaMinutes: result.etaMinutes, trackerDeepLink: result.trackerDeepLink }
        : { ok: false, error: result.errorMessage ?? result.errorCode ?? 'unknown error' };
      ctx.artifacts.order = card;
      return result.ok ? { ok: true, order: card } : { ok: false, error: card.error };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  return content.filter((c) => c.type === 'text').map((c) => (c as Anthropic.TextBlock).text).join('\n').trim();
}

export async function runChatTurn(opts: {
  messages: Anthropic.MessageParam[];
  preferences: Preferences;
  addressId: string;
  session: TenbisSession;
}): Promise<ChatTurnResult> {
  const ctx: ToolCtx = {
    prefs: { ...opts.preferences },
    addressId: opts.addressId,
    session: opts.session,
    dishIndex: new Map(),
    artifacts: {},
  };
  const messages: Anthropic.MessageParam[] = [...opts.messages];

  let reply = '';
  // Agent loop: let the model call tools until it returns a plain text reply.
  for (let i = 0; i < 8; i++) {
    const res = await client().messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system: SYSTEM,
      tools,
      messages,
    });
    messages.push({ role: 'assistant', content: res.content });

    if (res.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== 'tool_use') continue;
        let out: any;
        try {
          out = await runTool(block.name, block.input, ctx);
        } catch (err) {
          out = { error: (err as Error).message };
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    reply = textOf(res.content);
    break;
  }

  return { messages, reply, preferences: ctx.prefs, artifacts: ctx.artifacts };
}
