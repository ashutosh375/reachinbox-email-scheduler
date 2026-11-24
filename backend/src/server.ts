
import express from "express";
import "dotenv/config";
import { randomUUID } from "crypto";

import { pool, testDBConnection } from "./config/db";
import { emailQueue } from "./queues/emailQueue";

import senderRoutes from "./routes/senders";
import authRoutes from "./routes/auth.js";
import slackRoutes from "./routes/slack";

import { sessionMiddleware } from "./config/session";
import { requireAuth } from "./middleware/requireAuth";

import {
  initializeElasticsearch,
  elasticsearch,
  EMAIL_INDEX,
} from "./config/elasticsearch";

import {
  syncEmailsToElasticsearch,
  indexEmail,
} from "./services/emailSearch";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const app = express();

app.use(express.json({ limit: "2mb" }));

// ============================================
// Session and Authentication
// ============================================

app.use(sessionMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/slack", slackRoutes);
app.use("/api/senders", senderRoutes);

// ============================================
// BullMQ Dashboard
// ============================================

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

// Disable the admin dashboard until proper
// administrator authorization is implemented.
// A normal authenticated user must not see
// other users' queue jobs.
app.use("/admin/queues", (_req, res) => {
  res.status(403).json({
    error: "Admin dashboard is disabled",
  });
});

// ============================================
// Health Check
// ============================================

app.get("/", (_req, res) => {
  res.send("ReachInbox Backend is Running!");
});

// ============================================
// Shared Validation Helpers
// ============================================

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseScheduleDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;

  const date = new Date(value);

  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() <= Date.now()
  ) {
    return null;
  }

  return date;
}

async function senderBelongsToUser(
  userId: string,
  senderEmail: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT id
     FROM senders
     WHERE user_id = $1 AND email = $2
     LIMIT 1`,
    [userId, senderEmail.toLowerCase()]
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Single Email Scheduling
// ============================================

app.post("/api/emails", requireAuth, async (req, res) => {
  try {
    const {
      senderEmail,
      recipientEmail,
      subject,
      body,
      scheduledAt,
    } = req.body ?? {};

    const userId = req.session.user!.id;

    if (
      typeof senderEmail !== "string" ||
      !validEmail(senderEmail.trim()) ||
      typeof recipientEmail !== "string" ||
      !validEmail(recipientEmail.trim()) ||
      typeof subject !== "string" ||
      !subject.trim() ||
      typeof body !== "string" ||
      !body.trim()
    ) {
      return res.status(400).json({
        error: "Valid sender, recipient, subject and body are required",
      });
    }

    const date = parseScheduleDate(scheduledAt);

    if (!date) {
      return res.status(400).json({
        error: "scheduledAt must be a valid future date",
      });
    }

    const normalizedSender = senderEmail.trim().toLowerCase();

    if (!(await senderBelongsToUser(userId, normalizedSender))) {
      return res.status(403).json({
        error: "Sender does not belong to your account",
      });
    }

    const id = randomUUID();

    const result = await pool.query(
      `INSERT INTO emails
       (
         id, user_id, sender_email, recipient_email,
         subject, body, scheduled_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        userId,
        normalizedSender,
        recipientEmail.trim(),
        subject.trim(),
        body.trim(),
        date.toISOString(),
      ]
    );

    try {
      await emailQueue.add(
        "send-email",
        { emailId: id },
        {
          jobId: id,
          delay: Math.max(0, date.getTime() - Date.now()),
        }
      );
    } catch (error) {
      console.error("Failed to queue email:", error);

      return res.status(503).json({
        error: "Email saved but could not be queued",
        emailId: id,
      });
    }

    try {
      await indexEmail(id);
    } catch (error) {
      console.error("Elasticsearch indexing failed:", error);
    }

    return res.status(201).json({
      message: "Email scheduled successfully",
      email: result.rows[0],
    });
  } catch (error) {
    console.error("Error scheduling email:", error);

    return res.status(500).json({
      error: "Failed to schedule email",
    });
  }
});

// ============================================
// Bulk Email Scheduling
// ============================================

