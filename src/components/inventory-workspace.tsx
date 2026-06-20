"use client";

import Link from "next/link";
import { startTransition } from "react";
import { CheckSquare, ChefHat, ListRestart, Loader2, Minus, PackagePlus, Plus } from "lucide-react";
import {
  buildMutation,
  getActiveShoppingList,
  getDinnerPlanForDate,
  getId,
  getLocationLabel,
  getShoppingListCarryOverEntries,
  getTimestamp,
  sortLowStockItems,
  toDateKey,
} from "@/features/inventory/helpers";
import {
  applyItemLocally,
  applyShoppingListEntryLocally,
  applyShoppingListLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
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
      placeLabel: getLocationLabel(item, places, rooms),
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
        placeLabel: item ? getLocationLabel(item, places, rooms) : "Unassigned",
        plannedRecipeName: recipe?.name ?? null,
      };
    }),
    ...derivedLowStockEntries,
  ];
  const itemEntryCounts = getItemEntryCounts(combinedEntries);
  const groupedEntries = groupEntriesByPlace(combinedEntries);

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
