import { InventoryWorkspace } from "@/components/inventory-workspace";
import { SignOutButton } from "@/components/sign-out-button";
import { requireServerSession } from "@/lib/session";

export default async function AppPage() {
  const session = await requireServerSession();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-black/5 bg-white/70 px-5 py-4 shadow-[0_24px_80px_-56px_rgba(22,38,32,0.85)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
            Bare-bones build
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--color-ink)]">
            Inventory workspace
          </h1>
        </div>
        <SignOutButton />
      </header>

      <InventoryWorkspace
        userId={session.user.id}
        userName={session.user.name ?? session.user.email}
      />
    </main>
  );
}
