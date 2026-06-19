import { z } from "zod";

const serverEnvSchema = z.object({
  BETTER_AUTH_SECRET: z
    .string()
    .min(16)
    .default("development-only-secret-change-me"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  TURSO_DATABASE_URL: z.string().min(1).default("file:local.db"),
  TURSO_AUTH_TOKEN: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  IMAGE_PROXY_BASE_URL: z.string().url().optional().or(z.literal("")),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = serverEnvSchema.parse({
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  IMAGE_PROXY_BASE_URL: process.env.IMAGE_PROXY_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});
