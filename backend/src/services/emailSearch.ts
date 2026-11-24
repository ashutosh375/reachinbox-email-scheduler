
import { elasticsearch, EMAIL_INDEX } from "../config/elasticsearch";
import { pool } from "../config/db";

export async function indexEmail(emailId: string) {
  const result = await pool.query(
    "SELECT * FROM emails WHERE id = $1",
    [emailId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Email not found: ${emailId}`);
  }

  const email = result.rows[0];

  await elasticsearch.index({
    index: EMAIL_INDEX,
    id: email.id,
    document: {
      id: email.id,
      userId: email.user_id,
      senderEmail: email.sender_email,
      recipientEmail: email.recipient_email,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduled_at,
      sentAt: email.sent_at,
    },
  });

  console.log(`Email indexed: ${emailId}`);
}

export async function syncEmailsToElasticsearch() {
  const result = await pool.query(
    "SELECT id FROM emails"
  );

  console.log(`Syncing ${result.rows.length} emails to Elasticsearch`);

  for (const email of result.rows) {
    await indexEmail(email.id);
  }

  console.log("Email synchronization completed");
}
