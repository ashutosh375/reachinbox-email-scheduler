
import "dotenv/config";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { redisConnection } from "../queues/emailQueue";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters");
}

export const sessionMiddleware = session({
  name: "reachinbox.sid",

  store: new RedisStore({
    client: redisConnection,
    prefix: "reachinbox:sess:",
  }),

  secret: sessionSecret,

  resave: false,
  saveUninitialized: false,

  proxy: process.env.NODE_ENV === "production",

  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
});