app.post(
  "/api/emails/bulk",
  requireAuth,
  async (req, res) => {
    try {
      const {
        senderEmail,
        recipients,
        subject,
        body,
        scheduledAt,
      } = req.body ?? {};

      const userId = req.session.user!.id;

      if (
        typeof senderEmail !== "string" ||
        !validEmail(senderEmail.trim()) ||
        typeof subject !== "string" ||
        !subject.trim() ||
        typeof body !== "string" ||
        !body.trim() ||
        !Array.isArray(recipients)
      ) {
        return res.status(400).json({
          error: "Invalid bulk scheduling request",
        });
      }

      if (
        recipients.length === 0 ||
        recipients.length > 5000
      ) {
        return res.status(400).json({
          error: "Provide between 1 and 5000 recipients",
        });
      }

      if (
        !recipients.every(
          (recipient: unknown) =>
            typeof recipient === "string" &&
            validEmail(recipient.trim())
        )
      ) {
        return res.status(400).json({
          error: "All recipients must be valid email addresses",
        });
      }

      const date = parseScheduleDate(scheduledAt);

      if (!date) {
        return res.status(400).json({
          error: "scheduledAt must be a valid future date",
        });
      }

      const normalizedSender = senderEmail.trim().toLowerCase();

      if (!(await senderBelongsToUser(userId, normalizedSender))) {
        return res.status(403).json({
          error: "Sender does not belong to your account",
        });
      }

      const uniqueRecipients = [
        ...new Set(
          (recipients as string[]).map((email) =>
            email.trim().toLowerCase()
          )
        ),
      ];

      const scheduledISO = date.toISOString();

      const jobs: Array<{
        name: string;
        data: { emailId: string };
        opts: { jobId: string; delay: number };
      }> = [];

      const ids: string[] = [];

      // Insert in batches to avoid PostgreSQL
      // parameter-count and query-size issues.
      const BATCH_SIZE = 250;

      for (
        let start = 0;
        start < uniqueRecipients.length;
        start += BATCH_SIZE
      ) {
        const batch = uniqueRecipients.slice(
          start,
          start + BATCH_SIZE
        );

        const values: unknown[] = [];
        const placeholders: string[] = [];

        for (const recipient of batch) {
          const id = randomUUID();
          ids.push(id);

          const offset = values.length;

          values.push(
            id,
            userId,
            normalizedSender,
            recipient,
            subject.trim(),
            body.trim(),
            scheduledISO
          );

          placeholders.push(
            `(${Array.from(
              { length: 7 },
              (_, index) => `$${offset + index + 1}`
            ).join(", ")})`
          );

          jobs.push({
            name: "send-email",
            data: { emailId: id },
            opts: {
              jobId: id,
              delay: Math.max(
                0,
                date.getTime() - Date.now()
              ),
            },
          });
        }

        await pool.query(
          `INSERT INTO emails
           (
             id, user_id, sender_email, recipient_email,
             subject, body, scheduled_at
           )
           VALUES ${placeholders.join(", ")}`,
          values
        );
      }

      // BullMQ supports bulk queue insertion.
      // Queue in batches to reduce Redis load.
      const QUEUE_BATCH_SIZE = 250;

      let queuedCount = 0;

      try {
        for (
          let start = 0;
          start < jobs.length;
          start += QUEUE_BATCH_SIZE
        ) {
          const batch = jobs.slice(
            start,
            start + QUEUE_BATCH_SIZE
          );

          await emailQueue.addBulk(batch);
          queuedCount += batch.length;
        }
      } catch (queueError) {
        console.error(
          "Bulk queue insertion failed:",
          queueError
        );

        return res.status(503).json({
          error:
            "Some emails were saved but not all could be queued",
          savedCount: ids.length,
          queuedCount,
          note:
            "Do not retry blindly; some jobs may already exist.",
        });
      }

      // Index in background-style batches, but
      // keep indexing errors separate from queueing.
      for (const id of ids) {
        try {
          await indexEmail(id);
        } catch (error) {
          console.error(
            `Elasticsearch indexing failed for ${id}:`,
            error
          );
        }
      }

      return res.status(201).json({
        message: "Bulk emails scheduled successfully",
        requestedCount: recipients.length,
        scheduledCount: ids.length,
        duplicateCount:
          recipients.length - uniqueRecipients.length,
        queuedCount,
        scheduledAt: scheduledISO,
      });
    } catch (error) {
      console.error(
        "Bulk scheduling failed:",
        error
      );

      return res.status(500).json({
        error: "Failed to schedule bulk emails",
      });
    }
  }
);

// ============================================
// Search Emails Using Elasticsearch
// ============================================

app.get(
  "/api/emails/search",
  requireAuth,
  async (req, res) => {
    try {
      const { q } = req.query;
      const userId = req.session.user!.id;

      if (typeof q !== "string" || !q.trim()) {
        return res.status(400).json({
          error: "Search query (q) is required",
        });
      }

      const result = await elasticsearch.search({
        index: EMAIL_INDEX,
        size: 50,
        query: {
          bool: {
            filter: [
              {
                term: {
                  userId,
                },
              },
            ],
            must: [
              {
                multi_match: {
                  query: q.trim(),
                  fields: [
                    "subject^3",
                    "recipientEmail",
                    "body",
                  ],
                },
              },
            ],
          },
        },
      });

      const emails = result.hits.hits.map((hit) => ({
        ...(
          (hit._source as Record<string, unknown>) ?? {}
        ),
        id: hit._id,
      }));

      return res.json({
        count: emails.length,
        emails,
      });
    } catch (error) {
      console.error("Email search failed:", error);

      return res.status(500).json({
        error: "Failed to search emails",
      });
    }
  }
);

// ============================================
// Fetch Scheduled or Sent Emails
// ============================================

app.get(
  "/api/emails",
  requireAuth,
  async (req, res) => {
    try {
      const { status } = req.query;
      const userId = req.session.user!.id;

      if (
        status !== undefined &&
        status !== "scheduled" &&
        status !== "sent"
      ) {
        return res.status(400).json({
          error: "status must be scheduled or sent",
        });
      }

      const result = await pool.query(
        `SELECT
           id,
           sender_email,
           recipient_email,
           subject,
           body,
           scheduled_at,
           status,
           sent_at,
           created_at
         FROM emails
         WHERE user_id = $1
           AND (
             $2::text IS NULL
             OR status = $2
           )
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId, status || null]
      );

      return res.json({
        count: result.rows.length,
        emails: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch emails:", error);

      return res.status(500).json({
        error: "Failed to fetch emails",
      });
    }
  }
);

// ============================================
// Server Configuration
// ============================================

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await testDBConnection();

    await emailQueue.waitUntilReady();
    console.log("Redis/BullMQ connected");

    await initializeElasticsearch();
    console.log("Elasticsearch connected");

    await syncEmailsToElasticsearch();

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
