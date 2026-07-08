"use client";

import Link from "next/link";
import { startTransition } from "react";
import { CalendarDays, Loader2, Minus, Plus, ShoppingBasket } from "lucide-react";
import { buildMutation, getLocationLabel, getTimestamp, toDateKey } from "@/features/inventory/helpers";
import { applyItemLocally, enqueueMutation } from "@/features/inventory/sync";
import type { ItemRecord, RecipeIngredientRecord, RecipeRecord } from "@/features/inventory/types";
import { useInventoryData } from "@/features/inventory/use-inventory-data";

type MealUsage = {
  recipeId: string;
  recipeName: string;
  plannedFor: string;
  quantity: number;
  unitLabel: string | null;
};

type ShoppingPrepEntry = {
  item: ItemRecord;
  locationLabel: string;
  usages: MealUsage[];
  firstPlannedFor: string;
  totalQuantity: number;
  summaryUnitLabel: string | null;
};

export function ShoppingPrepPage() {
  const {
    rooms,
    places,
    items,
    recipes,
    recipeIngredients,
    mealPlans,
    isBootstrapping,
    syncNow,
  } = useInventoryData();

  const todayDateKey = toDateKey(new Date());
  const upcomingPlans = [...mealPlans]
    .filter((plan) => plan.plannedFor >= todayDateKey && plan.recipeId)
    .sort((left, right) => left.plannedFor.localeCompare(right.plannedFor));
  const prepEntries = buildShoppingPrepEntries({
    upcomingPlans,
    items,
    places,
    rooms,
    recipes,
    recipeIngredients,
  });
  const groupedEntries = groupPrepEntriesByLocation(prepEntries);

  async function adjustItemStock(entry: ShoppingPrepEntry, delta: number) {
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

    await syncNow();
  }

  if (isBootstrapping) {
    return <Loading label="Loading shopping prep..." />;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
              Before you shop
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              Shopping prep
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              Review every registered ingredient for today&apos;s and upcoming meals, then correct
              stock before you head out.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
            >
              <ShoppingBasket className="size-4" />
              Back to shopping list
            </Link>
            <Link
              href="/app/planner"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
            >
              <CalendarDays className="size-4" />
              Meal calendar
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Upcoming meals
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
              {upcomingPlans.length} planned
            </h3>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Registered ingredients
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
              {prepEntries.length} items
            </h3>
          </div>
        </div>

        {groupedEntries.length === 0 ? (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            No upcoming meals with registered ingredients yet.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {groupedEntries.map((group) => (
              <section
                key={group.locationLabel}
                className="rounded-[1.5rem] border border-black/5 bg-white/75 p-3"
              >
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      {group.locationLabel}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                      {group.entries.length} ingredient{group.entries.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {group.entries.map((entry) => (
                    <article
                      key={entry.item.id}
                      className="rounded-[1.25rem] border border-[color:var(--color-forest)]/15 bg-[color:var(--color-panel-muted)]/45 px-4 py-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/app/items/${entry.item.id}`}
                            className="text-base font-semibold text-[color:var(--color-ink)] underline-offset-4 hover:underline"
                          >
                            {entry.item.name}
                          </Link>
                          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                            {getQuantitySummary(entry)} needed across {entry.usages.length} planned
                            {" "}
                            use{entry.usages.length === 1 ? "" : "s"}.
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                            System stock: {entry.item.actualStock}/{entry.item.desiredStock}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {entry.usages.map((usage) => (
                              <span
                                key={`${entry.item.id}:${usage.recipeId}:${usage.plannedFor}:${usage.quantity}:${usage.unitLabel ?? "x"}`}
                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[color:var(--color-ink-soft)]"
                              >
                                {getUsageDayLabel(usage.plannedFor, todayDateKey)} · {usage.recipeName} ·{" "}
                                {formatUsageQuantity(usage)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startTransition(() => void adjustItemStock(entry, -1))}
                            disabled={entry.item.actualStock <= 0}
                            aria-label={`Remove one ${entry.item.name} from stock`}
                            className="inline-flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startTransition(() => void adjustItemStock(entry, 1))}
                            aria-label={`Add one ${entry.item.name} to stock`}
                            className="inline-flex size-9 items-center justify-center rounded-full bg-[color:var(--color-clay)] text-white transition hover:bg-[#a63c22]"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function buildShoppingPrepEntries({
  upcomingPlans,
  items,
  places,
  rooms,
  recipes,
  recipeIngredients,
}: {
  upcomingPlans: ReturnType<typeof useInventoryData>["mealPlans"];
  items: ReturnType<typeof useInventoryData>["items"];
  places: ReturnType<typeof useInventoryData>["places"];
  rooms: ReturnType<typeof useInventoryData>["rooms"];
  recipes: RecipeRecord[];
  recipeIngredients: RecipeIngredientRecord[];
}) {
  const entries = new Map<string, ShoppingPrepEntry>();

  for (const plan of upcomingPlans) {
    if (!plan.recipeId) {
      continue;
    }

    const recipe = recipes.find((candidate) => candidate.id === plan.recipeId);
    if (!recipe) {
      continue;
    }

    const ingredients = recipeIngredients.filter((ingredient) => ingredient.recipeId === recipe.id);

    for (const ingredient of ingredients) {
      const item = items.find((candidate) => candidate.id === ingredient.itemId);
      if (!item) {
        continue;
      }

      const usage: MealUsage = {
        recipeId: recipe.id,
        recipeName: recipe.name,
        plannedFor: plan.plannedFor,
        quantity: ingredient.quantity,
        unitLabel: ingredient.unitLabel ?? null,
      };
      const existingEntry = entries.get(item.id);

      if (existingEntry) {
        existingEntry.usages.push(usage);
        existingEntry.totalQuantity += ingredient.quantity;
        existingEntry.firstPlannedFor = [existingEntry.firstPlannedFor, plan.plannedFor]
          .sort((left, right) => left.localeCompare(right))[0];
        existingEntry.summaryUnitLabel = getSharedUnitLabel(existingEntry.usages);
        continue;
      }

      entries.set(item.id, {
        item,
        locationLabel: getLocationLabel(item, places, rooms),
        usages: [usage],
        firstPlannedFor: plan.plannedFor,
        totalQuantity: ingredient.quantity,
        summaryUnitLabel: usage.unitLabel,
      });
    }
  }

  return [...entries.values()].sort((left, right) => {
    const dateCompare = left.firstPlannedFor.localeCompare(right.firstPlannedFor);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.item.name.localeCompare(right.item.name);
  });
}

function groupPrepEntriesByLocation(entries: ShoppingPrepEntry[]) {
  const groups = new Map<string, ShoppingPrepEntry[]>();

  for (const entry of entries) {
    const current = groups.get(entry.locationLabel) ?? [];
    current.push(entry);
    groups.set(entry.locationLabel, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([locationLabel, groupedEntries]) => ({
      locationLabel,
      entries: groupedEntries,
    }));
}

function getSharedUnitLabel(usages: MealUsage[]) {
  const normalizedLabels = [...new Set(usages.map((usage) => usage.unitLabel?.trim() || ""))];
  return normalizedLabels.length === 1 ? (normalizedLabels[0] || null) : null;
}

function getQuantitySummary(entry: ShoppingPrepEntry) {
  if (entry.summaryUnitLabel) {
    return `${entry.totalQuantity} ${entry.summaryUnitLabel}`;
  }

  if (entry.usages.every((usage) => !usage.unitLabel)) {
    return `${entry.totalQuantity} x`;
  }

  return `${entry.totalQuantity}`;
}

function formatUsageQuantity(usage: MealUsage) {
  return `${usage.quantity} ${usage.unitLabel ?? "x"}`;
}

function getUsageDayLabel(plannedFor: string, todayDateKey: string) {
  if (plannedFor === todayDateKey) {
    return "Today";
  }

  return new Date(`${plannedFor}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
  });
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
