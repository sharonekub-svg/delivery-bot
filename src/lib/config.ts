/** Centralised, validated access to environment configuration. */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  timezone: process.env.APP_TIMEZONE ?? 'Asia/Jerusalem',
  cronSecret: process.env.CRON_SECRET ?? '',

  supabase: {
    url: () => required('SUPABASE_URL'),
    serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  },

  // WhatsApp via Meta (Facebook) Cloud API — free tier.
  whatsapp: {
    phoneNumberId: () => required('WHATSAPP_PHONE_NUMBER_ID'),
    accessToken: () => required('WHATSAPP_ACCESS_TOKEN'),
    verifyToken: () => required('WHATSAPP_VERIFY_TOKEN'),
    appSecret: () => process.env.WHATSAPP_APP_SECRET ?? '',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0',
    // Approved template used for the proactive daily nudge (cold-start outside
    // the 24h customer-service window). One body parameter carries the text.
    dailyTemplate: process.env.WHATSAPP_DAILY_TEMPLATE ?? '',
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? 'he',
  },

  anthropic: {
    apiKey: () => required('ANTHROPIC_API_KEY'),
    model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
  },
};
