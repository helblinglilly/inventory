import Link from "next/link";
import { redirect } from "next/navigation";
import {
  acceptInventoryInvite,
  getInventoryInviteById,
} from "@/lib/inventory-sharing";
import { getServerSession } from "@/lib/session";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;
  const invite = await getInventoryInviteById(inviteId);

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-6 sm:px-6">
        <section className="w-full rounded-[2rem] border border-black/5 bg-white/85 p-8 shadow-[0_24px_80px_-48px_rgba(22,38,32,0.75)]">
          <h1 className="text-2xl font-semibold text-[color:var(--color-ink)]">
            This invite is no longer valid
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--color-ink-soft)]">
            It may already have been used, or the owner generated a fresh link.
          </p>
          <Link
            href="/auth"
            className="mt-6 inline-flex rounded-full bg-[color:var(--color-forest)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-forest-deep)]"
          >
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  const session = await getServerSession();

  if (!session) {
    redirect(`/auth?invite=${inviteId}`);
  }

  try {
    await acceptInventoryInvite(inviteId, session.user.id);
    redirect("/app");
  } catch (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-6 sm:px-6">
        <section className="w-full rounded-[2rem] border border-black/5 bg-white/85 p-8 shadow-[0_24px_80px_-48px_rgba(22,38,32,0.75)]">
          <h1 className="text-2xl font-semibold text-[color:var(--color-ink)]">
            Invite could not be accepted
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--color-ink-soft)]">
            {error instanceof Error ? error.message : "Something went wrong while accepting this invite."}
          </p>
          <Link
            href="/auth"
            className="mt-6 inline-flex rounded-full bg-[color:var(--color-forest)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-forest-deep)]"
          >
            Try a different account
          </Link>
        </section>
      </main>
    );
  }
}
