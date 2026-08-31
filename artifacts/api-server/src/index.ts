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
// here is logged but not fatal — it only means the theme feature won't
// persist until the column exists, not that the whole API should go down.
async function ensureSchema() {
  try {
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system'`,
    );
  } catch (err) {
    logger.error({ err }, "Failed to ensure theme_preference column exists");
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
