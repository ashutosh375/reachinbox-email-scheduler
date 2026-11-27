
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Prevent tests from connecting to real services.
vi.mock("../src/config/db", () => ({
  pool: {
    query: vi.fn()
  },
  testDBConnection: vi.fn()
}));

vi.mock("../src/queues/emailQueue", () => ({
  emailQueue: {
    add: vi.fn(),
    addBulk: vi.fn(),
    waitUntilReady: vi.fn()
  }
}));

vi.mock("@bull-board/api", () => ({
  createBullBoard: vi.fn()
}));

vi.mock("@bull-board/api/bullMQAdapter", () => ({
  BullMQAdapter: class {
    constructor(_queue: unknown) {}
  }
}));


vi.mock("../src/config/session", () => ({
  sessionMiddleware: (
    _req: any,
    _res: any,
    next: any
  ) => next()
}));

vi.mock("../src/middleware/requireAuth", () => ({
  requireAuth: (
    _req: any,
    res: any
  ) => res.status(401).json({
    error: "Please log in to continue"
  })
}));

vi.mock("../src/routes/auth.js", async () => {
  const { default: express } = await import("express");
  return { default: express.Router() };
});

vi.mock("../src/routes/senders", async () => {
  const { default: express } = await import("express");
  return { default: express.Router() };
});

vi.mock("../src/routes/slack", async () => {
  const { default: express } = await import("express");
  return { default: express.Router() };
});

vi.mock("../src/config/elasticsearch", () => ({
  initializeElasticsearch: vi.fn(),
  elasticsearch: {},
  EMAIL_INDEX: "emails"
}));

vi.mock("../src/services/emailSearch", () => ({
  syncEmailsToElasticsearch: vi.fn(),
  indexEmail: vi.fn()
}));

import { app } from "../src/server";

describe("ReachInbox Backend API Tests", () => {

  it("GET / should return backend health message", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe(
      "ReachInbox Backend is Running!"
    );
  });

  it("GET /api/emails should reject unauthenticated users", async () => {
    const response = await request(app).get("/api/emails");

    expect(response.status).toBe(401);
  });

  it("POST /api/emails should reject unauthenticated users", async () => {
    const response = await request(app)
      .post("/api/emails")
      .send({
        senderEmail: "sender@example.com",
        recipientEmail: "recipient@example.com",
        subject: "Test",
        body: "Test message",
        scheduledAt: new Date(
          Date.now() + 60000
        ).toISOString()
      });

    expect(response.status).toBe(401);
  });

  it("POST /api/emails/bulk should reject unauthenticated users", async () => {
    const response = await request(app)
      .post("/api/emails/bulk")
      .send({ recipients: [] });

    expect(response.status).toBe(401);
  });

  it("GET /api/emails/search should reject unauthenticated users", async () => {
    const response = await request(app)
      .get("/api/emails/search?q=test");

    expect(response.status).toBe(401);
  });

  it("GET /admin/queues should deny access", async () => {
    const response = await request(app)
      .get("/admin/queues");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(
      "Admin dashboard is disabled"
    );
  });

});
