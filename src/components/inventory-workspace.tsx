"use client";

import Link from "next/link";
import { startTransition } from "react";
import {
  ArrowRight,
  CheckSquare,
  ChefHat,
  ListRestart,
  Loader2,
  PackagePlus,
  PackageSearch,
  ShoppingBasket,
} from "lucide-react";
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
  const lowStockItems = sortLowStockItems(items.filter((item) => item.actualStock < item.desiredStock));
  const todayPlan = getDinnerPlanForDate(mealPlans, toDateKey(new Date()));
  const todayRecipe = recipes.find((recipe) => recipe.id === todayPlan?.recipeId) ?? null;
  const stockEntries = activeEntries.filter((entry) => entry.sourceType !== "recipe");
  const mealEntries = activeEntries.filter((entry) => entry.sourceType === "recipe");
  const lowStockCount = lowStockItems.length;

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
    await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));

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
              Home
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              Three jobs, three quick paths
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              Shopping lists, meal planning, and stock tracking each get their own clear route.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
            <ShoppingBasket className="size-4 text-[color:var(--color-forest)]" />
            {activeEntries.filter((entry) => !entry.checkedAt).length} to buy
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <FlowCard
            eyebrow="Create shopping lists"
            title="Build and work the current list"
            description="Add low-stock items, add recipe ingredients, then roll straight into the next list."
            metric={`${activeEntries.filter((entry) => !entry.checkedAt).length} open items`}
            href="/app"
            cta="Open shopping list"
            icon={ShoppingBasket}
          />
          <FlowCard
            eyebrow="Plan meals"
            title={todayRecipe?.name ?? "Plan the next meal"}
            description={
              todayRecipe
                ? "Today is already planned. Open the planner to adjust the week or add notes."
                : "Choose meals by day, then kick the ingredients onto the shopping list."
            }
            metric={todayRecipe ? "Today planned" : "Nothing set for today"}
            href="/app/planner"
            cta="Open planner"
            icon={ChefHat}
          />
          <FlowCard
            eyebrow="Track stock"
            title="Review what needs topping up"
            description="Check stock levels, open an item, or add new products into the right place."
            metric={`${lowStockCount} low-stock item${lowStockCount === 1 ? "" : "s"}`}
            href="/app/items"
            cta="Review stock"
            icon={PackageSearch}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <NavButton href="/app/add" label="Add item" icon={PackagePlus} />
          <NavButton href="/app/recipes" label="Recipes" />
          <NavButton href="/app/rooms" label="Rooms" />
          <NavButton href="/app/places" label="Places" />
        </div>
      </section>

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
                ? todayPlan?.notes ?? "Open the planner if you want to swap or add notes."
                : "Plan something for today from the recipe page or planner."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {todayRecipe ? (
              <Link
                href="/app/recipes"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
              >
                <ChefHat className="size-4" />
                View recipe
              </Link>
            ) : null}
            <NavButton href="/app/planner" label="Plan meals" />
          </div>
        </div>
      </section>

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
              Stock top-ups and meal-linked items are split so they are easier to scan.
            </p>
          </div>
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

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <ShoppingSection
            title="Stock items"
            description="Low-stock and manual additions."
            tone="stock"
            entries={stockEntries}
            items={items}
            places={places}
            rooms={rooms}
            onToggleEntryChecked={toggleEntryChecked}
          />
          <ShoppingSection
            title="Meal items"
            description="Ingredients linked from recipes."
            tone="meal"
            entries={mealEntries}
            items={items}
            places={places}
            rooms={rooms}
            onToggleEntryChecked={toggleEntryChecked}
          />
        </div>
      </section>
    </div>
  );
}

function ShoppingSection({
  title,
  description,
  tone,
  entries,
  items,
  places,
  rooms,
  onToggleEntryChecked,
}: {
  title: string;
  description: string;
  tone: "stock" | "meal";
  entries: ReturnType<typeof useInventoryData>["shoppingListEntries"];
  items: ReturnType<typeof useInventoryData>["items"];
  places: ReturnType<typeof useInventoryData>["places"];
  rooms: ReturnType<typeof useInventoryData>["rooms"];
  onToggleEntryChecked: (entryId: string, checked: boolean) => Promise<void>;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border p-4",
        tone === "meal"
          ? "border-[color:var(--color-forest)]/15 bg-[linear-gradient(180deg,rgba(193,219,188,0.34),rgba(255,255,255,0.96))]"
          : "border-black/5 bg-[color:var(--color-panel-muted)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {title}
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">{description}</p>
        </div>
        <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
          {entries.filter((entry) => !entry.checkedAt).length} open
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            {tone === "meal"
              ? "No meal-linked items yet."
              : "No stock items yet. Add low stock items or add items manually from the items page."}
          </div>
        ) : (
          entries.map((entry) => {
            const item = entry.itemId ? items.find((candidate) => candidate.id === entry.itemId) : null;

            return (
              <article
                key={entry.id}
                className={cn(
                  "rounded-[1.5rem] border px-4 py-4 transition",
                  entry.checkedAt
                    ? "border-black/5 bg-white/70 opacity-70"
                    : tone === "meal"
                      ? "border-[color:var(--color-forest)]/20 bg-white"
                      : "border-black/10 bg-white/85",
                )}
              >
                <label className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={Boolean(entry.checkedAt)}
                    onChange={(event) =>
                      void onToggleEntryChecked(entry.id, event.target.checked)
                    }
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
                      {entry.sourceType === "recipe" ? " · recipe-linked" : ""}
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
                    {entry.checkedAt
                      ? "Done"
                      : item?.actualStock && item.actualStock > 0
                        ? "Low"
                        : "Out"}
                  </span>
                </label>
              </article>
            );
          })
        )}
      </div>
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

function FlowCard({
  eyebrow,
  title,
  description,
  metric,
  href,
  cta,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  href: string;
  cta: string;
  icon: typeof ShoppingBasket;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.75rem] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(237,242,235,0.92))] p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.55)] transition hover:-translate-y-0.5 hover:border-[color:var(--color-forest)]/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-ink)]">{title}</h3>
        </div>
        <div className="rounded-full bg-white p-3 text-[color:var(--color-forest)] shadow-sm">
          <Icon className="size-5" />
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[color:var(--color-ink-soft)]">{description}</p>
      <p className="mt-4 text-sm font-medium text-[color:var(--color-ink)]">{metric}</p>

      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-forest)]">
        {cta}
        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
