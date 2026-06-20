import Link from "next/link";
import { SyncProgressBar } from "@/components/sync-progress-bar";
import { SignOutButton } from "@/components/sign-out-button";
import { requireServerSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireServerSession();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-black/5 bg-white/70 px-5 py-4 shadow-[0_24px_80px_-56px_rgba(22,38,32,0.85)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <Link
              href="/app"
              className="block rounded-[1.5rem] outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[color:var(--color-forest)]"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                Bare-bones build
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--color-ink)]">
                Inventory workspace
              </h1>
            </Link>
            <SignOutButton />
          </div>
          <SyncProgressBar />
        </div>
      </header>

      {children}
    </main>
  );
}
