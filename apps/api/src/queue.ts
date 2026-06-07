import { Queue, Worker } from "bullmq";
import IORedisImport from "ioredis";
import { env } from "./env.js";

const IORedis = IORedisImport as unknown as new (url: string, options: { maxRetriesPerRequest: number | null }) => any;

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const buildQueue = new Queue("builds", {
  connection: redisConnection
});

export function createBuildWorker(processor: (job: any) => Promise<any>) {
  return new Worker("builds", processor, {
    connection: redisConnection,
    concurrency: 2
  });
}
