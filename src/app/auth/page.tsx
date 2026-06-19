import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getServerSession } from "@/lib/session";

export default async function AuthPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-6 sm:px-6 lg:px-10">
      <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2.5rem] bg-[color:var(--color-panel)] p-8 shadow-[0_36px_120px_-60px_rgba(25,46,39,0.8)] backdrop-blur">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)] transition hover:text-[color:var(--color-forest-deep)]"
          >
            <ArrowLeft className="size-4" />
            Back to overview
          </Link>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[color:var(--color-ink)]">
            Sign in and start building your map of the house.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-[color:var(--color-ink-soft)]">
            The inventory shell is already wired for rooms, places, item stock,
            image uploads, and offline mutation syncing. Once the live Turso and
            Vercel credentials are added, this should move from local fallback to
            hosted mode cleanly.
          </p>
        </section>

        <div className="flex items-center justify-center">
          <AuthCard />
        </div>
      </div>
    </main>
  );
}
