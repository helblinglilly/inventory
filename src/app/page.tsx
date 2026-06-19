import { ArrowRight, Signal } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getServerSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-10">
      <div className="flex flex-1 items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(145deg,#1f3a32,#2f5d50_58%,#4d8373)] px-6 py-8 text-white shadow-[0_40px_120px_-52px_rgba(29,67,57,0.95)] sm:px-8 sm:py-10 lg:px-10">
            <div className="absolute inset-y-8 right-6 hidden w-40 rounded-full border border-white/15 bg-white/5 backdrop-blur lg:block" />
            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/75">
                <Signal className="size-3.5" />
                Half offline by design
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Home inventory that survives patchy supermarket signal.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/78 sm:text-lg">
                Rooms contain places, places contain items, and low stock floats
                to the surface fast. This first build is wired for Turso, Better
                Auth, Vercel Blob, and a local IndexedDB cache with a sync queue.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Feature
                  title="Stock aware"
                  body="Desired vs actual levels with amber and red alerts."
                />
                <Feature
                  title="Local-first"
                  body="IndexedDB cache plus queued writes for flaky connections."
                />
                <Feature
                  title="Vercel-ready"
                  body="Blob upload route, PWA manifest, and Turso config in place."
                />
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-white/80">
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--color-forest)] transition hover:bg-[color:var(--color-paper)]"
                >
                  Open auth
                  <ArrowRight className="size-4" />
                </Link>
                <p>The next step after this pass is dropping in live credentials.</p>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-center">
            <AuthCard />
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/15 bg-white/8 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/76">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-white/78">{body}</p>
    </div>
  );
}
