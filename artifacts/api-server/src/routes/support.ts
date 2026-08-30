import { Router } from "express";
import { z } from "zod";
import { getSessionUser } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger";

const router = Router();

const contactSchema = z.object({
  message: z.string().trim().min(10, "Please add a bit more detail so we can help.").max(2000),
});

router.post("/contact", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    return;
  }

  const supportInbox = process.env.SUPPORT_EMAIL || "raguramdhanunjan@gmail.com";
  const safeMessage = parsed.data.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  try {
    await sendEmail(
      supportInbox,
      `DesiPartyVibes support request from ${user.name}`,
      `<p><strong>From:</strong> ${user.name} (${user.email})</p><p><strong>Role:</strong> ${user.role}</p><p><strong>Message:</strong></p><p>${safeMessage}</p>`
    );
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send support contact email");
    res.status(500).json({ error: "Couldn't send your message right now. Please try again." });
    return;
  }

  res.json({ success: true });
});

export default router;
