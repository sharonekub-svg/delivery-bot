import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import type { ScoredDish } from '../domain/recommendation';
import type { Intent } from '../whatsapp/parser';

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: config.anthropic.apiKey() });
  return anthropic;
}

/**
 * Turn the engine's picked dishes into short, friendly WhatsApp blurbs.
 * Falls back to a plain description if the API call fails — recommendations
 * must never be blocked on copywriting.
 */
export async function describeOptions(picked: ScoredDish[]): Promise<string[]> {
  const fallback = picked.map(
    (p) => `${p.dish.name} — ${p.dish.restaurantName} · ₪${p.dish.priceNis}${p.dish.proteinG ? ` · ${p.dish.proteinG}g protein` : ''}`,
  );
  try {
    const list = picked
      .map((p, i) => `${i + 1}. ${p.dish.name} (${p.dish.restaurantName}, ₪${p.dish.priceNis}${p.dish.proteinG ? `, ${p.dish.proteinG}g protein` : ''}): ${p.dish.description ?? ''}`)
      .join('\n');
    const msg = await client().messages.create({
      model: config.anthropic.model,
      max_tokens: 300,
      system:
        'You write one-line, upbeat lunch blurbs for a WhatsApp bot. For each numbered dish return one line, same number, <=16 words, mention the health/macro angle naturally. No preamble.',
      messages: [{ role: 'user', content: list }],
    });
    const text = msg.content.filter((c) => c.type === 'text').map((c) => (c as any).text).join('\n');
    const lines = text.split('\n').map((l) => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
    return lines.length === picked.length ? lines : fallback;
  } catch {
    return fallback;
  }
}

const INTERPRETABLE_KINDS = new Set([
  'choose', 'skip', 'cancel', 'approve_budget', 'alternative', 'menu', 'prefs',
  'last_order', 'support', 'week_plan', 'stats', 'pause', 'resume', 'set_budget', 'add_exclusion',
]);

/**
 * Natural-language fallback for the keyword parser: when a user writes free
 * text ("בא לי לדלג היום", "cancel that order please"), ask Claude to map it to
 * one of the bot's intents. Returns null when unsure or when the API is
 * unavailable — the caller then falls back to showing the menu.
 */
export async function interpretIntent(text: string): Promise<Intent | null> {
  try {
    const msg = await client().messages.create({
      model: config.anthropic.model,
      max_tokens: 100,
      system: [
        'You map a WhatsApp message (Hebrew or English) from a lunch-ordering bot user to exactly one intent.',
        'Reply with ONLY a JSON object, no prose. Allowed kinds:',
        'choose (with "option": number), skip, cancel, approve_budget, alternative (user wants different/more options),',
        'menu, prefs, last_order, support, week_plan, stats, pause, resume,',
        'set_budget (with "amountNis": number), add_exclusion (with "item": string, the food to avoid).',
        'If the message clearly matches none of these, reply {"kind":"unknown"}.',
      ].join(' '),
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    });
    const raw = msg.content.filter((c) => c.type === 'text').map((c) => (c as any).text).join('');
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (!INTERPRETABLE_KINDS.has(json.kind)) return null;
    if (json.kind === 'choose' && !(Number.isInteger(json.option) && json.option > 0)) return null;
    if (json.kind === 'set_budget' && !(Number.isFinite(json.amountNis) && json.amountNis > 0)) return null;
    if (json.kind === 'add_exclusion' && typeof json.item !== 'string') return null;
    return json as Intent;
  } catch {
    return null;
  }
}
