
import "dotenv/config";
import { Router } from "express";
import { randomBytes } from "crypto";

import { pool } from "../config/db";
import { redisConnection } from "../queues/emailQueue";
import { encryptPassword } from "../services/encryption";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const clientId = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;
const redirectUri = process.env.SLACK_REDIRECT_URI;

function getSlackConfig() {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Slack OAuth configuration is missing");
  }

  return { clientId, clientSecret, redirectUri };
}

// ==========================================
// GET /api/slack/connect
// Start Slack OAuth
// ==========================================

router.get("/connect", requireAuth, async (req, res) => {
  try {
    const config = getSlackConfig();
    const state = randomBytes(32).toString("hex");

    await redisConnection.set(
      `slack:oauth:${state}`,
      req.session.user!.id,
      "EX",
      600
    );

    const params = new URLSearchParams({
      client_id: config.clientId,
      scope: "chat:write",
      redirect_uri: config.redirectUri,
      state,
    });

    return res.redirect(
      `https://slack.com/oauth/v2/authorize?${params.toString()}`
    );
  } catch (error) {
    console.error("Slack connect failed:", error);

    return res.status(500).json({
      error: "Unable to start Slack connection",
    });
  }
});

// ==========================================
// GET /api/slack/callback
// Complete Slack OAuth
// ==========================================

router.get("/callback", async (req, res) => {
  try {
    const config = getSlackConfig();

    const { code, state } = req.query;

    if (
      typeof code !== "string" ||
      typeof state !== "string"
    ) {
      return res.status(400).send(
        "Invalid Slack OAuth callback"
      );
    }

    // Prevent OAuth state reuse
    const userId = await redisConnection.getdel(
      `slack:oauth:${state}`
    );

    if (!userId) {
      return res.status(400).send(
        "Slack authorization expired. Please try again."
      );
    }

    const response = await fetch(
      "https://slack.com/api/oauth.v2.access",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }),
      }
    );

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      access_token?: string;
      team?: {
        id?: string;
        name?: string;
      };
      bot_user_id?: string;
    };

    if (
      !data.ok ||
      !data.access_token ||
      !data.team?.id
    ) {
      console.error(
        "Slack OAuth rejected:",
        data.error
      );

      return res.status(400).send(
        "Slack authorization failed."
      );
    }

    // Encrypt Slack token before database storage
    const encryptedToken = encryptPassword(
      data.access_token
    );

    await pool.query(
      `INSERT INTO slack_connections (
        user_id,
        team_id,
        team_name,
        bot_token_encrypted,
        bot_user_id,
        channel_id
      )
      VALUES ($1, $2, $3, $4, $5, NULL)
      ON CONFLICT (user_id)
      DO UPDATE SET
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        bot_token_encrypted =
          EXCLUDED.bot_token_encrypted,
        bot_user_id = EXCLUDED.bot_user_id,
        channel_id = NULL,
        connected_at = NOW()`,
      [
        userId,
        data.team.id,
        data.team.name ?? null,
        encryptedToken,
        data.bot_user_id ?? null,
      ]
    );

    return res.redirect(
      "http://localhost:5173/?slack=connected"
    );
  } catch (error) {
    console.error("Slack callback failed:", error);

    return res.status(500).send(
      "Unable to complete Slack authorization."
    );
  }
});

// ==========================================
// GET /api/slack/status
// Check current user's Slack connection
// ==========================================

router.get("/status", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         team_id,
         team_name,
         channel_id,
         connected_at
       FROM slack_connections
       WHERE user_id = $1`,
      [req.session.user!.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        connected: false,
      });
    }

    const connection = result.rows[0];

    return res.json({
      connected: true,
      workspace: connection.team_name,
      teamId: connection.team_id,
      channelId: connection.channel_id,
      connectedAt: connection.connected_at,
    });
  } catch (error) {
    console.error("Slack status failed:", error);

    return res.status(500).json({
      error: "Unable to check Slack connection",
    });
  }
});

// ==========================================
// PUT /api/slack/channel
// Save Slack notification channel
// ==========================================

router.put("/channel", requireAuth, async (req, res) => {
  try {
    const { channelId } = req.body ?? {};

    if (
      typeof channelId !== "string" ||
      !/^[CGD][A-Z0-9]+$/.test(channelId)
    ) {
      return res.status(400).json({
        error: "Valid Slack channel ID is required",
      });
    }

    const result = await pool.query(
      `UPDATE slack_connections
       SET channel_id = $1
       WHERE user_id = $2
       RETURNING team_name, channel_id`,
      [
        channelId,
        req.session.user!.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Connect Slack before selecting a channel",
      });
    }

    return res.json({
      message: "Slack notification channel saved",
      workspace: result.rows[0].team_name,
      channelId: result.rows[0].channel_id,
    });
  } catch (error) {
    console.error("Slack channel update failed:", error);

    return res.status(500).json({
      error: "Unable to save Slack channel",
    });
  }
});

// ==========================================
// DELETE /api/slack/disconnect
// Disconnect current user's Slack workspace
// ==========================================

router.delete(
  "/disconnect",
  requireAuth,
  async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM slack_connections
         WHERE user_id = $1`,
        [req.session.user!.id]
      );

      return res.json({
        message: "Slack disconnected successfully",
      });
    } catch (error) {
      console.error("Slack disconnect failed:", error);

      return res.status(500).json({
        error: "Unable to disconnect Slack",
      });
    }
  }
);

export default router;


