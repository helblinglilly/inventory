"use client";

import { startTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

export function AuthCard() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit() {
    setIsPending(true);
    setMessage(null);

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: "/app",
        });

        if (result.error) {
          throw new Error(result.error.message ?? "Unable to sign up");
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/app",
        });

        if (result.error) {
          throw new Error(result.error.message ?? "Unable to sign in");
        }
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
      <div className="grid grid-cols-2 rounded-full bg-[color:var(--color-panel-muted)] p-1 text-sm font-medium text-[color:var(--color-ink-soft)]">
        {(["sign-in", "sign-up"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              startTransition(() => {
                setMode(value);
                setMessage(null);
              })
            }
            className={cn(
              "rounded-full px-4 py-2 transition",
              mode === value
                ? "bg-[color:var(--color-forest)] text-white"
                : "hover:text-[color:var(--color-ink)]",
            )}
          >
            {value === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {mode === "sign-up" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--color-ink)]">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Kitchen keeper"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-[color:var(--color-forest)]"
            />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--color-ink)]">
            Email
          </span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-[color:var(--color-forest)]"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--color-ink)]">
            Password
          </span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            type="password"
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
        onClick={() => void submit()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-forest)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-forest-deep)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {mode === "sign-in" ? "Enter inventory" : "Create account"}
      </button>

      <p className="mt-4 text-sm leading-6 text-[color:var(--color-ink-soft)]">
        This first pass uses email and password auth backed by Better Auth, with
        Turso ready once credentials are dropped in.
      </p>
    </div>
  );
}
