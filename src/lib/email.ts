type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailResult = { sent: boolean; provider?: string; error?: string };

function isEmailConfigured(): boolean {
  return !!(
    process.env.RESEND_API_KEY?.trim() ||
    (process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim())
  );
}

async function sendViaResend(params: SendEmailParams): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || 'AIMSCS <onboarding@resend.dev>';
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not set' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { sent: false, provider: 'resend', error: err };
  }
  return { sent: true, provider: 'resend' };
}

async function sendViaSmtp(params: SendEmailParams): Promise<EmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !from) return { sent: false, error: 'SMTP not configured' };

  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { sent: true, provider: 'smtp' };
  } catch (err) {
    return { sent: false, provider: 'smtp', error: String(err) };
  }
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[email] (dev, not sent)', params.to, params.subject);
    }
    return { sent: false, error: 'Email not configured' };
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendViaResend(params);
  }
  return sendViaSmtp(params);
}

export async function sendWelcomeEmail(email: string, name: string, tempPassword: string) {
  return sendEmail({
    to: email,
    subject: 'Your AIMSCS account',
    html: `
      <p>Hello ${name},</p>
      <p>Your campus account has been created.</p>
      <p><strong>Email:</strong> ${email}<br/>
      <strong>Temporary password:</strong> ${tempPassword}</p>
      <p>Sign in at ${process.env.NEXTAUTH_URL || 'http://localhost:3000'} and change your password after first login.</p>
    `,
    text: `Hello ${name}. Your AIMSCS account: ${email} / temp password: ${tempPassword}`,
  });
}

export async function sendPasswordResetEmail(email: string, name: string, tempPassword: string) {
  return sendEmail({
    to: email,
    subject: 'AIMSCS password reset',
    html: `
      <p>Hello ${name},</p>
      <p>Your password has been reset by an administrator.</p>
      <p><strong>New temporary password:</strong> ${tempPassword}</p>
      <p>Sign in at ${process.env.NEXTAUTH_URL || 'http://localhost:3000'} and update your password.</p>
    `,
    text: `Hello ${name}. New temporary password: ${tempPassword}`,
  });
}

export function emailStatus(): 'configured' | 'disabled' {
  return isEmailConfigured() ? 'configured' : 'disabled';
}

export async function sendRegistrationApprovedEmail(
  email: string,
  name: string,
  role: string,
) {
  const loginUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return sendEmail({
    to: email,
    subject: 'AIMSCS registration approved',
    html: `
      <p>Hello ${name},</p>
      <p>Your AIMSCS campus registration has been <strong>approved</strong>.</p>
      <p><strong>Role:</strong> ${role.replace(/_/g, ' ')}</p>
      <p>Sign in at <a href="${loginUrl}/login">${loginUrl}/login</a> using your Knuct DID or credentials provided by the admin.</p>
    `,
    text: `Hello ${name}. Your AIMSCS registration was approved as ${role}. Sign in at ${loginUrl}/login`,
  });
}

export async function sendRegistrationRejectedEmail(
  email: string,
  name: string,
  reason?: string,
) {
  return sendEmail({
    to: email,
    subject: 'AIMSCS registration update',
    html: `
      <p>Hello ${name},</p>
      <p>Your AIMSCS registration request was not approved at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>Contact the campus administration if you believe this was an error.</p>
    `,
    text: `Hello ${name}. Your registration was not approved.${reason ? ` Reason: ${reason}` : ''}`,
  });
}

export async function sendCondonationDecisionEmail(
  email: string,
  name: string,
  decision: 'approved' | 'rejected',
  notes?: string,
) {
  const approved = decision === 'approved';
  return sendEmail({
    to: email,
    subject: approved ? 'AIMSCS condonation request approved' : 'AIMSCS condonation request update',
    html: `
      <p>Hello ${name},</p>
      <p>Your attendance condonation request was <strong>${approved ? 'approved' : 'not approved'}</strong>.</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p>You can review status under Attendance in AIMSCS.</p>
    `,
    text: `Hello ${name}. Your condonation request was ${approved ? 'approved' : 'not approved'}.${notes ? ` Notes: ${notes}` : ''}`,
  });
}

export async function sendLowAttendanceEmail(
  email: string,
  name: string,
  pct: number,
  threshold: number,
) {
  return sendEmail({
    to: email,
    subject: 'AIMSCS low attendance warning',
    html: `
      <p>Hello ${name},</p>
      <p>Your recorded attendance is <strong>${pct}%</strong>, which is below the campus minimum of <strong>${threshold}%</strong>.</p>
      <p>Please attend upcoming sessions and contact your faculty or HOD if you need condonation support.</p>
    `,
    text: `Hello ${name}. Attendance ${pct}% is below the ${threshold}% minimum.`,
  });
}
