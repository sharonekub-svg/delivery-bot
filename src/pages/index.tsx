import Link from 'next/link';
import { motion } from 'framer-motion';
import FadingVideo from '../components/FadingVideo';
import BlurText from '../components/BlurText';

const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4';
const CAP_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4';

const ease = [0.16, 1, 0.3, 1] as const;
const intro = (delay: number) => ({
  initial: { filter: 'blur(10px)', opacity: 0, y: 20 },
  whileInView: { filter: 'blur(0px)', opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease, delay },
});

function ArrowUpRight({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" /><path d="M7 7h10v10" />
    </svg>
  );
}
function Play({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>;
}
function MaterialIcon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" width={24} height={24}><path d={d} /></svg>;
}

const NAV = ['בית', 'איך זה עובד', 'יכולות', 'וואטסאפ', 'תמיכה'];
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER; // e.g. 972501234567
const CUISINES = ['סושי', 'המבורגר', 'פיצה', 'סלט', 'בשר'];

const CARDS = [
  {
    icon: 'M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21H5Zm1-4h12l-3.75-5-3 4L9 13l-3 4Z',
    tags: ['בלי סיסמה', 'הדבקה אחת', 'פחות מדקה', 'מאובטח'],
    title: 'חיבור מהיר',
    body: 'מעתיקים בקשה אחת מתן ביס דרך כלי הפיתוח של הדפדפן ומדביקים. בלי סיסמאות, בלי מפתחות, בלי מסד נתונים.',
  },
  {
    icon: 'M4 6.47 5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.89-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4Z',
    tags: ['מטרות', 'יעד חלבון', 'אלרגיות', 'תקציב'],
    title: 'פרופיל שנזכר',
    body: 'ממלאים פעם אחת את הטעם, המטרות, החלבון, המסעדות האהובות והאלרגיות — והאתר זוכר את זה לכל פעם הבאה.',
  },
  {
    icon: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1Zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7Z',
    tags: ['בחירה חכמה', 'פירוט מלא', 'לחיצה אחת', 'הזמנה אמיתית'],
    title: 'הזמנה בלחיצה',
    body: 'הבוט מציע מהתפריט החי של תן ביס לפי המטרות שלך — מסעדה, זמן משלוח, חלבון ותיאור — ומזמין כשאתה מאשר.',
  },
  {
    icon: 'M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l5.06-1.33A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Zm0 18c-1.6 0-3.1-.47-4.36-1.28l-.31-.19-3 .79.8-2.93-.2-.32A7.94 7.94 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8Z',
    tags: ['הצעה כל בוקר', 'טייס אוטומטי', '"עוד" ו"שבוע"', 'עברית חופשית'],
    title: 'גם בוואטסאפ',
    body: 'הבוט כותב לך כל בוקר עם ההצעות של היום, מבין עברית חופשית — "כן", "עוד", "בלי גלוטן", "תקציב 50" — ואפילו מתכנן שבוע שלם מראש.',
  },
];

