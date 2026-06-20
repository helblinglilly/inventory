"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Loader2, Search, ShoppingBasket } from "lucide-react";
import { applyShoppingListEntryLocally, enqueueMutation } from "@/features/inventory/sync";
import {
  buildMutation,
  getActiveShoppingList,
  getId,
  getLocationLabel,
  getTimestamp,
} from "@/features/inventory/helpers";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import { cn, formatCurrencyFromPence, formatRelativeStock } from "@/lib/utils";

export function ItemsPage() {
  const {
    rooms,
    places,
    items,
    shoppingLists,
    shoppingListEntries,
    isBootstrapping,
    syncNow,
  } = useInventoryData();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const activeShoppingList = getActiveShoppingList(shoppingLists);

  const filteredItems = items.filter((item) => {
    if (!deferredSearch) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(deferredSearch) ||
      (item.notes ?? "").toLowerCase().includes(deferredSearch)
    );
  });
  const lowStockItems = filteredItems.filter((item) => item.actualStock < item.desiredStock);
  const healthyItems = filteredItems.filter((item) => item.actualStock >= item.desiredStock);

  if (isBootstrapping) {
    return <Loading label="Loading items..." />;
  }

  async function addItemToShoppingList(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);

    if (!item || !activeShoppingList) {
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
      setMessage(`${item.name} is already on the current shopping list`);
      return;
    }

    const timestamp = getTimestamp();
    const nextEntry = {
      id: getId(),
      listId: activeShoppingList.id,
      userId: item.userId,
      itemId: item.id,
      recipeId: null,
      label: item.name,
      sourceType: "manual" as const,
      quantity: 1,
      unitLabel: null,
      checkedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyShoppingListEntryLocally(nextEntry);
    await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));

    if (navigator.onLine) {
      await syncNow();
    }

    setMessage(`${item.name} added to the shopping list`);
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Items
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
          Track stock
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Review what needs topping up first, then dive into the full catalog when you need detail.
        </p>
        <div className="relative mt-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-ink-soft)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items or notes"
            className="w-full rounded-full border border-black/10 bg-white px-10 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
          />
        </div>
        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                Needs attention
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                Low stock
              </h3>
            </div>
            <div className="rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
              {lowStockItems.length}
            </div>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
              No low-stock items in this view.
            </div>
          ) : (
            lowStockItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                rooms={rooms}
                places={places}
                onAddToShoppingList={addItemToShoppingList}
              />
            ))
          )}
        </div>

        <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                Everything else
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                In stock
              </h3>
            </div>
            <div className="rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
              {healthyItems.length}
            </div>
          </div>

          {healthyItems.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
              No matching in-stock items.
            </div>
          ) : (
            healthyItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                rooms={rooms}
                places={places}
                onAddToShoppingList={addItemToShoppingList}
              />
            ))
          )}
        </div>
      </section>
    </section>
  );
}

function ItemCard({
  item,
  rooms,
  places,
  onAddToShoppingList,
}: {
  item: (ReturnType<typeof useInventoryData>["items"])[number];
  rooms: ReturnType<typeof useInventoryData>["rooms"];
  places: ReturnType<typeof useInventoryData>["places"];
  onAddToShoppingList: (itemId: string) => Promise<void>;
}) {
  return (
    <article
      className={cn(
        "rounded-[1.5rem] border px-4 py-4 transition",
        item.actualStock <= 0
          ? "border-red-200 bg-red-50"
          : item.actualStock < item.desiredStock
            ? "border-amber-200 bg-amber-50"
            : "border-black/5 bg-[color:var(--color-panel-muted)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/app/items/${item.id}`}
            className="text-base font-semibold text-[color:var(--color-ink)] underline-offset-4 hover:underline"
          >
            {item.name}
          </Link>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {getLocationLabel(item, places, rooms)}
          </p>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            Target {item.desiredStock}, currently {item.actualStock}
            {formatCurrencyFromPence(item.pricePaidPence)
              ? ` · Paid ${formatCurrencyFromPence(item.pricePaidPence)}`
              : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.isStaple ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
                Staple
              </span>
            ) : null}
            {item.trackPriceHistory ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
                Price tracked
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
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
          <button
            type="button"
            onClick={() => void onAddToShoppingList(item.id)}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
          >
            <ShoppingBasket className="size-3.5" />
            Add
          </button>
        </div>
      </div>
    </article>
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
