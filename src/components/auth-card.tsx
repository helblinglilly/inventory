"use client";

import { startTransition, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type InvitePreview = {
  id: string;
  email: string;
  ownerUserId: string;
  ownerName: string;
};

type AuthCardProps = {
  invite?: InvitePreview | null;
  hasInviteError?: boolean;
};

type Mode = "sign-in" | "accept-invite";

export function AuthCard({ invite = null, hasInviteError = false }: AuthCardProps) {
  const [mode, setMode] = useState<Mode>(invite ? "accept-invite" : "sign-in");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";

    if (invite && mode === "accept-invite" && !name.trim()) {
      setMessage("Name is required");
      return;
    }

    setIsPending(true);
    setMessage(null);

    try {
      const callbackURL = invite ? `/invite/${invite.id}` : "/app";
      const result =
        mode === "accept-invite"
          ? await authClient.signUp.email({
              name: name.trim(),
              email,
              password,
              callbackURL,
            })
          : await authClient.signIn.email({
              email,
              password,
              callbackURL,
            });

      if (result.error) {
        throw new Error(
          result.error.message ??
            (mode === "accept-invite" ? "Unable to accept invite" : "Unable to sign in"),
        );
      }

      window.location.assign(callbackURL);
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
      {invite ? (
        <div className="grid grid-cols-2 rounded-full bg-[color:var(--color-panel-muted)] p-1 text-sm font-medium text-[color:var(--color-ink-soft)]">
          {([
            ["accept-invite", "Create account"],
            ["sign-in", "Sign in"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                startTransition(() => {
                  setMode(value);
                  setMessage(null);
                })
              }
              className={`rounded-full px-4 py-2 transition ${
                mode === value
                  ? "bg-[color:var(--color-forest)] text-white"
                  : "hover:text-[color:var(--color-ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {invite && mode === "accept-invite" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--color-ink)]">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Kitchen keeper"
              autoComplete="name"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-[color:var(--color-forest)]"
            />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--color-ink)]">
            Email
          </span>
          <input
            ref={emailRef}
            defaultValue={invite?.email ?? ""}
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
            autoComplete={invite && mode === "accept-invite" ? "new-password" : "current-password"}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-[color:var(--color-forest)]"
          />
        </label>
      </div>

      {hasInviteError ? (
        <p className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          That invite link is invalid or has already been used. You can still sign in if you
          already have access.
        </p>
      ) : null}

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
        {invite && mode === "accept-invite" ? "Join inventory" : "Enter inventory"}
      </button>

      <p className="mt-4 text-sm leading-6 text-[color:var(--color-ink-soft)]">
        {invite
          ? "Invited people can create an account here, and everyone else needs to sign in with an existing one."
          : "Public sign-ups are closed. New access is granted by invite only."}
      </p>
    </div>
  );
}
