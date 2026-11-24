import { Queue } from "bullmq";
import IORedis from "ioredis";

export const redisConnection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

console.log("BullMQ email queue initialized");