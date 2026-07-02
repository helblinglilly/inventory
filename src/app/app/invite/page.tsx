import { SharingPanel } from "@/components/sharing-panel";
import { getInventoryBootstrapPayload } from "@/lib/inventory-bootstrap";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function InviteManagementPage() {
  const { access } = await requireServerInventoryAccess();
  const payload = await getInventoryBootstrapPayload(access);

  return (
    <div className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Invite
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
          Shared access
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-soft)]">
          Manage who can use this household inventory and copy invite links from one place.
        </p>
      </header>

      <SharingPanel
        access={payload.access}
        sharedMembers={payload.sharedMembers}
        pendingInvites={payload.pendingInvites}
        title={payload.access.isOwner ? "Invite household members" : `Shared with ${payload.access.ownerName}`}
        description={
          payload.access.isOwner
            ? "Create and reuse invite links here. Invited people can sign in with an existing account or create a new one from the invite."
            : `You are currently working inside ${payload.access.ownerName}'s shared inventory.`
        }
      />
    </div>
  );
}
