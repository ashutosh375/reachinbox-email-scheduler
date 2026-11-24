
import "dotenv/config";
import { pool } from "../src/config/db";
import { emailQueue } from "../src/queues/emailQueue";

const TEST_SUBJECT = "Bulk Load Test - 1000 Emails";

async function cleanup() {
  const client = await pool.connect();

  try {
    // Prevent concurrent cleanup runs.
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, recipient_email, status
       FROM emails
       WHERE subject = $1
         AND recipient_email LIKE 'test%@example.com'
         AND status = 'scheduled'
       FOR UPDATE`,
      [TEST_SUBJECT]
    );

    console.log(
      `Found ${result.rows.length} scheduled test emails`
    );

    if (result.rows.length !== 1000) {
      console.error(
        "Expected exactly 1000 matching emails. Cleanup cancelled."
      );

      await client.query("ROLLBACK");
      return;
    }

    // Remove BullMQ jobs before database rows.
    let removed = 0;

    for (const row of result.rows) {
      const job = await emailQueue.getJob(row.id);

      if (!job) {
        throw new Error(
          `Queue job missing for email ${row.id}. Cleanup stopped.`
        );
      }

      const state = await job.getState();

      if (state !== "delayed" && state !== "waiting") {
        throw new Error(
          `Unexpected job state ${state} for ${row.id}. Cleanup stopped.`
        );
      }
    }

    for (const row of result.rows) {
      const job = await emailQueue.getJob(row.id);

      if (job) {
        await job.remove();
        removed++;
      }
    }

    const ids = result.rows.map(
      (row: { id: string }) => row.id
    );

    const deleted = await client.query(
      `DELETE FROM emails
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    await client.query("COMMIT");

    console.log(`BullMQ jobs removed: ${removed}`);
    console.log(
      `PostgreSQL rows deleted: ${deleted.rowCount}`
    );
    console.log("Cleanup completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Cleanup failed:", error);
    console.error(
      "WARNING: PostgreSQL rollback does not restore any BullMQ jobs already removed."
    );

    process.exitCode = 1;
  } finally {
    client.release();
    await emailQueue.close();
    await pool.end();
  }
}

void cleanup();
