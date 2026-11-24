
import "dotenv/config";
import { redisConnection } from "../queues/emailQueue";

export type RateLimitReason =
  | "hourly_limit"
  | "min_delay"
  | null;

export interface RateLimitResult {
  allowed: boolean;
  retryAt: number;
  reason: RateLimitReason;
}

const rateLimitScript = `
local key = KEYS[1]
local spacingKey = KEYS[2]

local now = tonumber(ARGV[1])
local maxPerHour = tonumber(ARGV[2])
local minDelay = tonumber(ARGV[3])
local windowMs = 3600000

redis.call("ZREMRANGEBYSCORE", key, "-inf", now - windowMs)

local count = redis.call("ZCARD", key)
local nextAllowed = tonumber(redis.call("GET", spacingKey) or "0")

-- Hourly sending limit reached
if count >= maxPerHour then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retryAt = tonumber(oldest[2]) + windowMs + 1

  return {0, math.max(retryAt, nextAllowed), 1}
end

-- Minimum delay between emails
if now < nextAllowed then
  return {0, nextAllowed, 2}
end

-- Reserve a sending slot
redis.call("ZADD", key, now, ARGV[4])
redis.call("PEXPIRE", key, windowMs + 60000)

redis.call(
  "SET",
  spacingKey,
  now + minDelay,
  "PX",
  windowMs + 60000
)

return {1, now, 0}
`;

export async function checkAndReserveSendSlot(
  senderEmail: string,
  emailId: string,
  maxPerHour: number,
  minDelayMs: number
): Promise<RateLimitResult> {
  const now = Date.now();

  const result = (await redisConnection.eval(
    rateLimitScript,
    2,
    `email:rate:${senderEmail.toLowerCase()}`,
    `email:spacing:${senderEmail.toLowerCase()}`,
    now,
    maxPerHour,
    minDelayMs,
    emailId
  )) as number[];

  const reasonCode = Number(result[2]);

  const reason: RateLimitReason =
    reasonCode === 1
      ? "hourly_limit"
      : reasonCode === 2
        ? "min_delay"
        : null;

  return {
    allowed: Number(result[0]) === 1,
    retryAt: Number(result[1]),
    reason,
  };
}
