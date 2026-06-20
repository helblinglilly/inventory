"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  MapPinned,
  Package,
  Trash2,
} from "lucide-react";
import { buildMutation, getTimestamp } from "@/features/inventory/helpers";
import { deletePlaceLocally, enqueueMutation } from "@/features/inventory/sync";
import { formatCurrencyFromPence, formatRelativeStock } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useInventoryData } from "@/features/inventory/use-inventory-data";

type PlaceDetailPageProps = {
  placeId: string;
};

export function PlaceDetailPage({ placeId }: PlaceDetailPageProps) {
  const router = useRouter();
  const { rooms, places, items, isBootstrapping, syncNow } = useInventoryData();

  if (isBootstrapping) {
    return <Loading label="Loading place..." />;
  }

  const place = places.find((entry) => entry.id === placeId);

  if (!place) {
    return (
      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-6 text-[color:var(--color-ink)] shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <Link
          href="/app/places"
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)]"
        >
          <ArrowLeft className="size-4" />
          Back to places
        </Link>
        <p className="mt-6 text-lg font-semibold">Place not found.</p>
      </section>
    );
  }

  const room = rooms.find((entry) => entry.id === place.roomId);
  const placeItems = items.filter((item) => item.placeId === place.id);
  const canDelete = placeItems.length === 0;
  const placeIdValue = place.id;

  async function removePlace() {
    const timestamp = getTimestamp();
    await deletePlaceLocally(placeIdValue);
    await enqueueMutation(buildMutation("place", "delete", { id: placeIdValue }, timestamp));

    if (navigator.onLine) {
      await syncNow();
    }

    router.push("/app/places");
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-[color:var(--color-forest)]">
          <Link href="/app/places" className="inline-flex items-center gap-2">
            <ArrowLeft className="size-4" />
            Back to places
          </Link>
          {room ? (
            <>
              <span className="text-[color:var(--color-ink-soft)]">/</span>
              <Link href={`/app/rooms/${room.id}`} className="hover:underline">
                {room.name}
              </Link>
            </>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
              Place
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              {place.name}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {room?.name ?? "Unknown room"} · {placeItems.length} items
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canDelete ? (
              <button
                type="button"
                onClick={() => void removePlace()}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <Trash2 className="size-4" />
                Delete place
              </button>
            ) : null}
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
              <MapPinned className="size-4 text-[color:var(--color-forest)]" />
              Place view
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        {placeItems.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            No items in this place yet.
          </div>
        ) : (
          placeItems.map((item) => (
            <Link
              key={item.id}
              href={`/app/items/${item.id}`}
              className={cn(
                "grid gap-4 rounded-[1.5rem] border p-4 transition hover:border-[color:var(--color-forest)] hover:shadow-sm md:grid-cols-[6rem_minmax(0,1fr)_auto]",
                item.actualStock <= 0
                  ? "border-red-200 bg-red-50"
                  : item.actualStock < item.desiredStock
                    ? "border-amber-200 bg-amber-50"
                    : "border-black/5 bg-[color:var(--color-panel-muted)]",
              )}
            >
              <div className="overflow-hidden rounded-[1.25rem] bg-white/70">
                {item.imageProxyUrl || item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageProxyUrl ?? item.imageUrl ?? ""}
                    alt={item.name}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center text-[color:var(--color-ink-soft)]">
                    <ImageIcon className="size-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-[color:var(--color-forest)]" />
                  <h3 className="truncate text-base font-semibold text-[color:var(--color-ink)]">
                    {item.name}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                  Target {item.desiredStock}, currently {item.actualStock}
                  {formatCurrencyFromPence(item.pricePaidPence)
                    ? ` · Paid ${formatCurrencyFromPence(item.pricePaidPence)}`
                    : ""}
                </p>
                {item.notes ? (
                  <p className="mt-2 line-clamp-2 text-sm text-[color:var(--color-ink-soft)]">
                    {item.notes}
                  </p>
                ) : null}
              </div>

              <div className="flex items-start justify-between gap-3 md:flex-col md:items-end">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    item.actualStock <= 0
                      ? "bg-red-600 text-white"
                      : item.actualStock < item.desiredStock
                        ? "bg-amber-500 text-white"
                        : "bg-[color:var(--color-forest)] text-white",
                  )}
                >
                  {formatRelativeStock(item.actualStock, item.desiredStock)}
                </span>
                <ChevronRight className="size-4 text-[color:var(--color-ink-soft)]" />
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-[color:var(--color-ink)] shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}
