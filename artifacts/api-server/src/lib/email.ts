import { logger } from "./logger";

const RESEND_API_URL = "https://api.resend.com/emails";

// Sends a transactional email via Resend. Falls back to a dev-mode log
// (same convention as sendSms in ./sms.ts) when RESEND_API_KEY isn't set,
// so registration/approval flows never break in local dev or before the
// Resend account is configured in production.
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "DesiPartyVibes <onboarding@resend.dev>";

  if (!apiKey) {
    logger.warn(
      { to, subject },
      "[DEV MODE] Resend not configured (RESEND_API_KEY missing) - email would be sent. Logging instead."
    );
    return;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ to, subject, status: response.status, body }, "Failed to send email via Resend");
    }
  } catch (err) {
    logger.error({ to, subject, err }, "Error sending email via Resend");
  }
}
