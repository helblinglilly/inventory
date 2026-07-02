import Link from "next/link";
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
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--color-ink)]">
                Home Inventory
              </h1>
            </Link>

            <nav className="flex items-center gap-2">
              <Link
                href="/app/invite"
                className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
              >
                Invite
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {children}
    </main>
  );
}
