import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * The chatbot. Stateless server, so the browser holds the canonical Anthropic
 * message array (`apiMessages`) and the user's preferences, and round-trips
 * them with every turn. `log` is the human-facing view (text bubbles + cards).
 */
interface RecCard {
  dishId: string; restaurantId: string; categoryId?: string; dishName: string;
  restaurantName: string; priceNis: number; proteinG?: number; description?: string; deepLink?: string;
}
interface OrderCard {
  ok: boolean; dishName?: string; restaurantName?: string; totalNis?: number; etaMinutes?: number; trackerDeepLink?: string; error?: string;
}
type LogItem =
  | { kind: 'text'; role: 'user' | 'assistant'; text: string }
  | { kind: 'recs'; recs: RecCard[] }
  | { kind: 'order'; order: OrderCard };

const GREETING =
  "Hey! 👋 I'm your Lunch Helper. I'll find — and order — a lunch you'll actually love.\n\nTo start: what are you in the mood for today, and do you have any goal in mind (more protein, lighter meal, just something tasty)?";

export default function Chat() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [addresses, setAddresses] = useState<{ id: string; label: string }[]>([]);
  const [addressId, setAddressId] = useState('');
  const [apiMessages, setApiMessages] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<any>({});
  const [log, setLog] = useState<LogItem[]>([{ kind: 'text', role: 'assistant', text: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) => {
        if (!d.connected) { router.replace('/connect'); return; }
        setAddresses(d.addresses ?? []);
        setAddressId(d.addresses?.[0]?.id ?? '');
        setReady(true);
      })
      .catch(() => router.replace('/connect'));
  }, [router]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput('');
    const nextApi = [...apiMessages, { role: 'user', content }];
    setApiMessages(nextApi);
    setLog((l) => [...l, { kind: 'text', role: 'user', text: content }]);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextApi, preferences: prefs, addressId }),
      });
      const data = await res.json();
      if (res.status === 401) { router.replace('/connect'); return; }
      if (!res.ok || !data.ok) {
        setLog((l) => [...l, { kind: 'text', role: 'assistant', text: `⚠️ ${data.error ?? 'Something went wrong.'}` }]);
        return;
      }
      setApiMessages(data.messages);
      setPrefs(data.preferences);
      const adds: LogItem[] = [];
      if (data.reply) adds.push({ kind: 'text', role: 'assistant', text: data.reply });
      if (data.artifacts?.recommendations?.length) adds.push({ kind: 'recs', recs: data.artifacts.recommendations });
      if (data.artifacts?.order) adds.push({ kind: 'order', order: data.artifacts.order });
      setLog((l) => [...l, ...adds]);
    } catch {
      setLog((l) => [...l, { kind: 'text', role: 'assistant', text: '⚠️ Network error — please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main style={wrap}><p style={{ color: '#64748b' }}>Loading…</p></main>;

  return (
    <main style={wrap}>
      <header style={header}>
        <div style={{ fontWeight: 700 }}>🍽️ Lunch Helper</div>
        {addresses.length > 0 && (
          <select value={addressId} onChange={(e) => setAddressId(e.target.value)} style={addrSel}>
            {addresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        )}
      </header>

      <div style={feed}>
        {log.map((item, i) => {
          if (item.kind === 'text') return <Bubble key={i} role={item.role} text={item.text} />;
          if (item.kind === 'recs') return <Recs key={i} recs={item.recs} onPick={(r) => send(`Let's order the ${r.dishName} from ${r.restaurantName}.`)} disabled={busy} />;
          return <Order key={i} order={item.order} />;
        })}
        {busy && <Bubble role="assistant" text="…" />}
        <div ref={endRef} />
      </div>

      <form
        style={composer}
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me what you feel like…"
          style={inputBox}
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()} style={{ ...sendBtn, opacity: busy || !input.trim() ? 0.5 : 1 }}>Send</button>
      </form>
    </main>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const mine = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', margin: '6px 0' }}>
      <div style={{
        maxWidth: '78%', whiteSpace: 'pre-wrap', lineHeight: 1.4, padding: '10px 14px', borderRadius: 16,
        background: mine ? '#f97316' : '#fff', color: mine ? '#fff' : '#0f172a',
        border: mine ? 'none' : '1px solid #e2e8f0', borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4,
      }}>{text}</div>
    </div>
  );
}

function Recs({ recs, onPick, disabled }: { recs: RecCard[]; onPick: (r: RecCard) => void; disabled: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 10, margin: '8px 0' }}>
      {recs.map((r) => (
        <div key={r.dishId} style={recCard}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{r.dishName}</div>
            <div style={{ color: '#64748b', fontSize: 14 }}>{r.restaurantName}</div>
            {r.description && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{r.description}</div>}
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <span style={pill}>₪{r.priceNis}</span>
              {r.proteinG != null && <span style={pill}>{r.proteinG}g protein</span>}
            </div>
          </div>
          <button onClick={() => onPick(r)} disabled={disabled} style={orderBtn}>Order this</button>
        </div>
      ))}
    </div>
  );
}

function Order({ order }: { order: OrderCard }) {
  if (!order.ok) {
    return <div style={{ ...orderBox, borderColor: '#fecaca', background: '#fef2f2' }}>❌ Order failed: {order.error}</div>;
  }
  return (
    <div style={{ ...orderBox, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ Order placed!</div>
      <div>{order.dishName}{order.restaurantName ? ` — ${order.restaurantName}` : ''}</div>
      <div style={{ color: '#64748b', fontSize: 14 }}>
        {order.totalNis != null && `₪${order.totalNis}`}
        {order.etaMinutes != null && ` · ~${order.etaMinutes} min`}
      </div>
      {order.trackerDeepLink && <a href={order.trackerDeepLink} target="_blank" rel="noreferrer" style={{ color: '#16a34a', fontSize: 14 }}>Track your order →</a>}
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 680, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column',
  fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a', background: '#f8fafc',
};
const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff',
};
const addrSel: React.CSSProperties = { fontSize: 13, padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', maxWidth: 220 };
const feed: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '16px' };
const composer: React.CSSProperties = { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e2e8f0', background: '#fff' };
const inputBox: React.CSSProperties = { flex: 1, padding: '12px 14px', fontSize: 16, borderRadius: 24, border: '1px solid #cbd5e1', outline: 'none' };
const sendBtn: React.CSSProperties = { background: '#f97316', color: '#fff', border: 'none', borderRadius: 24, padding: '0 22px', fontSize: 16, fontWeight: 600, cursor: 'pointer' };
const recCard: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 };
const pill: React.CSSProperties = { display: 'inline-block', background: '#f1f5f9', borderRadius: 999, padding: '2px 10px', marginRight: 6, fontSize: 12, fontWeight: 600, color: '#475569' };
const orderBtn: React.CSSProperties = { flex: '0 0 auto', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const orderBox: React.CSSProperties = { border: '1px solid', borderRadius: 14, padding: 14, margin: '8px 0' };
