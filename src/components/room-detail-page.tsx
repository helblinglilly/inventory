"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Loader2,
  MapPinned,
  Trash2,
} from "lucide-react";
import { buildMutation, getTimestamp } from "@/features/inventory/helpers";
import { deleteRoomLocally, enqueueMutation } from "@/features/inventory/sync";
import { useInventoryData } from "@/features/inventory/use-inventory-data";

type RoomDetailPageProps = {
  roomId: string;
};

export function RoomDetailPage({ roomId }: RoomDetailPageProps) {
  const router = useRouter();
  const { rooms, places, items, isBootstrapping, syncNow } = useInventoryData();

  if (isBootstrapping) {
    return <Loading label="Loading room..." />;
  }

  const room = rooms.find((entry) => entry.id === roomId);

  if (!room) {
    return (
      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-6 text-[color:var(--color-ink)] shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <Link
          href="/app/rooms"
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)]"
        >
          <ArrowLeft className="size-4" />
          Back to rooms
        </Link>
        <p className="mt-6 text-lg font-semibold">Room not found.</p>
      </section>
    );
  }

  const roomPlaces = places.filter((place) => place.roomId === room.id);
  const canDelete = roomPlaces.length === 0;
  const roomIdValue = room.id;

  async function removeRoom() {
    const timestamp = getTimestamp();
    await deleteRoomLocally(roomIdValue);
    await enqueueMutation(buildMutation("room", "delete", { id: roomIdValue }, timestamp));

    if (navigator.onLine) {
      await syncNow();
    }

    router.push("/app/rooms");
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <Link
          href="/app/rooms"
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)]"
        >
          <ArrowLeft className="size-4" />
          Back to rooms
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
              Room
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              {room.name}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {roomPlaces.length} places ·{" "}
              {items.filter((item) =>
                roomPlaces.some((place) => place.id === item.placeId),
              ).length}{" "}
              items
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canDelete ? (
              <button
                type="button"
                onClick={() => void removeRoom()}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <Trash2 className="size-4" />
                Delete room
              </button>
            ) : null}
            <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
              <Home className="size-4 text-[color:var(--color-forest)]" />
              Room view
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        {roomPlaces.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            No places in this room yet.
          </div>
        ) : (
          roomPlaces.map((place) => {
            const itemCount = items.filter((item) => item.placeId === place.id).length;

            return (
              <Link
                key={place.id}
                href={`/app/places/${place.id}`}
                className="block rounded-[1.5rem] bg-[color:var(--color-panel-muted)] px-4 py-4 transition hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-[color:var(--color-ink)]">
                      {place.name}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                      {itemCount} items in this place
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPinned className="size-5 text-[color:var(--color-forest)]" />
                    <ChevronRight className="size-4 text-[color:var(--color-ink-soft)]" />
                  </div>
                </div>
              </Link>
            );
          })
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
