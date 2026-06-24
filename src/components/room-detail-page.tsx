"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Home,
  Loader2,
  MapPinned,
  Package,
  Trash2,
} from "lucide-react";
import {
  buildMutation,
  getId,
  getTimestamp,
  ROOM_LEVEL_PLACE_NAME,
  itemHasPlace,
} from "@/features/inventory/helpers";
import {
  applyItemLocally,
  applyPlaceLocally,
  deleteRoomLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import type { ItemRecord, PlaceRecord } from "@/features/inventory/types";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import { cn } from "@/lib/utils";

type RoomDetailPageProps = {
  roomId: string;
};

export function RoomDetailPage({ roomId }: RoomDetailPageProps) {
  const router = useRouter();
  const { rooms, places, items, isBootstrapping, syncNow } = useInventoryData();
  const [placeName, setPlaceName] = useState("");
  const [itemName, setItemName] = useState("");
  const [desiredStock, setDesiredStock] = useState(1);
  const [actualStock, setActualStock] = useState(0);
  const [itemNotes, setItemNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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

  const currentRoom = room;
  const roomPlaces = places.filter((place) => place.roomId === currentRoom.id);
  const roomLevelPlace = roomPlaces.find((place) => place.name === ROOM_LEVEL_PLACE_NAME) ?? null;
  const visiblePlaces = roomPlaces.filter((place) => place.id !== roomLevelPlace?.id);
  const visiblePlaceIds = new Set(visiblePlaces.map((place) => place.id));
  const roomLevelItems = roomLevelPlace
    ? items.filter((item) => itemHasPlace(item, roomLevelPlace.id))
    : [];
  const visiblePlaceItemCount = items.filter((item) =>
    [...visiblePlaceIds].some((placeId) => itemHasPlace(item, placeId)),
  ).length;
  const canDelete = visiblePlaces.length === 0 && roomLevelItems.length === 0;
  const roomIdValue = currentRoom.id;

  async function createPlaceInRoom() {
    if (!placeName.trim()) {
      return;
    }

    const timestamp = getTimestamp();
    const place: PlaceRecord = {
      id: getId(),
      roomId: currentRoom.id,
      userId: currentRoom.userId,
      name: placeName.trim(),
      sortOrder: roomPlaces.length,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyPlaceLocally(place);
    await enqueueMutation(buildMutation("place", "upsert", place, timestamp));
    setPlaceName("");
    setMessage(`${place.name} added`);

    await syncNow();
  }

  async function addRoomItem() {
    if (!itemName.trim()) {
      return;
    }

    const timestamp = getTimestamp();
    const nextPlace: PlaceRecord =
      roomLevelPlace ?? {
        id: getId(),
        roomId: currentRoom.id,
        userId: currentRoom.userId,
        name: ROOM_LEVEL_PLACE_NAME,
        sortOrder: roomPlaces.length,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

    if (!roomLevelPlace) {
      await applyPlaceLocally(nextPlace);
      await enqueueMutation(buildMutation("place", "upsert", nextPlace, timestamp));
    }

    const nextItem: ItemRecord = {
      id: getId(),
      placeId: nextPlace.id,
      placeIds: [nextPlace.id],
      userId: currentRoom.userId,
      name: itemName.trim(),
      notes: itemNotes.trim() || undefined,
      imageUrl: null,
      imageProxyUrl: null,
      pricePaidPence: null,
      isStaple: false,
      trackPriceHistory: false,
      desiredStock,
      actualStock,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyItemLocally(nextItem);
    await enqueueMutation(buildMutation("item", "upsert", nextItem, timestamp));

    setItemName("");
    setDesiredStock(1);
    setActualStock(0);
    setItemNotes("");
    setMessage(`${nextItem.name} added to ${currentRoom.name}`);

    await syncNow();
  }

  async function removeRoom() {
    const timestamp = getTimestamp();
    await deleteRoomLocally(roomIdValue);
    await enqueueMutation(buildMutation("room", "delete", { id: roomIdValue }, timestamp));

    await syncNow();

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
              {currentRoom.name}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {visiblePlaces.length} places · {visiblePlaceItemCount + roomLevelItems.length} items
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
        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <section className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  Places
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                  Storage spots in this room
                </h3>
              </div>
              <div className="rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
                {visiblePlaces.length}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {visiblePlaces.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
                  No places in this room yet. Add one on the right.
                </div>
              ) : (
                visiblePlaces.map((place) => {
                  const itemCount = items.filter((item) => itemHasPlace(item, place.id)).length;

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

          <section className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  Room items
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                  Items stored directly in {currentRoom.name}
                </h3>
              </div>
              <div className="rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
                {roomLevelItems.length}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {roomLevelItems.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
                  No room-level items yet. Add one on the right.
                </div>
              ) : (
                roomLevelItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/app/items/${item.id}`}
                    className={cn(
                      "block rounded-[1.5rem] border px-4 py-4 transition hover:bg-white hover:shadow-sm",
                      item.actualStock <= 0
                        ? "border-red-200 bg-red-50"
                        : item.actualStock < item.desiredStock
                          ? "border-amber-200 bg-amber-50"
                          : "border-black/5 bg-[color:var(--color-panel-muted)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-[color:var(--color-ink)]">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                          Target {item.desiredStock}, currently {item.actualStock}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Package className="size-5 text-[color:var(--color-forest)]" />
                        <ArrowRight className="size-4 text-[color:var(--color-ink-soft)]" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Add place
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
              Create a new place in this room
            </h3>
            <input
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              placeholder="Top shelf"
              className="mt-4 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
            <button
              type="button"
              onClick={() => void createPlaceInRoom()}
              className="mt-4 w-full rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
            >
              Save place
            </button>
          </section>

          <section className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Add room item
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
              Add an item directly to this room
            </h3>
            <div className="mt-4 space-y-4">
              <input
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="Vacuum cleaner bags"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="number"
                  min={0}
                  value={desiredStock}
                  onChange={(event) => setDesiredStock(Number(event.target.value))}
                  placeholder="Desired stock"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                />
                <input
                  type="number"
                  min={0}
                  value={actualStock}
                  onChange={(event) => setActualStock(Number(event.target.value))}
                  placeholder="Actual stock"
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                />
              </div>
              <textarea
                value={itemNotes}
                onChange={(event) => setItemNotes(event.target.value)}
                placeholder="Optional notes"
                rows={4}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
              <button
                type="button"
                onClick={() => void addRoomItem()}
                className="w-full rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
              >
                Save room item
              </button>
            </div>
          </section>
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
