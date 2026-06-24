"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Home, Loader2, Trash2 } from "lucide-react";
import {
  applyRoomLocally,
  deleteRoomLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import { buildMutation, getId, getTimestamp } from "@/features/inventory/helpers";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import type { RoomRecord } from "@/features/inventory/types";

type RoomsPageProps = {
  userId: string;
};

export function RoomsPage({ userId }: RoomsPageProps) {
  const { rooms, places, isBootstrapping, syncNow } = useInventoryData();
  const [roomName, setRoomName] = useState("");

  async function addRoom() {
    if (!roomName.trim()) {
      return;
    }

    const timestamp = getTimestamp();
    const room: RoomRecord = {
      id: getId(),
      userId,
      name: roomName.trim(),
      sortOrder: rooms.length,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyRoomLocally(room);
    await enqueueMutation(buildMutation("room", "upsert", room, timestamp));
    setRoomName("");

    await syncNow();
  }

  async function removeRoom(roomId: string) {
    const timestamp = getTimestamp();
    await deleteRoomLocally(roomId);
    await enqueueMutation(buildMutation("room", "delete", { id: roomId }, timestamp));

    await syncNow();
  }

  if (isBootstrapping) {
    return <Loading label="Loading rooms..." />;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Rooms
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
          Manage rooms
        </h2>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          {rooms.map((room) => {
            const placeCount = places.filter((place) => place.roomId === room.id).length;
            const canDelete = placeCount === 0;

            return (
              <article
                key={room.id}
                className="rounded-[1.5rem] bg-[color:var(--color-panel-muted)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link
                    href={`/app/rooms/${room.id}`}
                    className="min-w-0 flex-1 rounded-2xl transition hover:text-[color:var(--color-forest)]"
                  >
                    <h3 className="text-base font-semibold text-[color:var(--color-ink)]">
                      {room.name}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                      {placeCount} places
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => void removeRoom(room.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </button>
                    ) : null}
                    <Link
                      href={`/app/rooms/${room.id}`}
                      className="inline-flex items-center gap-3 rounded-full px-2 py-2 text-[color:var(--color-ink-soft)] transition hover:text-[color:var(--color-forest)]"
                    >
                      <Home className="size-5" />
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
              Add room
            </span>
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Utility room"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </label>
          <button
            type="button"
            onClick={() => void addRoom()}
            className="mt-4 w-full rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
          >
            Save room
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