export default function Home() {
  return (
    <div style={{ background: '#000' }}>
      {/* ===== Hero ===== */}
      <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <FadingVideo
          src={HERO_VIDEO}
          className="hero-video"
          style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', objectFit: 'cover', objectPosition: 'top', zIndex: 0, width: '120%', height: '120%' }}
        />

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Navbar */}
          <nav style={{ position: 'fixed', top: 16, insetInline: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(20px, 5vw, 64px)', zIndex: 50 }}>
            <div className="liquid-glass" style={{ width: 48, height: 48, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="font-heading" style={{ fontSize: 26, lineHeight: 1 }}>ל</span>
            </div>
            <div className="liquid-glass nav-pill" style={{ borderRadius: 9999, padding: 6, alignItems: 'center', gap: 2 }}>
              {NAV.map((n) => (
                <span key={n} className="font-body" style={{ padding: '8px 12px', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{n}</span>
              ))}
              <Link href="/connect" className="font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', color: '#000', borderRadius: 9999, padding: '8px 14px', fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                התחברו <ArrowUpRight size={16} />
              </Link>
            </div>
            <div style={{ width: 48, height: 48 }} />
          </nav>

          {/* Hero content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '96px 16px 0' }}>
            <motion.div {...intro(0.4)} className="liquid-glass" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 9999 }}>
              <span style={{ background: '#fff', color: '#000', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>חדש</span>
              <span className="font-body" style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', paddingInlineEnd: 12 }}>העוזר החכם להזמנת צהריים בתן ביס</span>
            </motion.div>

            <BlurText
              text="הצהריים המושלמים שלך בלחיצה אחת"
              className="font-heading"
              style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)', color: '#fff', lineHeight: 0.9, maxWidth: '14ch', letterSpacing: '-2px', marginTop: 20 }}
            />

            <motion.p {...intro(0.8)} className="font-body" style={{ marginTop: 16, fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', color: '#fff', maxWidth: '46ch', fontWeight: 300, lineHeight: 1.4 }}>
              מתחברים לתן ביס, ממלאים פעם אחת את העדפות הטעם — והאתר זוכר, ממליץ ומזמין לפי המטרות, החלבון והתקציב שלך. בלי סיסמאות ובלי מסד נתונים.
            </motion.p>

            <motion.div {...intro(1.1)} style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 24 }}>
              <Link href="/connect" className="liquid-glass-strong font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9999, padding: '10px 20px', fontSize: 14, fontWeight: 500, color: '#fff', textDecoration: 'none' }}>
                התחברו לתן ביס <ArrowUpRight size={20} />
              </Link>
              <Link href="/connect" className="font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#fff', textDecoration: 'none' }}>
                איך זה עובד <Play size={16} />
              </Link>
            </motion.div>

            <motion.div {...intro(1.3)} style={{ display: 'flex', alignItems: 'stretch', gap: 16, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { d: 'M12 8v5l3 2', circle: true, num: 'פחות מדקה', label: 'זמן ההתחברות' },
                { num: '0', label: 'סיסמאות או מפתחות' },
              ].map((s, i) => (
                <div key={i} className="liquid-glass" style={{ padding: 20, width: 220, borderRadius: 20, textAlign: 'start' }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6}>
                    {i === 0 ? <><circle cx={12} cy={12} r={9} /><path d="M12 8v5l3 2" strokeLinecap="round" /></> : <><circle cx={12} cy={12} r={9} /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>}
                  </svg>
                  <div className="font-heading" style={{ fontSize: '2.25rem', letterSpacing: '-1px', lineHeight: 1, marginTop: 12 }}>{s.num}</div>
                  <div className="font-body" style={{ fontSize: 12, color: '#fff', fontWeight: 300, marginTop: 8 }}>{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Partners */}
          <motion.div {...intro(1.4)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingBottom: 32 }}>
            <div className="liquid-glass font-body" style={{ borderRadius: 9999, padding: '4px 14px', fontSize: 12, fontWeight: 500, color: '#fff' }}>עובד מול התפריט החי של תן ביס</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(28px, 6vw, 64px)' }}>
              {CUISINES.map((c) => (
                <span key={c} className="font-heading" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.875rem)', color: '#fff', letterSpacing: '-0.5px' }}>{c}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== Capabilities ===== */}
      <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
        <FadingVideo src={CAP_VIDEO} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 10, padding: 'clamp(96px,12vh,120px) clamp(20px,6vw,80px) 40px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <div style={{ marginBottom: 'auto' }}>
            <motion.div {...intro(0)} className="font-body" style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 24 }}>// יכולות</motion.div>
            <motion.h2 {...intro(0.1)} className="font-heading" style={{ color: '#fff', fontSize: 'clamp(3rem, 9vw, 6rem)', lineHeight: 0.95, letterSpacing: '-3px', margin: 0 }}>
              הזמנה,<br />התפתחה
            </motion.h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginTop: 64 }}>
            {CARDS.map((c, i) => (
              <motion.div key={c.title} {...intro(0.15 * i)} className="liquid-glass" style={{ borderRadius: 20, padding: 24, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div className="liquid-glass" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto' }}>
                    <MaterialIcon d={c.icon} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: '70%' }}>
                    {c.tags.map((t) => (
                      <span key={t} className="liquid-glass font-body" style={{ borderRadius: 9999, padding: '4px 12px', fontSize: 11, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ marginTop: 24 }}>
                  <h3 className="font-heading" style={{ color: '#fff', fontSize: 'clamp(1.5rem,4vw,2.25rem)', letterSpacing: '-1px', lineHeight: 1, margin: 0 }}>{c.title}</h3>
                  <p className="font-body" style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 300, lineHeight: 1.4, maxWidth: '32ch' }}>{c.body}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 56, flexWrap: 'wrap' }}>
            <Link href="/connect" className="liquid-glass-strong font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9999, padding: '12px 24px', fontSize: 15, fontWeight: 500, color: '#fff', textDecoration: 'none' }}>
              בואו נתחיל <ArrowUpRight size={20} />
            </Link>
            {WHATSAPP_NUMBER ? (
              <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('התחל')}`} target="_blank" rel="noreferrer" className="liquid-glass font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9999, padding: '12px 24px', fontSize: 15, fontWeight: 500, color: '#fff', textDecoration: 'none' }}>
                💬 דברו איתי בוואטסאפ
              </a>
            ) : (
              <Link href="/bot" className="liquid-glass font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9999, padding: '12px 24px', fontSize: 15, fontWeight: 500, color: '#fff', textDecoration: 'none' }}>
                💬 נסו את הבוט עכשיו
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
