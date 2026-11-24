
import "dotenv/config";

import { pool } from "../config/db";
import { redisConnection } from "../queues/emailQueue";
import { decryptPassword } from "./encryption";

interface SlackMessageResponse {
  ok: boolean;
  error?: string;
}

export async function notifyHourlyLimit(
  userId: string,
  senderEmail: string,
  hourlyLimit: number,
  retryAt: number
): Promise<void> {
  // Check whether user connected Slack
  const result = await pool.query(
    `SELECT bot_token_encrypted, channel_id
     FROM slack_connections
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return;
  }

  const connection = result.rows[0];

  if (!connection.channel_id) {
    return;
  }

  // Prevent duplicate alerts across multiple workers.
  // One alert per sender per hour.
  const cooldownKey =
    `slack:rate-alert:${userId}:${senderEmail.toLowerCase()}`;

  const reserved = await redisConnection.set(
    cooldownKey,
    "pending",
    "EX",
    3600,
    "NX"
  );

  if (reserved !== "OK") {
    return;
  }

  try {
    const token = decryptPassword(
      connection.bot_token_encrypted
    );

    const retryTime = new Date(
      retryAt
    ).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const message =
      `:warning: *ReachInbox Hourly Limit Reached*\n\n` +
      `*Sender:* ${senderEmail}\n` +
      `*Hourly limit:* ${hourlyLimit} emails\n` +
      `*Next available sending time:* ${retryTime} IST\n\n` +
      `Pending emails will be rescheduled automatically.`;

    const response = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: connection.channel_id,
          text: message,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    const data =
      (await response.json()) as SlackMessageResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        `Slack notification failed: ${
          data.error ?? response.status
        }`
      );
    }

    console.log(
      `Slack rate-limit notification sent for ${senderEmail}`
    );
  } catch (error) {
    // Release the reservation if notification failed.
    // Delete only if this invocation still owns it.
    const releaseScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `;

    await redisConnection.eval(
      releaseScript,
      1,
      cooldownKey,
      "pending"
    );

    throw error;
  }
}
