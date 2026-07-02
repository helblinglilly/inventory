"use client";

import { startTransition, useState } from "react";
import { Copy, Loader2, Users } from "lucide-react";
import {
  bootstrapFromServer,
} from "@/features/inventory/sync";
import type {
  InventoryAccessRecord,
  InventoryInviteRecord,
  InventoryMemberRecord,
} from "@/features/inventory/types";

type SharingPanelProps = {
  access: InventoryAccessRecord;
  sharedMembers: InventoryMemberRecord[];
  pendingInvites: InventoryInviteRecord[];
};

export function SharingPanel({
  access,
  sharedMembers,
  pendingInvites,
}: SharingPanelProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);

  async function copyInviteLink(inviteUrl: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Invite link copied");
    } catch {
      setMessage(inviteUrl);
    }
  }

  async function createInvite() {
    if (!inviteEmail.trim()) {
      return;
    }

    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/inventory/share/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const payload = (await response.json()) as {
        invite?: { inviteUrl: string; email: string };
        message?: string;
      };

      if (!response.ok || !payload.invite) {
        throw new Error(payload.message ?? "Unable to create invite");
      }

      setInviteEmail("");
      setLatestInviteUrl(payload.invite.inviteUrl);
      setMessage(`Invite ready for ${payload.invite.email}`);
      await bootstrapFromServer(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invite");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[color:var(--color-forest)]">
            <Users className="size-4" />
            <p className="text-xs uppercase tracking-[0.2em]">Shared access</p>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--color-ink)]">
            {access.isOwner
              ? "Invite someone into this inventory"
              : `Shared with ${access.ownerName}`}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-soft)]">
            {access.isOwner
              ? "Create a private invite link for your household partner. They can sign in with an existing account or create one through the invite."
              : `You are editing ${access.ownerName}'s inventory as ${access.viewerName}.`}
          </p>
        </div>

        {access.isOwner ? (
          <div className="w-full max-w-md">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="partner@example.com"
                type="email"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => {
                    void createInvite();
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-forest)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-forest-deep)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Create invite
              </button>
            </div>
            {latestInviteUrl ? (
              <div className="mt-3 rounded-[1.5rem] bg-[color:var(--color-panel-muted)] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  Latest invite link
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    readOnly
                    value={latestInviteUrl}
                    className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[color:var(--color-ink-soft)]"
                  />
                  <button
                    type="button"
                    onClick={() => void copyInviteLink(latestInviteUrl)}
                    className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-3 py-3 text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.5rem] bg-[color:var(--color-panel-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            People with access
          </p>
          <div className="mt-3 space-y-3">
            {sharedMembers.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--color-ink)]">
                    {member.name}
                  </p>
                  <p className="truncate text-sm text-[color:var(--color-ink-soft)]">
                    {member.email}
                  </p>
                </div>
                <span className="rounded-full bg-[color:var(--color-panel-muted)] px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {access.isOwner ? (
          <div className="rounded-[1.5rem] bg-[color:var(--color-panel-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Pending invites
            </p>
            <div className="mt-3 space-y-3">
              {pendingInvites.length === 0 ? (
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
                  No pending invites yet.
                </p>
              ) : (
                pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--color-ink)]">
                          {invite.email}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                          Created {new Date(invite.createdAt).toLocaleString("en-GB")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyInviteLink(invite.inviteUrl)}
                        className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-3 py-3 text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
                      >
                        <Copy className="size-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
