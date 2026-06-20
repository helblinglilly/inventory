"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { CheckSquare, ChefHat, ListRestart, Loader2, Minus, PackagePlus, Plus } from "lucide-react";
import {
  buildMutation,
  getActiveShoppingList,
  getDinnerPlanForDate,
  getId,
  getItemPlaces,
  getLocationLabel,
  getShoppingListCarryOverEntries,
  getTimestamp,
  UNCATEGORIZED_PLACE_NAME,
  UNCATEGORIZED_ROOM_NAME,
  sortLowStockItems,
  toDateKey,
} from "@/features/inventory/helpers";
import {
  applyItemLocally,
  applyPlaceLocally,
  applyRoomLocally,
  applyShoppingListEntryLocally,
  applyShoppingListLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import type { PlaceRecord, RoomRecord, ShoppingListEntryRecord } from "@/features/inventory/types";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import { cn } from "@/lib/utils";

export function InventoryWorkspace() {
  const {
    rooms,
    places,
    items,
    shoppingLists,
    shoppingListEntries,
    recipes,
    mealPlans,
    isBootstrapping,
    syncNow,
  } = useInventoryData();
  const [quickItemName, setQuickItemName] = useState("");
  const [quickItemQuantity, setQuickItemQuantity] = useState("1");
  const [selectedShoppingRoomId, setSelectedShoppingRoomId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const activeShoppingList = getActiveShoppingList(shoppingLists);
  const activeEntries = shoppingListEntries.filter(
    (entry) => entry.listId === activeShoppingList?.id,
  );
  const todayDateKey = toDateKey(new Date());
  const lowStockItems = sortLowStockItems(
    items.filter((item) => item.actualStock < item.desiredStock),
  );
  const todayPlan = getDinnerPlanForDate(mealPlans, todayDateKey);
  const todayRecipe = recipes.find((recipe) => recipe.id === todayPlan?.recipeId) ?? null;
  const selectableShoppingRooms = rooms.filter((room) => room.name !== UNCATEGORIZED_ROOM_NAME);
  const effectiveShoppingRoomId =
    selectableShoppingRooms.some((room) => room.id === selectedShoppingRoomId)
      ? selectedShoppingRoomId
      : selectableShoppingRooms[0]?.id ?? rooms[0]?.id ?? "";
  const futurePlannedRecipeIds = new Set(
    mealPlans.flatMap((mealPlan) =>
      mealPlan.recipeId && mealPlan.plannedFor > todayDateKey ? [mealPlan.recipeId] : [],
    ),
  );
  const activeEntryItemIds = new Set(
    activeEntries.flatMap((entry) => (entry.itemId ? [entry.itemId] : [])),
  );
  const derivedLowStockEntries: ShoppingViewEntry[] = lowStockItems
    .filter((item) => !activeEntryItemIds.has(item.id))
    .map((item) => ({
      id: `derived-${item.id}`,
      entryId: null,
      item,
      itemId: item.id,
      recipeId: null,
      label: item.name,
      sourceType: "low-stock",
      quantity: Math.max(item.desiredStock - item.actualStock, 1),
      unitLabel: null,
      checkedAt: null,
      isDerived: true,
      placeLabel: getShoppingRoomLabel(item, places, rooms, effectiveShoppingRoomId),
      plannedRecipeName: null,
    }));
  const combinedEntries: ShoppingViewEntry[] = [
    ...activeEntries.map((entry) => {
      const item = entry.itemId
        ? (items.find((candidate) => candidate.id === entry.itemId) ?? null)
        : null;
      const recipe =
        entry.recipeId && futurePlannedRecipeIds.has(entry.recipeId)
          ? (recipes.find((candidate) => candidate.id === entry.recipeId) ?? null)
          : null;

      return {
        id: entry.id,
        entryId: entry.id,
        item,
        itemId: entry.itemId ?? null,
        recipeId: entry.recipeId ?? null,
        label: entry.label,
        sourceType: entry.sourceType,
        quantity: entry.quantity,
        unitLabel: entry.unitLabel ?? null,
        checkedAt: entry.checkedAt ?? null,
        isDerived: false,
        placeLabel: item
          ? getShoppingRoomLabel(item, places, rooms, effectiveShoppingRoomId)
          : "Unassigned",
        plannedRecipeName: recipe?.name ?? null,
      };
    }),
    ...derivedLowStockEntries,
  ];
  const itemEntryCounts = getItemEntryCounts(combinedEntries);
  const groupedEntries = groupEntriesByPlace(combinedEntries);

  function getUncategorizedPlaceSnapshot() {
    const existingRoom =
      rooms.find((room) => room.name === UNCATEGORIZED_ROOM_NAME) ?? null;
    const existingPlace =
      places.find(
        (place) =>
          place.name === UNCATEGORIZED_PLACE_NAME &&
          existingRoom &&
          place.roomId === existingRoom.id,
      ) ?? null;

    return { existingRoom, existingPlace };
  }

  async function adjustItemStock(
    item: NonNullable<ShoppingViewEntry["item"]>,
    delta: number,
    options?: { syncAfter?: boolean },
  ) {
    const timestamp = getTimestamp();
    const nextItem = {
      ...item,
      actualStock: Math.max(item.actualStock + delta, 0),
      updatedAt: timestamp,
    };

    await applyItemLocally(nextItem);
    await enqueueMutation(
      buildMutation(
        "item",
        "adjust-stock",
        { id: item.id, delta, updatedAt: timestamp },
        timestamp,
      ),
    );

    if (options?.syncAfter !== false && navigator.onLine) {
      await syncNow();
    }
  }

  async function toggleEntryChecked(entry: ShoppingViewEntry, checked: boolean) {
    if (!activeShoppingList) {
      return;
    }

    const timestamp = getTimestamp();
    const persistedEntry = entry.entryId
      ? (shoppingListEntries.find((candidate) => candidate.id === entry.entryId) ?? null)
      : null;
    const nextEntry = persistedEntry
      ? {
          ...persistedEntry,
          checkedAt: checked ? timestamp : null,
          updatedAt: timestamp,
        }
      : entry.item
        ? {
            id: getId(),
            listId: activeShoppingList.id,
            userId: entry.item.userId,
            itemId: entry.item.id,
            recipeId: null,
            label: entry.item.name,
            sourceType: "low-stock" as const,
            quantity: entry.quantity,
            unitLabel: entry.unitLabel,
            checkedAt: checked ? timestamp : null,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        : null;

    if (!nextEntry) {
      return;
    }

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));

    if (entry.item && checked !== Boolean(entry.checkedAt)) {
      await adjustItemStock(entry.item, checked ? entry.quantity : -entry.quantity, {
        syncAfter: false,
      });
    }

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function addLowStockItems() {
    if (!activeShoppingList) {
      return;
    }

    const timestamp = getTimestamp();
    const existingItemIds = new Set(
      activeEntries.filter((entry) => !entry.checkedAt).map((entry) => entry.itemId),
    );

    for (const item of lowStockItems) {
      if (existingItemIds.has(item.id)) {
        continue;
      }

      const nextEntry = {
        id: getId(),
        listId: activeShoppingList.id,
        userId: item.userId,
        itemId: item.id,
        recipeId: null,
        label: item.name,
        sourceType: "low-stock" as const,
        quantity: Math.max(item.desiredStock - item.actualStock, 1),
        unitLabel: null,
        checkedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await applyShoppingListEntryLocally(nextEntry);
      await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));
    }

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function createNewList() {
    if (!activeShoppingList) {
      return;
    }

    const timestamp = getTimestamp();
    const archivedList = {
      ...activeShoppingList,
      status: "archived" as const,
      clearedAt: timestamp,
      updatedAt: timestamp,
    };
    const nextList = {
      id: getId(),
      userId: activeShoppingList.userId,
      name: "Current list",
      status: "active" as const,
      clearedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const carryOverEntries = getShoppingListCarryOverEntries(
      shoppingListEntries,
      activeShoppingList.id,
      items,
    ).map((entry) => ({
      ...entry,
      id: getId(),
      listId: nextList.id,
      checkedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    await applyShoppingListLocally(archivedList);
    await applyShoppingListLocally(nextList);
    await enqueueMutation(buildMutation("shopping-list", "upsert", archivedList, timestamp));
    await enqueueMutation(buildMutation("shopping-list", "upsert", nextList, timestamp));

    for (const entry of carryOverEntries) {
      await applyShoppingListEntryLocally(entry);
      await enqueueMutation(buildMutation("shopping-list-entry", "upsert", entry, timestamp));
    }

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function quickAddShoppingItem() {
    if (!activeShoppingList) {
      setMessage("No active shopping list found");
      return;
    }

    const name = quickItemName.trim();
    const quantity = Math.max(Number(quickItemQuantity) || 1, 1);

    if (!name) {
      return;
    }

    const normalizedName = name.toLowerCase();
    const existingItem =
      items.find((item) => item.name.trim().toLowerCase() === normalizedName) ?? null;
    const timestamp = getTimestamp();
    let item = existingItem;

    if (!item) {
      const { existingRoom, existingPlace } = getUncategorizedPlaceSnapshot();
      const room: RoomRecord =
        existingRoom ?? {
          id: getId(),
          userId: activeShoppingList.userId,
          name: UNCATEGORIZED_ROOM_NAME,
          sortOrder: rooms.length,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      const place: PlaceRecord =
        existingPlace ?? {
          id: getId(),
          roomId: room.id,
          userId: activeShoppingList.userId,
          name: UNCATEGORIZED_PLACE_NAME,
          sortOrder: places.filter((entry) => entry.roomId === room.id).length,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

      if (!existingRoom) {
        await applyRoomLocally(room);
        await enqueueMutation(buildMutation("room", "upsert", room, timestamp));
      }

      if (!existingPlace) {
        await applyPlaceLocally(place);
        await enqueueMutation(buildMutation("place", "upsert", place, timestamp));
      }

      item = {
        id: getId(),
        placeId: place.id,
        placeIds: [place.id],
        userId: activeShoppingList.userId,
        name,
        notes: null,
        imageUrl: null,
        imageProxyUrl: null,
        pricePaidPence: null,
        isStaple: false,
        trackPriceHistory: true,
        desiredStock: quantity,
        actualStock: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await applyItemLocally(item);
      await enqueueMutation(buildMutation("item", "upsert", item, timestamp));
    }

    const existingEntry = activeEntries.find(
      (entry) =>
        !entry.checkedAt &&
        ((item && entry.itemId === item.id) ||
          (!item && entry.label.trim().toLowerCase() === normalizedName)),
    );

    const nextEntry: ShoppingListEntryRecord = existingEntry
      ? {
          ...existingEntry,
          quantity: existingEntry.quantity + quantity,
          updatedAt: timestamp,
        }
      : {
          id: getId(),
          listId: activeShoppingList.id,
          userId: activeShoppingList.userId,
          itemId: item?.id ?? null,
          recipeId: null,
          label: name,
          sourceType: "manual",
          quantity,
          unitLabel: null,
          checkedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));

    setQuickItemName("");
    setQuickItemQuantity("1");
    setMessage(`${name} added to the shopping list`);

    if (navigator.onLine) {
      await syncNow();
    }
  }

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-[color:var(--color-ink)] shadow-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading shopping list...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
              Today&apos;s meal
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              {todayRecipe?.name ?? todayPlan?.notes ?? "Nothing planned yet"}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {todayRecipe
                ? (todayPlan?.notes ?? "")
                : "Plan something for today from the meal calendar"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <NavButton href="/app/planner" label="Meal Calendar" />
            <NavButton href="/app/recipes" label="Recipes" />
            {todayRecipe ? (
              <Link
                href={`/app/recipe/${todayRecipe.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
              >
                <ChefHat className="size-4" />
                View meal
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
        <div className="flex flex-wrap gap-3">
          <NavButton href="/app/add" label="Track new item" icon={PackagePlus} />
          <NavButton href="/app/items" label="View inventory" />
          <NavButton href="/app/places" label="Places" />
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              Shopping List
            </h2>
          </div>
          <label className="flex min-w-[15rem] flex-col gap-2 text-sm text-[color:var(--color-ink-soft)]">
            <span className="text-xs uppercase tracking-[0.18em]">Categorise by room</span>
            <select
              value={effectiveShoppingRoomId}
              onChange={(event) => setSelectedShoppingRoomId(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-forest)]"
            >
              {(selectableShoppingRooms.length > 0 ? selectableShoppingRooms : rooms).map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_7rem_auto]">
          <input
            value={quickItemName}
            onChange={(event) => setQuickItemName(event.target.value)}
            placeholder="Quick add a shopping item"
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
          />
          <input
            type="number"
            min={1}
            value={quickItemQuantity}
            onChange={(event) => setQuickItemQuantity(event.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
          />
          <button
            type="button"
            onClick={() => startTransition(() => void quickAddShoppingItem())}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
          >
            <Plus className="size-4" />
            Add item
          </button>
        </div>

        <div className="mt-5">
          <ShoppingSection
            groupedEntries={groupedEntries}
            itemEntryCounts={itemEntryCounts}
            onToggleEntryChecked={toggleEntryChecked}
            onAdjustItemStock={adjustItemStock}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => startTransition(() => void addLowStockItems())}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
          >
            <CheckSquare className="size-4" />
            Save low stock items
          </button>
          <button
            type="button"
            onClick={() => startTransition(() => void createNewList())}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
          >
            <ListRestart className="size-4" />
            Complete shopping trip
          </button>
        </div>
      </section>
    </div>
  );
}

function ShoppingSection({
  groupedEntries,
  itemEntryCounts,
  onToggleEntryChecked,
  onAdjustItemStock,
}: {
  groupedEntries: Array<{
    placeLabel: string;
    entries: ShoppingViewEntry[];
  }>;
  itemEntryCounts: Map<string, number>;
  onToggleEntryChecked: (entry: ShoppingViewEntry, checked: boolean) => Promise<void>;
  onAdjustItemStock: (item: NonNullable<ShoppingViewEntry["item"]>, delta: number) => Promise<void>;
}) {
  return (
    <>
      <div className="mt-4 space-y-3">
        {groupedEntries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            No shopping items yet. Low-stock items and recipe ingredients will show up here.
          </div>
        ) : (
          groupedEntries.map((group) => (
            <div
              key={group.placeLabel}
              className="rounded-[1.5rem] border border-black/5 bg-white/75 p-3"
            >
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    {group.placeLabel}
                  </p>
                </div>
                <div className="rounded-full bg-[color:var(--color-panel-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--color-ink)]">
                  {group.entries.filter((entry) => !entry.checkedAt).length} open
                </div>
              </div>

              <div className="space-y-3">
                {group.entries.map((entry) => {
                  const itemEntryCount = entry.itemId
                    ? (itemEntryCounts.get(entry.itemId) ?? 0)
                    : 0;
                  const showCheckbox = !entry.itemId || itemEntryCount <= 1;
                  const isChecked = Boolean(entry.checkedAt);

                  return (
                    <article
                      key={entry.id}
                      className={cn(
                        "rounded-[1.25rem] border px-4 py-4 transition",
                        isChecked
                          ? "border-black/5 bg-white/70 opacity-70"
                          : entry.sourceType === "recipe"
                            ? "border-[color:var(--color-forest)]/20 bg-[color:var(--color-forest)]/5"
                            : entry.sourceType === "manual"
                              ? "border-sky-200 bg-sky-50/80"
                              : "border-amber-200 bg-amber-50/80",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {showCheckbox ? (
                          <input
                            type="checkbox"
                            checked={Boolean(entry.checkedAt)}
                            onChange={(event) =>
                              void onToggleEntryChecked(entry, event.target.checked)
                            }
                            className="mt-1 size-5 rounded border-black/20"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          {entry.item ? (
                            <Link
                              href={`/app/items/${entry.item.id}`}
                              className={cn(
                                "text-base font-semibold text-[color:var(--color-ink)] underline-offset-4 hover:underline",
                                isChecked && "line-through decoration-2 opacity-70",
                              )}
                            >
                              {entry.label}
                            </Link>
                          ) : (
                            <h3
                              className={cn(
                                "text-base font-semibold text-[color:var(--color-ink)]",
                                isChecked && "line-through decoration-2 opacity-70",
                              )}
                            >
                              {entry.label}
                            </h3>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {entry.sourceType === "manual" ? (
                              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
                                Manual item
                              </span>
                            ) : null}
                            {entry.plannedRecipeName ? (
                              <span className="rounded-full bg-[color:var(--color-forest)]/10 px-3 py-1 text-xs font-medium text-[color:var(--color-forest)]">
                                {entry.plannedRecipeName}
                              </span>
                            ) : null}
                          </div>
                          <p
                            className={cn(
                              "mt-2 text-sm text-[color:var(--color-ink-soft)]",
                              isChecked && "line-through decoration-2 opacity-70",
                            )}
                          >
                            {entry.quantity} {entry.unitLabel ?? "x"}
                            {entry.item
                              ? ` · ${entry.item.actualStock}/${entry.item.desiredStock} in stock`
                              : ""}
                          </p>
                        </div>
                        {entry.item ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void onAdjustItemStock(entry.item!, -1)}
                              disabled={entry.item.actualStock <= 0}
                              aria-label={`Remove one ${entry.label} from stock`}
                              className="inline-flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onAdjustItemStock(entry.item!, 1)}
                              aria-label={`Add one ${entry.label} to stock`}
                              className="inline-flex size-9 items-center justify-center rounded-full bg-[color:var(--color-clay)] text-white transition hover:bg-[#a63c22]"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

type ShoppingViewEntry = {
  id: string;
  entryId: string | null;
  item: ReturnType<typeof useInventoryData>["items"][number] | null;
  itemId: string | null;
  recipeId: string | null;
  label: string;
  sourceType: "manual" | "low-stock" | "recipe";
  quantity: number;
  unitLabel: string | null;
  checkedAt: number | null;
  isDerived: boolean;
  placeLabel: string;
  plannedRecipeName: string | null;
};

function getItemEntryCounts(entries: ShoppingViewEntry[]) {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.itemId) {
      continue;
    }

    counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + 1);
  }

  return counts;
}

function groupEntriesByPlace(entries: ShoppingViewEntry[]) {
  const groups = new Map<string, ShoppingViewEntry[]>();

  for (const entry of [...entries].sort((left, right) => {
    if (Boolean(left.checkedAt) !== Boolean(right.checkedAt)) {
      return left.checkedAt ? 1 : -1;
    }

    return left.label.localeCompare(right.label);
  })) {
    const current = groups.get(entry.placeLabel) ?? [];
    current.push(entry);
    groups.set(entry.placeLabel, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([placeLabel, groupedEntries]) => ({
      placeLabel,
      entries: groupedEntries,
    }));
}

function getShoppingRoomLabel(
  item: ReturnType<typeof useInventoryData>["items"][number],
  places: ReturnType<typeof useInventoryData>["places"],
  rooms: ReturnType<typeof useInventoryData>["rooms"],
  roomId: string,
) {
  if (!roomId) {
    return getLocationLabel(item, places, rooms);
  }

  const room = rooms.find((entry) => entry.id === roomId) ?? null;
  const matchingPlaces = getItemPlaces(item, places).filter((place) => place.roomId === roomId);

  if (matchingPlaces.length === 0) {
    return room ? `${room.name} / Unassigned` : "Unassigned";
  }

  const scopedItem = {
    ...item,
    placeId: matchingPlaces[0].id,
    placeIds: matchingPlaces.map((place) => place.id),
  };

  return getLocationLabel(scopedItem, places, rooms);
}

function NavButton({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon?: typeof PackagePlus;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </Link>
  );
}
