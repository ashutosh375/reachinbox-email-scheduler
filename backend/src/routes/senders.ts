
import { Router } from "express";
import { randomUUID } from "crypto";

import { pool } from "../config/db";
import { encryptPassword } from "../services/encryption";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// All sender routes require Google login
router.use(requireAuth);

// ==========================================
// POST /api/senders
// Register a sender for the logged-in user
// ==========================================

router.post("/", async (req, res) => {
  try {
    // User ID comes from the verified session,
    // not from the request body.
    const userId = req.session.user!.id;

    const {
      email,
      displayName,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      hourlyLimit,
      minDelayMs,
    } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof smtpHost !== "string" ||
      !smtpHost.trim() ||
      typeof smtpUsername !== "string" ||
      !smtpUsername.trim() ||
      typeof smtpPassword !== "string" ||
      !smtpPassword.trim()
    ) {
      return res.status(400).json({
        error: "Valid sender and SMTP details are required",
      });
    }

    if (
      displayName !== undefined &&
      displayName !== null &&
      typeof displayName !== "string"
    ) {
      return res.status(400).json({
        error: "Display name must be a string",
      });
    }

    const port =
      smtpPort === undefined ? 587 : Number(smtpPort);

    const limit =
      hourlyLimit === undefined ? 20 : Number(hourlyLimit);

    const delay =
      minDelayMs === undefined ? 2000 : Number(minDelayMs);

    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      !Number.isInteger(delay) ||
      delay < 0
    ) {
      return res.status(400).json({
        error: "Invalid SMTP port or sending limits",
      });
    }

    const id = randomUUID();

    // Encrypt SMTP password before saving
    const encryptedPassword = encryptPassword(smtpPassword);

    const result = await pool.query(
      `INSERT INTO senders (
        id,
        user_id,
        email,
        display_name,
        smtp_host,
        smtp_port,
        smtp_username,
        smtp_password_encrypted,
        hourly_limit,
        min_delay_ms
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10
      )
      RETURNING
        id,
        user_id,
        email,
        display_name,
        smtp_host,
        smtp_port,
        hourly_limit,
        min_delay_ms,
        created_at`,
      [
        id,
        userId,
        email.trim().toLowerCase(),
        displayName?.trim() || null,
        smtpHost.trim(),
        port,
        smtpUsername.trim(),
        encryptedPassword,
        limit,
        delay,
      ]
    );

    return res.status(201).json({
      message: "Sender added successfully",
      sender: result.rows[0],
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return res.status(409).json({
        error: "This sender email already exists",
      });
    }

    console.error("Error adding sender:", error);

    return res.status(500).json({
      error: "Failed to add sender",
    });
  }
});

// ==========================================
// GET /api/senders
// Fetch only the logged-in user's senders
// ==========================================

router.get("/", async (req, res) => {
  try {
    const userId = req.session.user!.id;

    const result = await pool.query(
      `SELECT
         id,
         user_id,
         email,
         display_name,
         smtp_host,
         smtp_port,
         hourly_limit,
         min_delay_ms,
         created_at
       FROM senders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      count: result.rows.length,
      senders: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch senders:", error);

    return res.status(500).json({
      error: "Failed to fetch senders",
    });
  }
});

export default router;

