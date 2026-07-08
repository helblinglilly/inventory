"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { ChefHat, ListRestart, Loader2, Minus, PackagePlus, Plus } from "lucide-react";
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
import { cn, formatCurrencyFromPence } from "@/lib/utils";

type MealUsage = {
  recipeId: string;
  recipeName: string;
  plannedFor: string;
  quantity: number;
  unitLabel: string | null;
};

type ShoppingPlaceMeta = {
  placeLabel: string;
  roomSortOrder: number;
  placeSortOrder: number;
};

export function InventoryWorkspace() {
  const {
    rooms,
    places,
    items,
    shoppingLists,
    shoppingListEntries,
    recipes,
    recipeIngredients,
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
  const plannedMealUsagesByItem = buildPlannedMealUsagesByItem({
    mealPlans,
    recipes,
    recipeIngredients,
    todayDateKey,
  });
  const selectableShoppingRooms = rooms.filter((room) => room.name !== UNCATEGORIZED_ROOM_NAME);
  const effectiveShoppingRoomId =
    selectableShoppingRooms.some((room) => room.id === selectedShoppingRoomId)
      ? selectedShoppingRoomId
      : selectableShoppingRooms[0]?.id ?? rooms[0]?.id ?? "";
  const activeEntryItemIds = new Set(
    activeEntries.flatMap((entry) => (entry.itemId ? [entry.itemId] : [])),
  );
  const normalizedQuickItemName = quickItemName.trim().toLowerCase();
  const quickAddMatches = items
    .filter((item) => {
      if (!normalizedQuickItemName) {
        return false;
      }

      return (
        item.name.trim().toLowerCase().includes(normalizedQuickItemName) ||
        (item.notes ?? "").toLowerCase().includes(normalizedQuickItemName)
      );
    })
    .slice(0, 8);
  const exactQuickAddMatch =
    items.find((item) => item.name.trim().toLowerCase() === normalizedQuickItemName) ?? null;
  const derivedLowStockEntries: ShoppingViewEntry[] = lowStockItems
    .filter((item) => !activeEntryItemIds.has(item.id))
    .map((item) => {
      const placeMeta = getShoppingPlaceMeta(item, places, rooms, effectiveShoppingRoomId);

      return {
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
        placeLabel: placeMeta.placeLabel,
        roomSortOrder: placeMeta.roomSortOrder,
        placeSortOrder: placeMeta.placeSortOrder,
        plannedUsages: plannedMealUsagesByItem.get(item.id) ?? [],
      };
    });
  const combinedEntries: ShoppingViewEntry[] = [
    ...activeEntries.map((entry) => {
      const item = entry.itemId
        ? (items.find((candidate) => candidate.id === entry.itemId) ?? null)
        : null;
      const placeMeta = item
        ? getShoppingPlaceMeta(item, places, rooms, effectiveShoppingRoomId)
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
        placeLabel: placeMeta?.placeLabel ?? "Unassigned",
        roomSortOrder: placeMeta?.roomSortOrder ?? Number.MAX_SAFE_INTEGER,
        placeSortOrder: placeMeta?.placeSortOrder ?? Number.MAX_SAFE_INTEGER,
        plannedUsages: item ? (plannedMealUsagesByItem.get(item.id) ?? []) : [],
      };
    }),
    ...derivedLowStockEntries,
  ];
  const itemEntryCounts = getItemEntryCounts(combinedEntries);
  const groupedEntries = groupEntriesByPlace(combinedEntries);
  const expectedTotalPricePence = getExpectedGroupPricePence(combinedEntries);

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

  async function ensurePersistedShoppingEntry(entry: ShoppingViewEntry) {
    if (!activeShoppingList || !entry.item) {
      return null;
    }

    if (entry.entryId) {
      return shoppingListEntries.find((candidate) => candidate.id === entry.entryId) ?? null;
    }

    const timestamp = getTimestamp();
    const nextEntry: ShoppingListEntryRecord = {
      id: getId(),
      listId: activeShoppingList.id,
      userId: entry.item.userId,
      itemId: entry.item.id,
      recipeId: entry.recipeId,
      label: entry.label,
      sourceType: entry.sourceType,
      quantity: entry.quantity,
      unitLabel: entry.unitLabel,
      checkedAt: entry.checkedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(
      buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp),
    );

    return nextEntry;
  }

  async function adjustItemStock(
    entry: ShoppingViewEntry,
    delta: number,
    options?: { syncAfter?: boolean },
  ) {
    if (!entry.item) {
      return;
    }

    await ensurePersistedShoppingEntry(entry);

    const timestamp = getTimestamp();
    const nextItem = {
      ...entry.item,
      actualStock: Math.max(entry.item.actualStock + delta, 0),
      updatedAt: timestamp,
    };

    await applyItemLocally(nextItem);
    await enqueueMutation(
      buildMutation(
        "item",
        "adjust-stock",
        { id: entry.item.id, delta, updatedAt: timestamp },
        timestamp,
      ),
    );

    if (options?.syncAfter !== false) {
      await syncNow();
    }
  }

  async function toggleEntryChecked(entry: ShoppingViewEntry, checked: boolean) {
    if (!activeShoppingList) {
      return;
    }

    const persistedEntry = await ensurePersistedShoppingEntry(entry);
    const nextEntry = persistedEntry
      ? {
          ...persistedEntry,
          checkedAt: checked ? getTimestamp() : null,
          updatedAt: getTimestamp(),
        }
      : null;

    if (!nextEntry) {
      return;
    }

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(
      buildMutation(
        "shopping-list-entry",
        "upsert",
        nextEntry,
        nextEntry.updatedAt,
      ),
    );

    await syncNow();
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

    await syncNow();
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

    const existingItem = exactQuickAddMatch;
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

    await addShoppingEntryForItem({
      item,
      quantity,
      label: name,
      timestamp,
    });

    setQuickItemName("");
    setQuickItemQuantity("1");
    setMessage(
      item === existingItem && existingItem
        ? `${existingItem.name} added to the shopping list`
        : `${name} added to the shopping list`,
    );

    await syncNow();
  }

  async function addShoppingEntryForItem({
    item,
    quantity,
    label,
    timestamp = getTimestamp(),
  }: {
    item: NonNullable<ReturnType<typeof useInventoryData>["items"][number]> | null;
    quantity: number;
    label: string;
    timestamp?: number;
  }) {
    if (!activeShoppingList) {
      return;
    }

    const existingEntry = activeEntries.find(
      (entry) =>
        !entry.checkedAt &&
        ((item && entry.itemId === item.id) ||
          (!item && entry.label.trim().toLowerCase() === label.trim().toLowerCase())),
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
          label,
          sourceType: "manual",
          quantity,
          unitLabel: null,
          checkedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));
  }

  async function addExistingQuickMatch(itemId: string) {
    if (!activeShoppingList) {
      return;
    }

    const item = items.find((entry) => entry.id === itemId) ?? null;
    if (!item) {
      return;
    }

    const quantity = Math.max(Number(quickItemQuantity) || 1, 1);
    const timestamp = getTimestamp();
    await addShoppingEntryForItem({
      item,
      quantity,
      label: item.name,
      timestamp,
    });
    setQuickItemName("");
    setQuickItemQuantity("1");
    setMessage(`${item.name} added to the shopping list`);
    await syncNow();
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
            {expectedTotalPricePence != null ? (
              <p className="mt-2 text-sm font-medium text-[color:var(--color-ink-soft)]">
                Expected total {formatCurrencyFromPence(expectedTotalPricePence)}
              </p>
            ) : null}
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
            placeholder="Search or add a shopping item"
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
            {exactQuickAddMatch ? "Add match" : "Create item"}
          </button>
        </div>
        {normalizedQuickItemName ? (
          <div className="mt-3 space-y-2">
            {exactQuickAddMatch ? (
              <p className="rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
                Exact match found:{" "}
                <span className="font-semibold text-[color:var(--color-ink)]">
                  {exactQuickAddMatch.name}
                </span>
                . Add it directly or pick from the matches below.
              </p>
            ) : null}
            {quickAddMatches.length > 0 ? (
              <div className="grid gap-2">
                {quickAddMatches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => startTransition(() => void addExistingQuickMatch(item.id))}
                    className="w-full rounded-[1.25rem] border border-black/10 bg-white px-4 py-3 text-left transition hover:border-[color:var(--color-forest)] hover:bg-[color:var(--color-panel-muted)]/55"
                  >
                    <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                      {item.name}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                      {item.actualStock}/{item.desiredStock} in stock
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-black/10 bg-white/70 px-4 py-4 text-sm text-[color:var(--color-ink-soft)]">
                No registered item matches yet. Creating this will add a brand-new inventory item.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-5">
      <ShoppingSection
        groupedEntries={groupedEntries}
        itemEntryCounts={itemEntryCounts}
        todayDateKey={todayDateKey}
        onToggleEntryChecked={toggleEntryChecked}
        onAdjustItemStock={adjustItemStock}
      />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => startTransition(() => void createNewList())}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
          >
            <ListRestart className="size-4" />
            Complete shopping trip
          </button>
          <NavButton href="/app/shopping-prep" label="Shopping prep" />
        </div>
      </section>
    </div>
  );
}

function ShoppingSection({
  groupedEntries,
  itemEntryCounts,
  todayDateKey,
  onToggleEntryChecked,
  onAdjustItemStock,
}: {
  groupedEntries: Array<{
    placeLabel: string;
    entries: ShoppingViewEntry[];
  }>;
  itemEntryCounts: Map<string, number>;
  todayDateKey: string;
  onToggleEntryChecked: (entry: ShoppingViewEntry, checked: boolean) => Promise<void>;
  onAdjustItemStock: (entry: ShoppingViewEntry, delta: number) => Promise<void>;
}) {
  return (
    <>
      <div className="mt-4 space-y-3">
        {groupedEntries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            No shopping items yet. Low-stock items and recipe ingredients will show up here.
          </div>
        ) : (
          groupedEntries.map((group) => {
            const expectedGroupPricePence = getExpectedGroupPricePence(group.entries);

            return (
              <div
                key={group.placeLabel}
                className="rounded-[1.5rem] border border-black/5 bg-white/75 p-3"
              >
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    {group.placeLabel}
                  </p>
                  {expectedGroupPricePence != null ? (
                    <p className="mt-1 text-sm font-medium text-[color:var(--color-ink)]">
                      Expected total {formatCurrencyFromPence(expectedGroupPricePence)}
                    </p>
                  ) : null}
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
                  const expectedEntryPricePence = getExpectedEntryPricePence(entry);

                  return (
                    <article
                      key={entry.id}
                      className={cn(
                        "rounded-[1.25rem] border px-4 py-4 transition",
                        isChecked
                          ? "border-black/5 bg-white/70 opacity-70"
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
                            {entry.plannedUsages.length > 0
                              ? entry.plannedUsages.map((usage) => (
                                  <span
                                    key={`${entry.id}:${usage.recipeId}:${usage.plannedFor}:${usage.quantity}:${usage.unitLabel ?? "x"}`}
                                    className="rounded-full bg-[color:var(--color-forest)]/10 px-3 py-1 text-xs font-medium text-[color:var(--color-forest)]"
                                  >
                                    {getUsageDayLabel(usage.plannedFor, todayDateKey)} · {usage.recipeName}
                                  </span>
                                ))
                              : null}
                            {entry.sourceType === "low-stock" && entry.plannedUsages.length === 0 ? (
                              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
                                Restock
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
                          </p>
                        </div>
                        {entry.item ? (
                          <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void onAdjustItemStock(entry, -1)}
                                disabled={entry.item.actualStock <= 0}
                                aria-label={`Remove one ${entry.label} from stock`}
                                className="inline-flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Minus className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void onAdjustItemStock(entry, 1)}
                                aria-label={`Add one ${entry.label} to stock`}
                                className="inline-flex size-9 items-center justify-center rounded-full bg-[color:var(--color-clay)] text-white transition hover:bg-[#a63c22]"
                              >
                                <Plus className="size-4" />
                              </button>
                            </div>
                            <p
                              className={cn(
                                "text-sm text-[color:var(--color-ink-soft)]",
                                isChecked && "line-through decoration-2 opacity-70",
                              )}
                            >
                              {entry.item.actualStock}/{entry.item.desiredStock}
                            </p>
                            {expectedEntryPricePence != null ? (
                              <p
                                className={cn(
                                  "text-sm font-medium text-[color:var(--color-ink)]",
                                  isChecked && "line-through decoration-2 opacity-70",
                                )}
                              >
                                {formatCurrencyFromPence(expectedEntryPricePence)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
              </div>
            );
          })
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
  roomSortOrder: number;
  placeSortOrder: number;
  plannedUsages: MealUsage[];
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

function getExpectedEntryPricePence(entry: ShoppingViewEntry) {
  if (!entry.item?.pricePaidPence) {
    return null;
  }

  return Math.round(entry.item.pricePaidPence * entry.quantity);
}

function getExpectedGroupPricePence(entries: ShoppingViewEntry[]) {
  const pricedEntries = entries
    .filter((entry) => !entry.checkedAt)
    .map(getExpectedEntryPricePence)
    .filter((value): value is number => value != null);

  if (pricedEntries.length === 0) {
    return null;
  }

  return pricedEntries.reduce((total, value) => total + value, 0);
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
    .sort(([, leftEntries], [, rightEntries]) => {
      const leftEntry = leftEntries[0];
      const rightEntry = rightEntries[0];

      if (leftEntry.roomSortOrder !== rightEntry.roomSortOrder) {
        return leftEntry.roomSortOrder - rightEntry.roomSortOrder;
      }

      if (leftEntry.placeSortOrder !== rightEntry.placeSortOrder) {
        return leftEntry.placeSortOrder - rightEntry.placeSortOrder;
      }

      return leftEntry.placeLabel.localeCompare(rightEntry.placeLabel);
    })
    .map(([placeLabel, groupedEntries]) => ({
      placeLabel,
      entries: groupedEntries,
    }));
}

function getShoppingPlaceMeta(
  item: ReturnType<typeof useInventoryData>["items"][number],
  places: ReturnType<typeof useInventoryData>["places"],
  rooms: ReturnType<typeof useInventoryData>["rooms"],
  roomId: string,
) : ShoppingPlaceMeta {
  if (!roomId) {
    const itemPlaces = getItemPlaces(item, places).sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name),
    );
    const primaryPlace = itemPlaces[0] ?? null;
    const primaryRoom = primaryPlace
      ? (rooms.find((entry) => entry.id === primaryPlace.roomId) ?? null)
      : null;

    return {
      placeLabel: getLocationLabel(
        {
          ...item,
          placeId: primaryPlace?.id ?? item.placeId,
          placeIds: itemPlaces.map((place) => place.id),
        },
        places,
        rooms,
      ),
      roomSortOrder: primaryRoom?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      placeSortOrder: primaryPlace?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    };
  }

  const room = rooms.find((entry) => entry.id === roomId) ?? null;
  const matchingPlaces = getItemPlaces(item, places)
    .filter((place) => place.roomId === roomId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

  if (matchingPlaces.length === 0) {
    return {
      placeLabel: room ? `${room.name} / Unassigned` : "Unassigned",
      roomSortOrder: room?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      placeSortOrder: Number.MAX_SAFE_INTEGER,
    };
  }

  const scopedItem = {
    ...item,
    placeId: matchingPlaces[0].id,
    placeIds: matchingPlaces.map((place) => place.id),
  };

  return {
    placeLabel: getLocationLabel(scopedItem, places, rooms),
    roomSortOrder: room?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    placeSortOrder: matchingPlaces[0]?.sortOrder ?? Number.MAX_SAFE_INTEGER,
  };
}

function buildPlannedMealUsagesByItem({
  mealPlans,
  recipes,
  recipeIngredients,
  todayDateKey,
}: {
  mealPlans: ReturnType<typeof useInventoryData>["mealPlans"];
  recipes: ReturnType<typeof useInventoryData>["recipes"];
  recipeIngredients: ReturnType<typeof useInventoryData>["recipeIngredients"];
  todayDateKey: string;
}) {
  const usagesByItem = new Map<string, MealUsage[]>();
  const upcomingPlans = mealPlans
    .filter((plan) => plan.recipeId && plan.plannedFor >= todayDateKey)
    .sort((left, right) => left.plannedFor.localeCompare(right.plannedFor));

  for (const plan of upcomingPlans) {
    const recipe = recipes.find((candidate) => candidate.id === plan.recipeId);
    if (!recipe) {
      continue;
    }

    const ingredients = recipeIngredients.filter((ingredient) => ingredient.recipeId === recipe.id);

    for (const ingredient of ingredients) {
      const usages = usagesByItem.get(ingredient.itemId) ?? [];
      usages.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        plannedFor: plan.plannedFor,
        quantity: ingredient.quantity,
        unitLabel: ingredient.unitLabel ?? null,
      });
      usagesByItem.set(ingredient.itemId, usages);
    }
  }

  return usagesByItem;
}

function getUsageDayLabel(plannedFor: string, todayDateKey: string) {
  if (plannedFor === todayDateKey) {
    return "Today";
  }

  return new Date(`${plannedFor}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
  });
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
