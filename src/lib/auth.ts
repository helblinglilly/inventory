import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import * as authSchema from "@/db/auth-schema";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const auth = betterAuth({
  appName: "Inventory",
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL, "https://inventory.helbling.uk"],
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: true,
  },
  plugins: [nextCookies()],
});
