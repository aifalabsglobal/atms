/**
 * Optional SMS via Twilio REST API when TWILIO_* env vars are set.
 * No-ops (and logs) when not configured — safe for local/dev.
 */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}

export async function sendSms(to: string, body: string): Promise<{ sent: boolean; reason?: string }> {
  if (!isSmsConfigured()) {
    return { sent: false, reason: 'SMS not configured' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_FROM_NUMBER!.trim();
  const normalized = to.replace(/[^\d+]/g, '');
  if (!normalized) return { sent: false, reason: 'Invalid phone' };

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: normalized, From: from, Body: body.slice(0, 1600) }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[sms] Twilio error:', res.status, text.slice(0, 200));
      return { sent: false, reason: `Twilio ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.warn('[sms] send failed:', err);
    return { sent: false, reason: 'network error' };
  }
}
