"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Loader2, MapPinned, Trash2 } from "lucide-react";
import {
  applyPlaceLocally,
  deletePlaceLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import { buildMutation, getId, getTimestamp, itemHasPlace } from "@/features/inventory/helpers";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import type { PlaceRecord } from "@/features/inventory/types";

type PlacesPageProps = {
  userId: string;
};

export function PlacesPage({ userId }: PlacesPageProps) {
  const { rooms, places, items, isBootstrapping, syncNow } = useInventoryData();
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [placeName, setPlaceName] = useState("");

  async function addPlace() {
    if (!placeName.trim() || !selectedRoomId) {
      return;
    }

    const timestamp = getTimestamp();
    const place: PlaceRecord = {
      id: getId(),
      roomId: selectedRoomId,
      userId,
      name: placeName.trim(),
      sortOrder: places.filter((entry) => entry.roomId === selectedRoomId).length,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyPlaceLocally(place);
    await enqueueMutation(buildMutation("place", "upsert", place, timestamp));
    setPlaceName("");

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function removePlace(placeId: string) {
    const timestamp = getTimestamp();
    await deletePlaceLocally(placeId);
    await enqueueMutation(buildMutation("place", "delete", { id: placeId }, timestamp));

    if (navigator.onLine) {
      await syncNow();
    }
  }

  if (isBootstrapping) {
    return <Loading label="Loading places..." />;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Places
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
          Manage places
        </h2>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          {places.map((place) => {
            const room = rooms.find((entry) => entry.id === place.roomId);
            const itemCount = items.filter((item) => itemHasPlace(item, place.id)).length;
            const canDelete = itemCount === 0;
            return (
              <article
                key={place.id}
                className="rounded-[1.5rem] bg-[color:var(--color-panel-muted)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link
                    href={`/app/places/${place.id}`}
                    className="min-w-0 flex-1 rounded-2xl transition hover:text-[color:var(--color-forest)]"
                  >
                    <h3 className="text-base font-semibold text-[color:var(--color-ink)]">
                      {place.name}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                      {room?.name ?? "Unknown room"} · {itemCount} items
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => void removePlace(place.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </button>
                    ) : null}
                    <Link
                      href={`/app/places/${place.id}`}
                      className="inline-flex items-center gap-3 rounded-full px-2 py-2 text-[color:var(--color-ink-soft)] transition hover:text-[color:var(--color-forest)]"
                    >
                      <MapPinned className="size-5" />
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Room
            </span>
            <select
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            >
              <option value="">Choose room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Add place
            </span>
            <input
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              placeholder="Top bathroom cupboard"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void addPlace()}
            className="mt-4 w-full rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
          >
            Save place
          </button>
        </aside>
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
