import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import * as authSchema from "@/db/auth-schema";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { canEmailUseInviteOnlySignUp } from "@/lib/inventory-sharing";

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
    autoSignIn: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      const email =
        typeof ctx.body === "object" &&
        ctx.body !== null &&
        "email" in ctx.body &&
        typeof ctx.body.email === "string"
          ? ctx.body.email
          : "";

      const canSignUp = await canEmailUseInviteOnlySignUp(email);

      if (!canSignUp) {
        throw APIError.fromStatus("FORBIDDEN", {
          message: "Sign-ups are invite only right now",
        });
      }
    }),
  },
  plugins: [nextCookies()],
});
