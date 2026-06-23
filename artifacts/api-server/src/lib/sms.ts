import { logger } from "./logger";

export async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logger.warn(
      { to, body },
      "[DEV MODE] Twilio not configured — OTP would be sent via SMS. Logging code instead."
    );
    return;
  }

  const twilio = (await import("twilio")).default;
  const client = twilio(accountSid, authToken);
  await client.messages.create({ to, from: fromNumber, body });
}
