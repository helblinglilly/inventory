"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Loader2, Save, ShoppingBasket, Trash2, Upload } from "lucide-react";
import { offlineDb } from "@/features/inventory/offline-db";
import {
  buildMutation,
  getActiveShoppingList,
  getId,
  getItemPlaceIds,
  getLocationLabel,
  getTimestamp,
} from "@/features/inventory/helpers";
import {
  applyItemLocally,
  applyShoppingListEntryLocally,
  bootstrapFromServer,
  deleteItemLocally,
  enqueueMutation,
  flushMutations,
} from "@/features/inventory/sync";
import type {
  ItemRecord,
  PlaceRecord,
  RoomRecord,
  ShoppingListEntryRecord,
  ShoppingListRecord,
} from "@/features/inventory/types";
import { formatCurrencyFromPence, penceToPoundsInput, poundsToPence } from "@/lib/utils";

type ItemEditorProps = {
  itemId: string;
};

export function ItemEditor({ itemId }: ItemEditorProps) {
  const rooms = useLiveQuery(() => offlineDb.rooms.orderBy("sortOrder").toArray(), [], []);
  const places = useLiveQuery(
    () => offlineDb.places.orderBy("sortOrder").toArray(),
    [],
    [],
  );
  const item = useLiveQuery(() => offlineDb.items.get(itemId), [itemId], undefined);
  const shoppingLists = useLiveQuery(
    () => offlineDb.shoppingLists.orderBy("createdAt").toArray(),
    [],
    [],
  );
  const shoppingListEntries = useLiveQuery(
    () => offlineDb.shoppingListEntries.orderBy("createdAt").toArray(),
    [],
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        await bootstrapFromServer();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-[color:var(--color-ink)] shadow-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading item...
        </div>
      </div>
    );
  }

  if (!item || !rooms || !places || !shoppingLists || !shoppingListEntries) {
    return (
      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-6 text-[color:var(--color-ink)] shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)]"
        >
          <ArrowLeft className="size-4" />
          Back to inventory
        </Link>
        <p className="mt-6 text-lg font-semibold">Item not found.</p>
      </section>
    );
  }

  return (
    <ItemEditorForm
      key={`${item.id}:${item.updatedAt}`}
      item={item}
      places={places}
      rooms={rooms}
      shoppingLists={shoppingLists}
      shoppingListEntries={shoppingListEntries}
    />
  );
}

