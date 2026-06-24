"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import {
  applyItemLocally,
  applyRecipeIngredientLocally,
  applyRecipeLocally,
  applyShoppingListEntryLocally,
  deleteRecipeLocally,
  deleteRecipeIngredientLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import {
  buildMutation,
  getActiveShoppingList,
  getId,
  getRecipeIngredientCostPence,
  getRecipeCostPence,
  getTimestamp,
} from "@/features/inventory/helpers";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import type {
  ItemRecord,
  PlaceRecord,
  RecipeIngredientRecord,
  RecipeRecord,
  RoomRecord,
  ShoppingListEntryRecord,
} from "@/features/inventory/types";
import { formatCurrencyFromPence, penceToPoundsInput, poundsToPence } from "@/lib/utils";

type RecipeDetailPageProps = {
  recipeId: string;
  userId: string;
};

type RecipeUpdates = {
  name: string;
  notes: string | null;
};

export function RecipeDetailPage({ recipeId, userId }: RecipeDetailPageProps) {
  const router = useRouter();
  const {
    items,
    rooms,
    places,
    recipes,
    recipeIngredients,
    shoppingLists,
    shoppingListEntries,
    isBootstrapping,
    syncNow,
  } = useInventoryData();
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [quickAddPlaceId, setQuickAddPlaceId] = useState("");
  const [quickAddIsStaple, setQuickAddIsStaple] = useState(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [costOverrideDrafts, setCostOverrideDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  if (isBootstrapping) {
    return <Loading label="Loading recipe..." />;
  }

  const recipe = recipes.find((entry) => entry.id === recipeId) ?? null;

  if (!recipe) {
    return (
      <section className="rounded-[2rem] border border-black/5 bg-white/85 p-6 text-[color:var(--color-ink)] shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <Link
          href="/app/recipes"
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)]"
        >
          <ArrowLeft className="size-4" />
          Back to recipes
        </Link>
        <p className="mt-6 text-lg font-semibold">Recipe not found.</p>
      </section>
    );
  }

  const currentRecipe = recipe;
  const selectedIngredients = recipeIngredients.filter(
    (ingredient) => ingredient.recipeId === currentRecipe.id,
  );
  const activeShoppingList = getActiveShoppingList(shoppingLists);
  const effectiveQuickAddPlaceId = places.some((place) => place.id === quickAddPlaceId)
    ? quickAddPlaceId
    : places[0]?.id ?? "";
  const normalizedIngredientSearch = ingredientSearch.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (selectedIngredients.some((ingredient) => ingredient.itemId === item.id)) {
      return false;
    }

    if (!normalizedIngredientSearch) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(normalizedIngredientSearch) ||
      (item.notes ?? "").toLowerCase().includes(normalizedIngredientSearch)
    );
  });
  const matchingExistingItem =
    filteredItems.find((item) => item.name.trim().toLowerCase() === normalizedIngredientSearch) ??
    null;
  const canCreateNewIngredient =
    normalizedIngredientSearch.length > 0 && matchingExistingItem == null;
  const placeOptions = places.map((place) => ({
    id: place.id,
    label: getPlaceOptionLabel(place, rooms),
  }));

  function getCostOverrideInputValue(ingredient: RecipeIngredientRecord) {
    return costOverrideDrafts[ingredient.id] ?? penceToPoundsInput(ingredient.costPenceOverride);
  }

  function getQuantityInputValue(ingredient: RecipeIngredientRecord) {
    return quantityDrafts[ingredient.id] ?? String(ingredient.quantity);
  }

  async function saveRecipe(updates: RecipeUpdates) {
    const timestamp = getTimestamp();
    const nextRecipe: RecipeRecord = {
      ...currentRecipe,
      ...updates,
      updatedAt: timestamp,
    };

    await applyRecipeLocally(nextRecipe);
    await enqueueMutation(buildMutation("recipe", "upsert", nextRecipe, timestamp));
    setMessage("Recipe saved");

    await syncNow();
  }

  async function linkItemToRecipe(
    item: ItemRecord,
    options?: { message?: string; syncAfter?: boolean },
  ) {
    const existingIngredient = recipeIngredients.find(
      (ingredient) => ingredient.recipeId === currentRecipe.id && ingredient.itemId === item.id,
    );

    if (existingIngredient) {
      setMessage(`${item.name} is already linked to ${currentRecipe.name}`);
      return;
    }

    const timestamp = getTimestamp();
    const ingredient: RecipeIngredientRecord = {
      id: getId(),
      recipeId: currentRecipe.id,
      userId,
      itemId: item.id,
      quantity: 1,
      unitLabel: null,
      costPenceOverride: null,
      includeInCost: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyRecipeIngredientLocally(ingredient);
    await enqueueMutation(buildMutation("recipe-ingredient", "upsert", ingredient, timestamp));
    setMessage(options?.message ?? `${item.name} added to ${currentRecipe.name}`);

    if (options?.syncAfter !== false) {
      await syncNow();
    }
  }

  async function addIngredient(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    await linkItemToRecipe(item);
    setIngredientSearch("");
  }

  async function createGlobalItemAndLink() {
    if (!ingredientSearch.trim()) {
      return;
    }

    if (!effectiveQuickAddPlaceId) {
      setMessage("Add a place first so new items have somewhere to live");
      return;
    }

    const normalizedName = ingredientSearch.trim().toLowerCase();
    const existingItem = items.find((item) => item.name.trim().toLowerCase() === normalizedName);

    if (existingItem) {
      await linkItemToRecipe(existingItem, {
        message: `${existingItem.name} linked to ${currentRecipe.name}`,
      });
      setIngredientSearch("");
      return;
    }

    const timestamp = getTimestamp();
    const item: ItemRecord = {
      id: getId(),
      placeId: effectiveQuickAddPlaceId,
      placeIds: [effectiveQuickAddPlaceId],
      userId,
      name: ingredientSearch.trim(),
      notes: undefined,
      imageUrl: null,
      imageProxyUrl: null,
      pricePaidPence: null,
      isStaple: quickAddIsStaple,
      trackPriceHistory: !quickAddIsStaple,
      desiredStock: 1,
      actualStock: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const ingredient: RecipeIngredientRecord = {
      id: getId(),
      recipeId: currentRecipe.id,
      userId,
      itemId: item.id,
      quantity: 1,
      unitLabel: null,
      costPenceOverride: null,
      includeInCost: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyItemLocally(item);
    await enqueueMutation(buildMutation("item", "upsert", item, timestamp));
    await applyRecipeIngredientLocally(ingredient);
    await enqueueMutation(buildMutation("recipe-ingredient", "upsert", ingredient, timestamp));

    setIngredientSearch("");
    setQuickAddIsStaple(false);
    setMessage(`${item.name} created and linked to ${currentRecipe.name}`);

    await syncNow();
  }

  async function updateIngredient(
    ingredient: RecipeIngredientRecord,
    updates: Partial<RecipeIngredientRecord>,
  ) {
    const timestamp = getTimestamp();
    const nextIngredient: RecipeIngredientRecord = {
      ...ingredient,
      ...updates,
      updatedAt: timestamp,
    };

    await applyRecipeIngredientLocally(nextIngredient);
    await enqueueMutation(
      buildMutation("recipe-ingredient", "upsert", nextIngredient, timestamp),
    );

    await syncNow();
  }

  async function removeIngredient(ingredientId: string) {
    const timestamp = getTimestamp();
    await deleteRecipeIngredientLocally(ingredientId);
    await enqueueMutation(
      buildMutation("recipe-ingredient", "delete", { id: ingredientId }, timestamp),
    );
    setMessage("Ingredient removed");

    await syncNow();
  }

  async function commitCostOverrideDraft(ingredient: RecipeIngredientRecord) {
    const draftValue = costOverrideDrafts[ingredient.id];

    if (draftValue == null) {
      return;
    }

    const trimmedValue = draftValue.trim();
    const nextValue = trimmedValue === "" ? null : poundsToPence(trimmedValue);

    setCostOverrideDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[ingredient.id];
      return nextDrafts;
    });

    if (nextValue === ingredient.costPenceOverride) {
      return;
    }

    await updateIngredient(ingredient, {
      costPenceOverride: nextValue,
    });
  }

  async function commitQuantityDraft(ingredient: RecipeIngredientRecord) {
    const draftValue = quantityDrafts[ingredient.id];

    if (draftValue == null) {
      return;
    }

    const trimmedValue = draftValue.trim();
    const nextValue = Number(trimmedValue);

    if (!trimmedValue || !Number.isFinite(nextValue) || nextValue <= 0) {
      setMessage("Enter a valid quantity greater than 0");
      return;
    }

    setQuantityDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[ingredient.id];
      return nextDrafts;
    });

    if (nextValue === ingredient.quantity) {
      return;
    }

    await updateIngredient(ingredient, {
      quantity: nextValue,
    });
  }

  async function addRecipeToShoppingList() {
    if (!activeShoppingList) {
      setMessage("No active shopping list found");
      return;
    }

    const timestamp = getTimestamp();

    for (const ingredient of selectedIngredients) {
      const item = items.find((entry) => entry.id === ingredient.itemId);
      if (!item) {
        continue;
      }

      const existingEntry = shoppingListEntries.find(
        (entry) =>
          entry.listId === activeShoppingList.id &&
          entry.itemId === item.id &&
          entry.recipeId === currentRecipe.id &&
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
        recipeId: currentRecipe.id,
        label: item.name,
        sourceType: "recipe",
        quantity: ingredient.quantity,
        unitLabel: ingredient.unitLabel ?? null,
        checkedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await applyShoppingListEntryLocally(nextEntry);
      await enqueueMutation(
        buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp),
      );
    }

    setMessage(`Added ingredients for ${currentRecipe.name} to the shopping list`);

    await syncNow();
  }

  async function deleteRecipe() {
    const confirmed = window.confirm(
      `Delete ${currentRecipe.name}? This will remove it from the recipe catalog.`,
    );

    if (!confirmed) {
      return;
    }

    const timestamp = getTimestamp();
    await deleteRecipeLocally(currentRecipe.id);
    await enqueueMutation(
      buildMutation("recipe", "delete", { id: currentRecipe.id }, timestamp),
    );
    await syncNow();
    router.push("/app/recipes");
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <Link
          href="/app/recipes"
          className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-forest)]"
        >
          <ArrowLeft className="size-4" />
          Back to recipes
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Recipe
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              {currentRecipe.name}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {selectedIngredients.length} ingredients
              {formatCurrencyFromPence(
                getRecipeCostPence(currentRecipe, selectedIngredients, items),
              )
                ? ` · ${formatCurrencyFromPence(
                    getRecipeCostPence(currentRecipe, selectedIngredients, items),
                  )}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void addRecipeToShoppingList()}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
            >
              <ShoppingBasket className="size-4" />
              Add ingredients to list
            </button>
            <button
              type="button"
              onClick={() => void deleteRecipe()}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 className="size-4" />
              Delete recipe
            </button>
          </div>
        </div>
        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}
      </header>

      <RecipeEditor
        recipe={currentRecipe}
        recipeIngredients={selectedIngredients}
        items={items}
        onSave={saveRecipe}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                Ingredients
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                Required items
              </h3>
            </div>
            <div className="rounded-full bg-[color:var(--color-panel-muted)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)]">
              {selectedIngredients.length} total
            </div>
          </div>

          {selectedIngredients.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
              No ingredients yet. Add items from the panel on the right.
            </div>
          ) : (
            selectedIngredients.map((ingredient) => {
              const item = items.find((entry) => entry.id === ingredient.itemId);
              if (!item) {
                return null;
              }
              const suggestedCostOverridePlaceholder =
                item.pricePaidPence != null
                  ? penceToPoundsInput(Math.round(item.pricePaidPence * ingredient.quantity))
                  : "No known price";

              return (
                <article
                  key={ingredient.id}
                  className="rounded-[1.5rem] bg-[color:var(--color-panel-muted)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/app/items/${item.id}`}
                        className="text-base font-semibold text-[color:var(--color-ink)] underline-offset-4 hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                        {item.isStaple ? "Staple" : "Tracked item"}
                        {item.trackPriceHistory ? " · price-tracked" : ""}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                        Current cost:{" "}
                        {formatCurrencyFromPence(getRecipeIngredientCostPence(ingredient, item)) ??
                          "Not costed"}
                        {ingredient.costPenceOverride != null ? " · custom override" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeIngredient(ingredient.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)] xl:grid-cols-[8rem_minmax(0,1fr)_12rem_auto]">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        Quantity
                      </span>
                      <input
                        type="number"
                        min={0.01}
                        step={0.25}
                        value={getQuantityInputValue(ingredient)}
                        onChange={(event) =>
                          setQuantityDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [ingredient.id]: event.target.value,
                          }))
                        }
                        onBlur={() => void commitQuantityDraft(ingredient)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        Unit
                      </span>
                      <input
                        value={ingredient.unitLabel ?? ""}
                        onChange={(event) =>
                          void updateIngredient(ingredient, {
                            unitLabel: event.target.value.trim() || null,
                          })
                        }
                        placeholder="packs"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                      />
                    </label>

                    <label className="space-y-2 xl:col-span-1">
                      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        Cost override (GBP)
                      </span>
                      <input
                        value={getCostOverrideInputValue(ingredient)}
                        onChange={(event) =>
                          setCostOverrideDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [ingredient.id]: event.target.value,
                          }))
                        }
                        onBlur={() => void commitCostOverrideDraft(ingredient)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        placeholder={suggestedCostOverridePlaceholder}
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                      />
                    </label>

                    <button
                      type="button"
                      aria-pressed={ingredient.includeInCost}
                      onClick={() =>
                        void updateIngredient(ingredient, {
                          includeInCost: !ingredient.includeInCost,
                        })
                      }
                      className={[
                        "rounded-[1.5rem] border px-4 py-3 text-left text-sm font-medium transition",
                        ingredient.includeInCost
                          ? "border-[color:var(--color-forest)] bg-white text-[color:var(--color-forest)]"
                          : "border-black/10 bg-white text-[color:var(--color-ink-soft)]",
                      ].join(" ")}
                    >
                      {ingredient.includeInCost ? "In meal cost" : "Ignored in cost"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <aside className="space-y-4 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-black/10 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                Search ingredients
              </p>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                Start typing to search registered ingredients first. If nothing exists yet,
                create a new one from the same form.
              </p>

              <div className="mt-4 space-y-3">
                <input
                value={ingredientSearch}
                onChange={(event) => setIngredientSearch(event.target.value)}
                placeholder="Search anything"
                className="w-full rounded-2xl border border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
                {matchingExistingItem ? (
                  <p className="rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
                    Exact match found: <span className="font-semibold text-[color:var(--color-ink)]">{matchingExistingItem.name}</span>. Pick it from the results below to link it.
                  </p>
                ) : canCreateNewIngredient ? (
                  <>
                    <select
                      value={effectiveQuickAddPlaceId}
                      onChange={(event) => setQuickAddPlaceId(event.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                    >
                      {placeOptions.length === 0 ? (
                        <option value="">No places available</option>
                      ) : (
                        placeOptions.map((place) => (
                          <option key={place.id} value={place.id}>
                            {place.label}
                          </option>
                        ))
                      )}
                    </select>
                    <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink)]">
                      <input
                        type="checkbox"
                        checked={quickAddIsStaple}
                        onChange={(event) => setQuickAddIsStaple(event.target.checked)}
                        className="size-4 rounded border-black/20"
                      />
                      Make this a staple item
                    </label>
                    <button
                      type="button"
                      onClick={() => void createGlobalItemAndLink()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
                    >
                      <Plus className="size-4" />
                      Create "{ingredientSearch.trim()}" and link
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {filteredItems.slice(0, 10).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void addIngredient(item.id)}
                className="w-full rounded-[1.5rem] border border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-4 text-left transition hover:border-[color:var(--color-forest)] hover:bg-white"
              >
                <p className="text-sm font-semibold text-[color:var(--color-ink)]">{item.name}</p>
                <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                  {item.isStaple ? "Staple" : "Recipe item"}
                  {item.trackPriceHistory ? " · price-tracked" : ""}
                </p>
              </button>
            ))}
            {filteredItems.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
                {canCreateNewIngredient
                  ? "No registered ingredient matches yet. You can create this one above."
                  : "No more matching items to add."}
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </section>
  );
}

function getPlaceOptionLabel(place: PlaceRecord, rooms: RoomRecord[]) {
  const room = rooms.find((entry) => entry.id === place.roomId);
  return room ? `${room.name} / ${place.name}` : place.name;
}

function RecipeEditor({
  recipe,
  recipeIngredients,
  items,
  onSave,
}: {
  recipe: RecipeRecord;
  recipeIngredients: RecipeIngredientRecord[];
  items: ItemRecord[];
  onSave: (updates: RecipeUpdates) => Promise<void>;
}) {
  const [name, setName] = useState(recipe.name);
  const [notes, setNotes] = useState(recipe.notes ?? "");
  const mealCost = formatCurrencyFromPence(getRecipeCostPence(recipe, recipeIngredients, items));

  return (
    <section className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Meal details
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
            {recipe.name}
          </h3>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            {recipeIngredients.length} ingredients
            {mealCost ? ` · ${mealCost}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onSave({ name: name.trim(), notes: notes.trim() || null })}
          className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
        >
          <Save className="size-4" />
          Save recipe
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Recipe name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
          />
        </label>
      </div>
    </section>
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
