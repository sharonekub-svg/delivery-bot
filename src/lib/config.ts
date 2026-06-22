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

  twilio: {
    accountSid: () => required('TWILIO_ACCOUNT_SID'),
    authToken: () => required('TWILIO_AUTH_TOKEN'),
    from: () => required('TWILIO_WHATSAPP_FROM'),
  },

  anthropic: {
    apiKey: () => required('ANTHROPIC_API_KEY'),
    model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
  },
};
