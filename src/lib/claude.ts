import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import type { ScoredDish } from '../domain/recommendation';

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
