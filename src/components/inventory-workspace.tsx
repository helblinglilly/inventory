"use client";

import Link from "next/link";
import { startTransition } from "react";
import { CheckSquare, ListRestart, Loader2, PackagePlus, ShoppingBasket } from "lucide-react";
import {
  buildMutation,
  getActiveShoppingList,
  getId,
  getLocationLabel,
  getShoppingListCarryOverEntries,
  getTimestamp,
  sortLowStockItems,
} from "@/features/inventory/helpers";
import {
  applyShoppingListEntryLocally,
  applyShoppingListLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import { cn, formatTimestamp } from "@/lib/utils";

export function InventoryWorkspace() {
  const {
    rooms,
    places,
    items,
    shoppingLists,
    shoppingListEntries,
    pendingMutations,
    lastBootstrapAt,
    isBootstrapping,
    syncNow,
  } = useInventoryData();

  const activeShoppingList = getActiveShoppingList(shoppingLists);
  const activeEntries = shoppingListEntries.filter(
    (entry) => entry.listId === activeShoppingList?.id,
  );
  const lowStockItems = sortLowStockItems(items.filter((item) => item.actualStock < item.desiredStock));

  async function toggleEntryChecked(entryId: string, checked: boolean) {
    const entry = shoppingListEntries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return;
    }

    const timestamp = getTimestamp();
    const nextEntry = {
      ...entry,
      checkedAt: checked ? timestamp : null,
      updatedAt: timestamp,
    };

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(
      buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp),
    );

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
      await enqueueMutation(
        buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp),
      );
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
              Shopping list
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              Buy these next
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              Home is focused on what needs buying. Everything else lives on its own page.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
            <ShoppingBasket className="size-4 text-[color:var(--color-forest)]" />
            {activeEntries.filter((entry) => !entry.checkedAt).length} to buy
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <NavButton href="/app/add" label="Add" icon={PackagePlus} />
          <NavButton href="/app/rooms" label="Rooms" />
          <NavButton href="/app/places" label="Places" />
          <NavButton href="/app/items" label="Items" />
          <NavButton href="/app/recipes" label="Recipes" />
          <NavButton href="/app/planner" label="Planner" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[1.5rem] border border-black/5 bg-[color:var(--color-panel-muted)] p-4 md:col-span-2 xl:col-span-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => startTransition(() => void addLowStockItems())}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
              >
                <CheckSquare className="size-4" />
                Add low stock items
              </button>
              <button
                type="button"
                onClick={() => startTransition(() => void createNewList())}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
              >
                <ListRestart className="size-4" />
                New list
              </button>
            </div>
          </div>

          {activeEntries.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)] md:col-span-2 xl:col-span-3">
              Shopping list is empty. Add low stock items or add items manually from the items page.
            </div>
          ) : (
            activeEntries.map((entry) => {
              const item = entry.itemId
                ? items.find((candidate) => candidate.id === entry.itemId)
                : null;

              return (
              <article
                key={entry.id}
                className={cn(
                  "rounded-[1.5rem] border px-4 py-4 transition hover:border-[color:var(--color-forest)] hover:shadow-sm",
                  entry.checkedAt
                    ? "border-black/5 bg-white/75"
                    : item?.actualStock && item.actualStock > 0
                      ? "border-amber-200 bg-amber-50"
                      : "border-red-200 bg-red-50",
                )}
              >
                <label className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={Boolean(entry.checkedAt)}
                    onChange={(event) => void toggleEntryChecked(entry.id, event.target.checked)}
                    className="mt-1 size-5 rounded border-black/20"
                  />
                  <div className="min-w-0 flex-1">
                    {item ? (
                      <Link
                        href={`/app/items/${item.id}`}
                        className="text-base font-semibold text-[color:var(--color-ink)] underline-offset-4 hover:underline"
                      >
                        {entry.label}
                      </Link>
                    ) : (
                      <h3 className="text-base font-semibold text-[color:var(--color-ink)]">
                        {entry.label}
                      </h3>
                    )}
                    {item ? (
                      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                        {getLocationLabel(item, places, rooms)}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                      {entry.quantity} {entry.unitLabel ?? "item"}
                      {entry.sourceType === "recipe" ? " · recipe" : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      entry.checkedAt
                        ? "bg-[color:var(--color-forest)] text-white"
                        : item?.actualStock && item.actualStock > 0
                          ? "bg-amber-500 text-white"
                          : "bg-red-600 text-white",
                    )}
                  >
                    {entry.checkedAt ? "Done" : item?.actualStock && item.actualStock > 0 ? "Low" : "Out"}
                  </span>
                </label>
              </article>
            );
            })
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/5 bg-white/75 px-5 py-4 text-sm text-[color:var(--color-ink-soft)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p>
            Last bootstrap {lastBootstrapAt ? formatTimestamp(Number(lastBootstrapAt)) : "pending"}.
          </p>
          <p>{pendingMutations.length} mutation(s) queued for sync.</p>
        </div>
      </section>
    </div>
  );
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
