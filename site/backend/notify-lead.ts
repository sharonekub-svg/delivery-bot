// Supabase Edge Function — שולחת בדוא"ל כל פנייה חדשה מטופס "צרו קשר".
//
// פריסה:
//   supabase functions deploy notify-lead --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=... LEAD_TO=Roy@kubovsky.co.il LEAD_FROM=site@kubovsky.co.il
//
// אחרי הפריסה יש להעתיק את כתובת הפונקציה אל SITE_CONFIG.formEndpoint שב-site/index.html.
// פירוט מלא: site/backend/README.md

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface Lead {
  full_name?: string;
  email?: string;
  phone?: string | null;
  message?: string | null;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("LEAD_TO");
  const from = Deno.env.get("LEAD_FROM");
  if (!apiKey || !to || !from) {
    return new Response(JSON.stringify({ error: "missing configuration" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let lead: Lead;
  try {
    const body = await req.json();
    lead = (body?.lead ?? body) as Lead;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const name = (lead.full_name || "").trim();
  const email = (lead.email || "").trim();
  if (!name || !email) {
    return new Response(JSON.stringify({ error: "missing name or email" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const rows: Array<[string, string]> = [
    ["שם", name],
    ["אימייל", email],
    ["טלפון", (lead.phone || "").trim() || "—"],
    ["הודעה", (lead.message || "").trim() || "—"],
  ];

  const html =
    `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">` +
    `<h2 style="margin:0 0 12px">פנייה חדשה מהאתר</h2>` +
    rows
      .map(([k, v]) => `<p style="margin:0 0 8px"><strong>${k}:</strong> ${escapeHtml(v)}</p>`)
      .join("") +
    `</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `פנייה מהאתר — ${name}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error("resend failed", res.status, await res.text());
    return new Response(JSON.stringify({ error: "send failed" }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
