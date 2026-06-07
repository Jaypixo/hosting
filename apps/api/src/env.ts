import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(20),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  BUILDER_SANDBOX_ROOT: z.string().default("./tmp/builds"),
  BUILDER_GIT_BIN: z.string().default("git"),
  BUILDER_NPM_BIN: z.string().default("npm"),
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_BUCKET_NAME: z.string().optional().default(""),
  R2_ENDPOINT: z.string().optional().default(""),
  R2_PUBLIC_BASE_URL: z.string().optional().default(""),
  CLOUDFLARE_API_TOKEN: z.string().optional().default(""),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional().default(""),
  EDGE_KV_NAMESPACE_ID: z.string().optional().default(""),
  EDGE_API_SECRET: z.string().optional().default(""),
  EDGE_ROOT_DOMAIN: z.string().optional().default("")
});

export const env = envSchema.parse(process.env);
