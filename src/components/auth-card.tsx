"use client";

import { startTransition, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AuthCard() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";

    setIsPending(true);
    setMessage(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/app",
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Unable to sign in");
      }

      window.location.assign("/app");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Authentication failed",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_-40px_rgba(38,61,51,0.55)] backdrop-blur">
      <div className="mt-6 space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--color-ink)]">
            Email
          </span>
          <input
            ref={emailRef}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-[color:var(--color-forest)]"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--color-ink)]">
            Password
          </span>
          <input
            ref={passwordRef}
            placeholder="At least 8 characters"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-[color:var(--color-forest)]"
          />
        </label>
      </div>

      {message ? (
        <p className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(() => {
            void submit();
          })
        }
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-forest)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-forest-deep)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Enter inventory
      </button>

      <p className="mt-4 text-sm leading-6 text-[color:var(--color-ink-soft)]">
        Sign-ups are currently closed while shared household access is being
        added.
      </p>
    </div>
  );
}
