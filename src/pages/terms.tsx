export default function Terms() {
  return (
    <main style={{ maxWidth: 680, margin: '40px auto', fontFamily: 'system-ui', lineHeight: 1.6, padding: '0 16px' }}>
      <h1>Lunch Helper — Terms of Service</h1>
      <p>
        Lunch Helper (&quot;the Service&quot;) is a personal automation tool that acts solely as an
        <strong> intermediary order facilitator</strong> between you and your corporate food
        application (e.g. 10Bis). It places orders on your behalf based on preferences you configure.
      </p>
      <h2>No liability for third parties</h2>
      <p>
        The Service holds <strong>no liability</strong> for food preparation quality, delivery delays,
        incorrect items, pricing, or any errors caused by the third-party food application or the
        restaurant. All such matters are between you and the food application / restaurant.
      </p>
      <h2>Your account &amp; credentials</h2>
      <p>
        You authorise the Service to access your food-application account to read your menu, history,
        addresses and budget, and to place orders. Credentials are validated once and only an encrypted
        session token is retained (AES-256-GCM, encrypted at rest). You can revoke access at any time.
      </p>
      <h2>Spending</h2>
      <p>
        Orders may incur charges on your food-application account. You are responsible for all charges.
        The Service enforces the daily budget you configure but cannot guarantee third-party pricing.
      </p>
    </main>
  );
}
