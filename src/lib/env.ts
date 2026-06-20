import { z } from "zod";

const nodeEnvSchema = z
  .enum(["development", "test", "production"])
  .default("development");

const developmentEnvSchema = z.object({
  BETTER_AUTH_SECRET: z
    .string()
    .min(16)
    .default("development-only-secret-change-me"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  TURSO_DATABASE_URL: z.string().min(1).default("file:local.db"),
  TURSO_AUTH_TOKEN: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  IMAGE_PROXY_BASE_URL: z.string().url().optional().or(z.literal("")),
  NODE_ENV: nodeEnvSchema,
});

const productionEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  IMAGE_PROXY_BASE_URL: z.string().url().optional().or(z.literal("")),
  NODE_ENV: nodeEnvSchema,
});

type ServerEnv = z.infer<typeof developmentEnvSchema>;

function readRawEnv() {
  return {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    IMAGE_PROXY_BASE_URL: process.env.IMAGE_PROXY_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
}

export function getEnv(): ServerEnv {
  const rawEnv = readRawEnv();
  const nodeEnv = nodeEnvSchema.parse(rawEnv.NODE_ENV);

  if (nodeEnv === "production") {
    return productionEnvSchema.parse(rawEnv);
  }

  return developmentEnvSchema.parse(rawEnv);
}

export const env = new Proxy({} as ServerEnv, {
  get(_target, property) {
    return getEnv()[property as keyof ServerEnv];
  },
});
