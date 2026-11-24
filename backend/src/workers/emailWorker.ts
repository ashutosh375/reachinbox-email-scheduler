
import "dotenv/config";

import { Worker, DelayedError } from "bullmq";
import nodemailer from "nodemailer";

import { pool } from "../config/db";
import { redisConnection } from "../queues/emailQueue";
import { checkAndReserveSendSlot } from "../services/rateLimiter";
import { decryptPassword } from "../services/encryption";
import { indexEmail } from "../services/emailSearch";
import { notifyHourlyLimit } from "../services/slackNotification";

const emailWorker = new Worker(
  "email-queue",

  async (job, token) => {
    const { emailId } = job.data;

    // 1. Fetch scheduled email
    const emailResult = await pool.query(
      "SELECT * FROM emails WHERE id = $1",
      [emailId]
    );

    if (emailResult.rows.length === 0) {
      throw new Error(`Email ${emailId} not found`);
    }

    const email = emailResult.rows[0];

    if (email.status === "sent") {
      console.log(`Already sent: ${emailId}`);
      return;
    }

    // 2. Find registered sender belonging to user
    const senderResult = await pool.query(
      `SELECT * FROM senders
       WHERE user_id = $1 AND email = $2`,
      [
        email.user_id,
        email.sender_email.toLowerCase(),
      ]
    );

    if (senderResult.rows.length === 0) {
      throw new Error(
        `Registered sender not found: ${email.sender_email}`
      );
    }

    const sender = senderResult.rows[0];

    // 3. Check hourly limit and minimum delay
    const slot = await checkAndReserveSendSlot(
      sender.email,
      emailId,
      sender.hourly_limit,
      sender.min_delay_ms
    );

    if (!slot.allowed) {
      const retryAt = Math.max(
        slot.retryAt,
        Date.now() + 1000
      );

      console.log(
        `Sender ${sender.email} rate-limited (${slot.reason}). ` +
        `Rescheduling to ${new Date(retryAt).toISOString()}`
      );

      // Send Slack alert only for hourly limit
      if (slot.reason === "hourly_limit") {
        try {
          await notifyHourlyLimit(
            email.user_id,
            sender.email,
            sender.hourly_limit,
            retryAt
          );
        } catch (error) {
          // Slack failure must not block email scheduling
          console.error(
            "Slack notification failed:",
            error
          );
        }
      }

      // Reschedule without marking the email as failed
      await job.moveToDelayed(retryAt, token!);
      throw new DelayedError();
    }

    // 4. Decrypt SMTP password
    const smtpPassword = decryptPassword(
      sender.smtp_password_encrypted
    );

    // 5. Create transporter
    const transporter = nodemailer.createTransport({
      host: sender.smtp_host,
      port: sender.smtp_port,
      secure: sender.smtp_port === 465,
      auth: {
        user: sender.smtp_username,
        pass: smtpPassword,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    // 6. Send email
    console.log(
      `Sending email ${emailId} from ${sender.email}`
    );

    const info = await transporter.sendMail({
      from: sender.email,
      to: email.recipient_email,
      subject: email.subject,
      text: email.body,
    });

    // 7. Mark email as sent
    await pool.query(
      `UPDATE emails
       SET status = 'sent',
           sent_at = NOW(),
           error_message = NULL
       WHERE id = $1`,
      [emailId]
    );

    // 8. Update Elasticsearch
    try {
      await indexEmail(emailId);

      console.log(
        `Elasticsearch status updated: ${emailId}`
      );
    } catch (error) {
      console.error(
        `Elasticsearch update failed for ${emailId}:`,
        error
      );
    }

    console.log(
      `Email sent successfully: ${emailId}`
    );

    console.log(`Message ID: ${info.messageId}`);

    const previewUrl =
      nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
      console.log(`Preview URL: ${previewUrl}`);
    }
  },

  {
    connection: redisConnection,
    concurrency:
      Number(process.env.WORKER_CONCURRENCY) || 5,
  }
);

emailWorker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `Job failed: ${job?.id}`,
    error.message
  );
});

console.log(
  "Email worker started with Slack rate-limit notifications"
);
