"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Save, ShoppingBasket, Trash2 } from "lucide-react";
import {
  applyMealPlanLocally,
  applyShoppingListEntryLocally,
  deleteMealPlanLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import {
  buildMutation,
  getActiveShoppingList,
  getDinnerPlanForDate,
  getId,
  getMonthGrid,
  getRecipeCostPence,
  getTimestamp,
  toDateKey,
} from "@/features/inventory/helpers";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import type {
  MealPlanRecord,
  RecipeRecord,
  ShoppingListEntryRecord,
} from "@/features/inventory/types";
import { cn, formatCurrencyFromPence, formatDateLabel } from "@/lib/utils";

type PlannerPageProps = {
  userId: string;
};

export function PlannerPage({ userId }: PlannerPageProps) {
  const {
    items,
    recipes,
    recipeIngredients,
    mealPlans,
    shoppingLists,
    shoppingListEntries,
    isBootstrapping,
    syncNow,
  } = useInventoryData();
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [message, setMessage] = useState<string | null>(null);

  if (isBootstrapping) {
    return <Loading label="Loading planner..." />;
  }

  const monthGrid = getMonthGrid(monthAnchor);
  const selectedPlan = getDinnerPlanForDate(mealPlans, selectedDateKey);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedPlan?.recipeId) ?? null;
  const activeShoppingList = getActiveShoppingList(shoppingLists);

  async function saveMealPlan(recipeId: string | null, notes: string) {
    const timestamp = getTimestamp();
    const nextPlan: MealPlanRecord = {
      id: selectedPlan?.id ?? getId(),
      userId,
      plannedFor: selectedDateKey,
      mealSlot: "dinner",
      recipeId,
      notes: notes.trim() || null,
      createdAt: selectedPlan?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    await applyMealPlanLocally(nextPlan);
    await enqueueMutation(buildMutation("meal-plan", "upsert", nextPlan, timestamp));
    setMessage(recipeId ? "Meal saved" : "Meal note saved");

    await syncNow();
  }

  async function clearMealPlan() {
    if (!selectedPlan) {
      return;
    }

    const timestamp = getTimestamp();
    await deleteMealPlanLocally(selectedPlan.id);
    await enqueueMutation(buildMutation("meal-plan", "delete", { id: selectedPlan.id }, timestamp));
    setMessage("Meal cleared");

    await syncNow();
  }

  async function addRecipeIngredientsToShoppingList(recipe: RecipeRecord) {
    if (!activeShoppingList) {
      setMessage("No active shopping list found");
      return;
    }

    const ingredients = recipeIngredients.filter((ingredient) => ingredient.recipeId === recipe.id);
    const timestamp = getTimestamp();

    for (const ingredient of ingredients) {
      const item = items.find((entry) => entry.id === ingredient.itemId);
      if (!item) {
        continue;
      }

      const existingEntry = shoppingListEntries.find(
        (entry) =>
          entry.listId === activeShoppingList.id &&
          entry.itemId === item.id &&
          entry.recipeId === recipe.id &&
          !entry.checkedAt,
      );

      if (existingEntry) {
        continue;
      }

      const nextEntry: ShoppingListEntryRecord = {
        id: getId(),
        listId: activeShoppingList.id,
        userId,
        itemId: item.id,
        recipeId: recipe.id,
        label: item.name,
        sourceType: "recipe",
        quantity: ingredient.quantity,
        unitLabel: ingredient.unitLabel ?? null,
        checkedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await applyShoppingListEntryLocally(nextEntry);
      await enqueueMutation(buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp));
    }

    setMessage(`Added ingredients for ${recipe.name} to the shopping list`);

    await syncNow();
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Planner
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">Meal calendar</h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Pick one meal per day, see the month at a glance, and kick planned ingredients onto the
          shopping list when you need them.
        </p>
        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          <div className="mb-4 flex items-center justify-between gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() =>
                setMonthAnchor(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)] sm:px-4"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <h3 className="text-center text-base font-semibold text-[color:var(--color-ink)] sm:text-lg">
              {monthAnchor.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              type="button"
              onClick={() =>
                setMonthAnchor(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)] sm:px-4"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] sm:gap-2 sm:text-xs">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="px-1 py-2 sm:px-2">
                <span className="sm:hidden">{day.slice(0, 1)}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {monthGrid.map((date) => {
              const dateKey = toDateKey(date);
              const plan = getDinnerPlanForDate(mealPlans, dateKey);
              const recipe = recipes.find((entry) => entry.id === plan?.recipeId) ?? null;
              const hasMeal = Boolean(recipe || plan?.notes);
              const isCurrentMonth = date.getMonth() === monthAnchor.getMonth();
              const isSelected = dateKey === selectedDateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(dateKey)}
                  className={cn(
                    "min-h-16 rounded-[1.1rem] border px-2 py-2 text-left transition sm:min-h-28 sm:rounded-[1.5rem] sm:p-3",
                    isSelected
                      ? "border-[color:var(--color-forest)] bg-[color:var(--color-panel-muted)] shadow-[0_16px_40px_-32px_rgba(22,38,32,0.65)]"
                      : "border-black/10 bg-white hover:border-[color:var(--color-forest)]/40 hover:bg-[color:var(--color-panel-muted)]/55",
                    !isCurrentMonth && "opacity-45",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                      {date.getDate()}
                    </p>
                    {hasMeal ? (
                      <span className="mt-1 size-2 rounded-full bg-[color:var(--color-clay)] sm:hidden" />
                    ) : null}
                  </div>
                  {hasMeal ? (
                    <>
                      <p className="mt-2 hidden text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)] sm:block">
                        Meal
                      </p>
                      <p className="mt-2 hidden line-clamp-2 text-sm text-[color:var(--color-ink)] sm:block">
                        {recipe?.name ?? plan?.notes ?? "Planned"}
                      </p>
                    </>
                  ) : null}
                  {!hasMeal ? (
                    <p className="mt-2 hidden text-sm text-[color:var(--color-ink-soft)] sm:block"></p>
                  ) : null}
                  {hasMeal ? (
                    <p className="mt-2 text-[11px] font-medium text-[color:var(--color-ink-soft)] sm:hidden">
                      Planned
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <PlannerSidebar
          key={`${selectedDateKey}:${selectedPlan?.id ?? "new"}`}
          selectedDateKey={selectedDateKey}
          selectedRecipe={selectedRecipe}
          selectedPlan={selectedPlan}
          recipes={recipes}
          items={items}
          recipeIngredients={recipeIngredients}
          onChooseRecipe={saveMealPlan}
          onClearMealPlan={clearMealPlan}
          onAddRecipeIngredientsToShoppingList={addRecipeIngredientsToShoppingList}
        />
      </div>
    </section>
  );
}

function PlannerSidebar({
  selectedDateKey,
  selectedRecipe,
  selectedPlan,
  recipes,
  items,
  recipeIngredients,
  onChooseRecipe,
  onClearMealPlan,
  onAddRecipeIngredientsToShoppingList,
}: {
  selectedDateKey: string;
  selectedRecipe: RecipeRecord | null;
  selectedPlan: MealPlanRecord | null;
  recipes: RecipeRecord[];
  items: Parameters<typeof getRecipeCostPence>[2];
  recipeIngredients: Parameters<typeof getRecipeCostPence>[1];
  onChooseRecipe: (recipeId: string | null, notes: string) => Promise<void>;
  onClearMealPlan: () => Promise<void>;
  onAddRecipeIngredientsToShoppingList: (recipe: RecipeRecord) => Promise<void>;
}) {
  const [notes, setNotes] = useState(selectedPlan?.notes ?? "");
  const [recipeSearch, setRecipeSearch] = useState("");
  const normalizedRecipeSearch = recipeSearch.trim().toLowerCase();
  const filteredRecipes = recipes.filter((recipe) => {
    if (!normalizedRecipeSearch) {
      return true;
    }

    return recipe.name.toLowerCase().includes(normalizedRecipeSearch);
  });

  return (
    <aside className="space-y-4 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          Selected day
        </p>
        <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
          {formatDateLabel(new Date(`${selectedDateKey}T12:00:00`))}
        </h3>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">One planned meal for now.</p>
      </div>

      <div className="space-y-3">
        {recipes.length > 0 ? (
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Search recipes
            </span>
            <input
              value={recipeSearch}
              onChange={(event) => setRecipeSearch(event.target.value)}
              placeholder="Search meals"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
          </div>
        ) : null}

        {recipes.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            Add some recipes first.
          </div>
        ) : (
          filteredRecipes.map((recipe) => {
            const isSelectedRecipe = recipe.id === selectedRecipe?.id;
            const mealCost = formatCurrencyFromPence(
              getRecipeCostPence(recipe, recipeIngredients, items),
            );
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => void onChooseRecipe(recipe.id, notes)}
                className={[
                  "w-full rounded-[1.5rem] border px-4 py-4 text-left transition",
                  isSelectedRecipe
                    ? "border-[color:var(--color-forest)] bg-[color:var(--color-panel-muted)] shadow-[0_16px_40px_-32px_rgba(22,38,32,0.65)]"
                    : "border-black/10 bg-white hover:border-[color:var(--color-forest)]/40 hover:bg-[color:var(--color-panel-muted)]/55",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-[color:var(--color-ink)]">{recipe.name}</p>
                <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                  {mealCost ?? "No meal cost yet"}
                </p>
              </button>
            );
          })
        )}
        {recipes.length > 0 && filteredRecipes.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            No recipes match that search.
          </div>
        ) : null}
      </div>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          Notes
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Anything special for this meal?"
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onChooseRecipe(selectedRecipe?.id ?? null, notes)}
          className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
        >
          <Save className="size-4" />
          Save notes
        </button>
        <button
          type="button"
          onClick={() => void onClearMealPlan()}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        >
          <Trash2 className="size-4" />
          Clear day
        </button>
      </div>

      {selectedRecipe ? (
        <button
          type="button"
          onClick={() => void onAddRecipeIngredientsToShoppingList(selectedRecipe)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
        >
          <ShoppingBasket className="size-4" />
          Add planned ingredients to shopping list
        </button>
      ) : null}
    </aside>
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
