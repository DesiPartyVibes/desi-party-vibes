import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// One-off, idempotent schema patch: adds the theme_preference column used by
// the account-level dark/light mode setting. There's no migration runner in
// this project, so small additive column changes are applied defensively at
// boot (IF NOT EXISTS makes this safe to run on every startup). A failure
// here is logged but not fatal -- it only means the theme feature won't
// persist until the column exists, not that the whole API should go down.
async function ensureSchema() {
  try {
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system'`,
    );
  } catch (err) {
    logger.error({ err }, "Failed to ensure theme_preference column exists");
  }

  // Same defensive pattern for the account-settings additions: email
  // notification preference, review-name privacy preference, self-service
  // account status, and soft-delete marker.
  try {
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true`,
    );
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reviews_are_public boolean NOT NULL DEFAULT true`,
    );
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'`,
    );
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz`,
    );
  } catch (err) {
    logger.error({ err }, "Failed to ensure account-settings columns exist on users");
  }

  // Session metadata for the Manage Sessions screen (device/browser, IP,
  // last-used time).
  try {
    await db.execute(
      sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text`,
    );
    await db.execute(
      sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address text`,
    );
    await db.execute(
      sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at timestamptz`,
    );
  } catch (err) {
    logger.error({ err }, "Failed to ensure session-metadata columns exist");
  }
}

await ensureSchema();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