function ItemEditorForm({
  item,
  places,
  rooms,
  shoppingLists,
  shoppingListEntries,
}: {
  item: ItemRecord;
  places: PlaceRecord[];
  rooms: RoomRecord[];
  shoppingLists: ShoppingListRecord[];
  shoppingListEntries: ShoppingListEntryRecord[];
}) {
  const router = useRouter();
  const currentPlaceIds = getItemPlaceIds(item);
  const currentPlace = places.find((entry) => entry.id === currentPlaceIds[0]);
  const [selectedRoomId, setSelectedRoomId] = useState(currentPlace?.roomId ?? rooms[0]?.id ?? "");
  const [selectedPlaceId, setSelectedPlaceId] = useState(currentPlaceIds[0] ?? "");
  const [linkedPlaceIds, setLinkedPlaceIds] = useState(currentPlaceIds);
  const [name, setName] = useState(item.name);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [desiredStock, setDesiredStock] = useState(item.desiredStock);
  const [actualStock, setActualStock] = useState(item.actualStock);
  const [pricePaid, setPricePaid] = useState(penceToPoundsInput(item.pricePaidPence));
  const [isStaple, setIsStaple] = useState(item.isStaple);
  const [trackPriceHistory, setTrackPriceHistory] = useState(item.trackPriceHistory);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const availablePlaces = places.filter((place) => place.roomId === selectedRoomId);
  const activePlaceId = availablePlaces.some((place) => place.id === selectedPlaceId)
    ? selectedPlaceId
    : availablePlaces[0]?.id ?? "";
  const linkedPlaces = places.filter((place) => linkedPlaceIds.includes(place.id));
  const locationLabel = getLocationLabel(item, places, rooms);
  const activeShoppingList = getActiveShoppingList(shoppingLists);

  function addLinkedPlace() {
    if (!activePlaceId) {
      return;
    }

    setLinkedPlaceIds((current) =>
      current.includes(activePlaceId) ? current : [...current, activePlaceId],
    );
  }

  function removeLinkedPlace(placeId: string) {
    setLinkedPlaceIds((current) => current.filter((entry) => entry !== placeId));
  }

  async function saveItem() {
    const nextPlaceIds = linkedPlaceIds.includes(activePlaceId)
      ? linkedPlaceIds
      : activePlaceId
        ? [...linkedPlaceIds, activePlaceId]
        : linkedPlaceIds;

    if (nextPlaceIds.length === 0) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      let imageUrl = item.imageUrl;
      let imageProxyUrl = item.imageProxyUrl;

      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Image upload failed");
        }

        const payload = (await response.json()) as {
          imageUrl?: string;
          imageProxyUrl?: string;
        };

        imageUrl = payload.imageUrl ?? imageUrl;
        imageProxyUrl = payload.imageProxyUrl ?? imageProxyUrl;
      }

      const timestamp = getTimestamp();
      const nextItem: ItemRecord = {
        ...item,
        placeId: nextPlaceIds[0],
        placeIds: nextPlaceIds,
        name: name.trim(),
        notes: notes.trim() || undefined,
        desiredStock,
        actualStock,
        pricePaidPence: poundsToPence(pricePaid),
        isStaple,
        trackPriceHistory,
        imageUrl,
        imageProxyUrl,
        updatedAt: timestamp,
      };

      await applyItemLocally(nextItem);
      await enqueueMutation(buildMutation("item", "upsert", nextItem, timestamp));

      if (navigator.onLine) {
        await flushMutations();
      }

      setImageFile(null);
      setMessage("Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save item");
    } finally {
      setIsSaving(false);
    }
  }

  async function addToShoppingList() {
    if (!activeShoppingList) {
      setMessage("No active shopping list found");
      return;
    }

    const existingEntry = shoppingListEntries.find(
      (entry) =>
        entry.listId === activeShoppingList.id &&
        entry.itemId === item.id &&
        !entry.checkedAt,
    );

    if (existingEntry) {
      setMessage("Already on the current shopping list");
      return;
    }

    const timestamp = getTimestamp();
    const nextEntry: ShoppingListEntryRecord = {
      id: getId(),
      listId: activeShoppingList.id,
      userId: item.userId,
      itemId: item.id,
      recipeId: null,
      label: item.name,
      sourceType: "manual",
      quantity: 1,
      unitLabel: null,
      checkedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));

    if (navigator.onLine) {
      await flushMutations();
    }

    setMessage("Added to shopping list");
  }

  async function deleteItem() {
    setIsSaving(true);
    setMessage(null);

    try {
      const timestamp = getTimestamp();
      await deleteItemLocally(item.id);
      await enqueueMutation(buildMutation("item", "delete", { id: item.id }, timestamp));

      if (navigator.onLine) {
        await flushMutations();
      }

      router.push("/app/items");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete item");
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-6 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)]"
        >
          <ArrowLeft className="size-4" />
          Back to inventory
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
              Item details
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[color:var(--color-ink)]">
              {item.name}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {locationLabel}
            </p>
          </div>

          {item.imageProxyUrl || item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageProxyUrl ?? item.imageUrl ?? ""}
              alt={item.name}
              className="h-28 w-28 rounded-[1.5rem] object-cover"
            />
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Item name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </Field>

          <Field label="Paid (GBP)">
            <input
              value={pricePaid}
              onChange={(event) => setPricePaid(event.target.value)}
              placeholder="2.75"
              inputMode="decimal"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </Field>

          <Field label="Room">
            <select
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Place">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={activePlaceId}
                  onChange={(event) => setSelectedPlaceId(event.target.value)}
                  disabled={availablePlaces.length === 0}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                >
                  {availablePlaces.length === 0 ? (
                    <option value="">No places in this room</option>
                  ) : null}
                  {availablePlaces.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addLinkedPlace}
                  disabled={!activePlaceId}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
                >
                  Link
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedPlaces.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => removeLinkedPlace(place.id)}
                    className="rounded-full bg-[color:var(--color-panel-muted)] px-3 py-2 text-xs font-medium text-[color:var(--color-ink)]"
                  >
                    {rooms.find((room) => room.id === place.roomId)?.name ?? "Unknown room"} /{" "}
                    {place.name} ×
                  </button>
                ))}
                {linkedPlaceIds
                  .filter((placeId) => !linkedPlaces.some((place) => place.id === placeId))
                  .map((placeId) => (
                    <span
                      key={placeId}
                      className="rounded-full bg-[color:var(--color-panel-muted)] px-3 py-2 text-xs font-medium text-[color:var(--color-ink-soft)]"
                    >
                      Missing place link
                    </span>
                  ))}
                {linkedPlaces.length === 0 ? (
                  <button
                    type="button"
                    onClick={addLinkedPlace}
                    disabled={!activePlaceId}
                    className="text-sm text-[color:var(--color-ink-soft)]"
                  >
                    No linked places yet.
                  </button>
                ) : null}
              </div>
            </div>
          </Field>

          <Field label="Desired stock">
            <input
              type="number"
              min={0}
              value={desiredStock}
              onChange={(event) => setDesiredStock(Number(event.target.value))}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </Field>

          <Field label="Actual stock">
            <input
              type="number"
              min={0}
              value={actualStock}
              onChange={(event) => setActualStock(Number(event.target.value))}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ToggleCard
            title="Kitchen staple"
            description="Useful for basics that may not need recipe costing."
            checked={isStaple}
            onChange={setIsStaple}
          />
          <ToggleCard
            title="Track price history"
            description="Flag items where the paid price matters over time."
            checked={trackPriceHistory}
            onChange={setTrackPriceHistory}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </Field>

          <Field label="Replace image">
            <label className="flex h-full cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-4 text-sm text-[color:var(--color-ink-soft)] transition hover:border-[color:var(--color-forest)]">
              <Upload className="size-4 text-[color:var(--color-forest)]" />
              <span className="truncate">
                {imageFile ? imageFile.name : "Choose a new product photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </Field>
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void addToShoppingList()}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
          >
            <ShoppingBasket className="size-4" />
            Add to shopping list
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void saveItem()}
            className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void deleteItem()}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="size-4" />
            Delete item
          </button>
        </div>
      </section>

      <aside className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Snapshot
        </p>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-[color:var(--color-ink-soft)]">Location</dt>
            <dd className="mt-1 font-medium text-[color:var(--color-ink)]">{locationLabel}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--color-ink-soft)]">Paid</dt>
            <dd className="mt-1 font-medium text-[color:var(--color-ink)]">
              {formatCurrencyFromPence(item.pricePaidPence) ?? "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--color-ink-soft)]">Stock</dt>
            <dd className="mt-1 font-medium text-[color:var(--color-ink)]">
              {item.actualStock} of {item.desiredStock}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={[
        "rounded-[1.5rem] border px-4 py-4 text-left transition",
        checked
          ? "border-[color:var(--color-forest)] bg-[color:var(--color-panel-muted)] shadow-[0_16px_40px_-32px_rgba(22,38,32,0.65)]"
          : "border-black/10 bg-white hover:border-[color:var(--color-forest)]/40 hover:bg-[color:var(--color-panel-muted)]/55",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-[color:var(--color-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{description}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {checked ? "On" : "Off"}
      </p>
    </button>
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
