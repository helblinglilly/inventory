"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  Home,
  Loader2,
  Minus,
  Package2,
  Plus,
  Search,
  Signal,
  Store,
  Upload,
} from "lucide-react";
import { offlineDb } from "@/features/inventory/offline-db";
import {
  applyItemLocally,
  applyPlaceLocally,
  applyRoomLocally,
  bootstrapFromServer,
  enqueueMutation,
  flushMutations,
} from "@/features/inventory/sync";
import type {
  ItemRecord,
  PlaceRecord,
  RoomRecord,
  SyncMutation,
} from "@/features/inventory/types";
import { cn, formatRelativeStock, formatTimestamp } from "@/lib/utils";

type InventoryWorkspaceProps = {
  userId: string;
  userName: string;
};

export function InventoryWorkspace({
  userId,
  userName,
}: InventoryWorkspaceProps) {
  const rooms = useLiveQuery(() => offlineDb.rooms.orderBy("sortOrder").toArray(), [], []);
  const places = useLiveQuery(
    () => offlineDb.places.orderBy("sortOrder").toArray(),
    [],
    [],
  );
  const items = useLiveQuery(() => offlineDb.items.orderBy("name").toArray(), [], []);
  const pendingMutations = useLiveQuery(
    () => offlineDb.mutations.orderBy("queuedAt").toArray(),
    [],
    [],
  );
  const meta = useLiveQuery(() => offlineDb.meta.toArray(), [], []);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roomName, setRoomName] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [itemDraft, setItemDraft] = useState({
    name: "",
    desiredStock: 1,
    actualStock: 0,
    notes: "",
  });
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadState, setUploadState] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const availableRooms = rooms ?? [];
  const availablePlaces = places ?? [];
  const availableItems = items ?? [];
  const hasSelectedRoom = availableRooms.some((room) => room.id === selectedRoomId);
  const activeRoomId = hasSelectedRoom
    ? selectedRoomId
    : availableRooms[0]?.id ?? null;
  const roomPlaces = (places ?? []).filter((place) => place.roomId === activeRoomId);
  const hasSelectedPlace = roomPlaces.some((place) => place.id === selectedPlaceId);
  const activePlaceId = hasSelectedPlace
    ? selectedPlaceId
    : roomPlaces[0]?.id ?? null;

  const activeItems = (items ?? []).filter((item) => {
    const matchesPlace = activePlaceId ? item.placeId === activePlaceId : true;
    const matchesSearch =
      deferredSearch.length === 0 ||
      item.name.toLowerCase().includes(deferredSearch) ||
      (item.notes ?? "").toLowerCase().includes(deferredSearch);

    return matchesPlace && matchesSearch;
  });

  const lowStockItems = availableItems.filter(
    (item) => item.actualStock < item.desiredStock,
  );
  const emptyItems = lowStockItems.filter((item) => item.actualStock <= 0);
  const lastBootstrapAt = meta?.find((entry) => entry.key === "lastBootstrapAt")?.value;

  async function syncNow() {
    if (!navigator.onLine) {
      return;
    }

    setIsSyncing(true);

    try {
      await flushMutations();
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await bootstrapFromServer();
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onOnline = () => {
      void syncNow();
    };

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  });

  async function addRoom() {
    if (!roomName.trim()) {
      return;
    }

    const timestamp = getTimestamp();
    const room: RoomRecord = {
      id: getId(),
      userId,
      name: roomName.trim(),
      sortOrder: rooms?.length ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyRoomLocally(room);
    await enqueueMutation(toMutation("room", "upsert", room, timestamp));
    setRoomName("");
    setSelectedRoomId(room.id);
    if (navigator.onLine) {
      void syncNow();
    }
  }

  async function addPlace() {
    if (!placeName.trim() || !activeRoomId) {
      return;
    }

    const timestamp = getTimestamp();
    const place: PlaceRecord = {
      id: getId(),
      roomId: activeRoomId,
      userId,
      name: placeName.trim(),
      sortOrder: roomPlaces.length,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyPlaceLocally(place);
    await enqueueMutation(toMutation("place", "upsert", place, timestamp));
    setPlaceName("");
    setSelectedPlaceId(place.id);
    if (navigator.onLine) {
      void syncNow();
    }
  }

  async function addItem() {
    if (!itemDraft.name.trim() || !activePlaceId) {
      return;
    }

    setUploadState("Preparing item...");

    let uploadPayload: { imageUrl?: string; imageProxyUrl?: string } = {};

    if (itemImage) {
      setUploadState("Uploading image...");
      const formData = new FormData();
      formData.append("file", itemImage);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setUploadState("Image upload failed");
        return;
      }

      uploadPayload = (await response.json()) as {
        imageUrl?: string;
        imageProxyUrl?: string;
      };
    }

    const timestamp = getTimestamp();
    const item: ItemRecord = {
      id: getId(),
      placeId: activePlaceId,
      userId,
      name: itemDraft.name.trim(),
      notes: itemDraft.notes.trim() || undefined,
      desiredStock: Number(itemDraft.desiredStock),
      actualStock: Number(itemDraft.actualStock),
      imageUrl: uploadPayload.imageUrl,
      imageProxyUrl: uploadPayload.imageProxyUrl,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyItemLocally(item);
    await enqueueMutation(toMutation("item", "upsert", item, timestamp));
    setItemDraft({
      name: "",
      desiredStock: 1,
      actualStock: 0,
      notes: "",
    });
    setItemImage(null);
    setUploadState(null);
    if (navigator.onLine) {
      void syncNow();
    }
  }

  async function adjustStock(item: ItemRecord, delta: number) {
    const timestamp = getTimestamp();
    const nextValue = Math.max(item.actualStock + delta, 0);

    await applyItemLocally({
      ...item,
      actualStock: nextValue,
      updatedAt: timestamp,
    });

    await enqueueMutation(
      toMutation(
        "item",
        "adjust-stock",
        {
          id: item.id,
          delta,
          updatedAt: timestamp,
        },
        timestamp,
      ),
    );

    if (navigator.onLine) {
      void syncNow();
    }
  }

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-[color:var(--color-ink)] shadow-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading local inventory cache...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[1.15fr_0.85fr_0.85fr]">
        <article className="rounded-[2rem] bg-[linear-gradient(135deg,rgba(47,93,80,0.98),rgba(24,42,35,0.98))] p-6 text-white shadow-[0_32px_80px_-44px_rgba(20,38,33,0.85)]">
          <p className="text-sm uppercase tracking-[0.24em] text-white/70">
            Inventory cockpit
          </p>
          <div className="mt-4 flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {userName || "Home"} inventory
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/75">
                Local-first cache is live. Changes queue on the device and sync
                back to Turso when the network comes back.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 px-4 py-3 text-right text-sm">
              <div className="font-medium">{navigator.onLine ? "Online" : "Offline"}</div>
              <div className="mt-1 text-white/70">
                {pendingMutations?.length ?? 0} queued
              </div>
            </div>
          </div>
        </article>

        <MetricCard
          icon={AlertTriangle}
          label="Running low"
          value={lowStockItems.length}
          tone="amber"
          caption="Below desired stock"
        />
        <MetricCard
          icon={Package2}
          label="Out of stock"
          value={emptyItems.length}
          tone="red"
          caption="Needs attention now"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
                Rooms
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[color:var(--color-ink)]">
                Navigate spaces
              </h2>
            </div>
            <Home className="size-5 text-[color:var(--color-forest)]" />
          </div>

          <div className="space-y-2">
            {availableRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() =>
                  startTransition(() => {
                    setSelectedRoomId(room.id);
                    setSelectedPlaceId(null);
                  })
                }
                className={cn(
                  "w-full rounded-[1.35rem] px-4 py-3 text-left text-sm transition",
                  activeRoomId === room.id
                    ? "bg-[color:var(--color-forest)] text-white"
                    : "bg-[color:var(--color-panel-muted)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-highlight)]",
                )}
              >
                <div className="font-medium">{room.name}</div>
                <div
                  className={cn(
                    "mt-1 text-xs",
                    activeRoomId === room.id ? "text-white/70" : "text-[color:var(--color-ink-soft)]",
                  )}
                >
                  {availablePlaces.filter((place) => place.roomId === room.id).length} places
                </div>
              </button>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Add room
            </span>
            <div className="flex gap-2">
              <input
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Utility room"
                className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
              <button
                type="button"
                onClick={() => void addRoom()}
                className="rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
              >
                Add
              </button>
            </div>
          </label>
        </aside>

        <div className="space-y-4">
          <section className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
                  Places and search
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                  {availableRooms.find((room) => room.id === activeRoomId)?.name ?? "Choose a room"}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[14rem] flex-1 md:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-ink-soft)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search items or notes"
                    className="w-full rounded-full border border-black/10 bg-white px-10 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void syncNow()}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)]"
                >
                  {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <Signal className="size-4" />}
                  Sync now
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {roomPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setSelectedPlaceId(place.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    activePlaceId === place.id
                      ? "bg-[color:var(--color-ink)] text-white"
                      : "bg-[color:var(--color-panel-muted)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-highlight)]",
                  )}
                >
                  {place.name}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[1.5rem] bg-[color:var(--color-panel-muted)] p-4">
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  Add place
                </span>
                <div className="flex gap-2">
                  <input
                    value={placeName}
                    onChange={(event) => setPlaceName(event.target.value)}
                    placeholder="Top bathroom cupboard"
                    className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                  />
                  <button
                    type="button"
                    onClick={() => void addPlace()}
                    className="rounded-2xl bg-[color:var(--color-forest)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-forest-deep)]"
                  >
                    Add
                  </button>
                </div>
              </label>
            </div>
          </section>

          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
                    Items
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                    {roomPlaces.find((place) => place.id === activePlaceId)?.name ?? "All places"}
                  </h2>
                </div>
                <Store className="size-5 text-[color:var(--color-forest)]" />
              </div>

              <div className="mt-4 space-y-3">
                {activeItems.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
                    No items yet. Add one on the right and it will appear here immediately, even offline.
                  </div>
                ) : (
                  activeItems.map((item) => (
                    <article
                      key={item.id}
                      className={cn(
                        "rounded-[1.5rem] border px-4 py-4 transition",
                        item.actualStock <= 0
                          ? "border-red-200 bg-red-50"
                          : item.actualStock < item.desiredStock
                            ? "border-amber-200 bg-amber-50"
                            : "border-black/5 bg-[color:var(--color-panel-muted)]",
                      )}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-[color:var(--color-ink)]">
                              {item.name}
                            </h3>
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
                          </div>
                          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                            Target {item.desiredStock}, currently {item.actualStock}
                          </p>
                          {item.notes ? (
                            <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-soft)]">
                              {item.notes}
                            </p>
                          ) : null}
                          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
                            Updated {formatTimestamp(item.updatedAt)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void adjustStock(item, -1)}
                            className="rounded-full border border-black/10 bg-white p-3 text-[color:var(--color-ink)] transition hover:border-[color:var(--color-clay)] hover:text-[color:var(--color-clay)]"
                          >
                            <Minus className="size-4" />
                          </button>
                          <div className="min-w-12 text-center text-lg font-semibold text-[color:var(--color-ink)]">
                            {item.actualStock}
                          </div>
                          <button
                            type="button"
                            onClick={() => void adjustStock(item, 1)}
                            className="rounded-full border border-black/10 bg-white p-3 text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
                Add item
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                Quick capture
              </h2>

              <div className="mt-4 space-y-3">
                <Field label="Item name">
                  <input
                    value={itemDraft.name}
                    onChange={(event) =>
                      setItemDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Toothpaste"
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Desired">
                    <input
                      value={itemDraft.desiredStock}
                      onChange={(event) =>
                        setItemDraft((current) => ({
                          ...current,
                          desiredStock: Number(event.target.value),
                        }))
                      }
                      type="number"
                      min={0}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                    />
                  </Field>

                  <Field label="Actual">
                    <input
                      value={itemDraft.actualStock}
                      onChange={(event) =>
                        setItemDraft((current) => ({
                          ...current,
                          actualStock: Number(event.target.value),
                        }))
                      }
                      type="number"
                      min={0}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                    />
                  </Field>
                </div>

                <Field label="Notes">
                  <textarea
                    value={itemDraft.notes}
                    onChange={(event) =>
                      setItemDraft((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Brand, size, or shopping hints"
                    rows={4}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                  />
                </Field>

                <Field label="Optional image">
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-4 text-sm text-[color:var(--color-ink-soft)] transition hover:border-[color:var(--color-forest)]">
                    <Upload className="size-4 text-[color:var(--color-forest)]" />
                    <span className="truncate">
                      {itemImage ? itemImage.name : "Choose a product photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) =>
                        setItemImage(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </Field>

                {uploadState ? (
                  <p className="rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
                    {uploadState}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void addItem()}
                  className="w-full rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
                >
                  Save item
                </button>
              </div>
            </aside>
          </section>
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/5 bg-white/75 px-5 py-4 text-sm text-[color:var(--color-ink-soft)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p>
            Last bootstrap {lastBootstrapAt ? formatTimestamp(Number(lastBootstrapAt)) : "pending"}.
          </p>
          <p>
            {pendingMutations?.length ?? 0} mutation(s) queued for sync.
          </p>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function getTimestamp() {
  return Date.now();
}

function getId() {
  return crypto.randomUUID();
}

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  caption: string;
  tone: "amber" | "red";
}) {
  const accent =
    tone === "amber"
      ? "bg-[linear-gradient(135deg,#f4c95d,#e88b2d)]"
      : "bg-[linear-gradient(135deg,#d85844,#c4492d)]";

  return (
    <article className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
            {label}
          </p>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-[color:var(--color-ink)]">
            {value}
          </div>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            {caption}
          </p>
        </div>
        <div className={cn("rounded-[1.25rem] p-3 text-white", accent)}>
          <Icon className="size-5" />
        </div>
      </div>
    </article>
  );
}

function toMutation(
  entity: SyncMutation["entity"],
  operation: SyncMutation["operation"],
  payload: SyncMutation["payload"],
  queuedAt: number,
): SyncMutation {
  return {
    id: crypto.randomUUID(),
    entity,
    operation,
    payload,
    queuedAt,
  };
}
