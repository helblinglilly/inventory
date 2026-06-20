"use client";

import { useState } from "react";
import {
  ChefHat,
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
  deleteRecipeIngredientLocally,
  enqueueMutation,
} from "@/features/inventory/sync";
import {
  buildMutation,
  getActiveShoppingList,
  getId,
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
import { formatCurrencyFromPence } from "@/lib/utils";

type RecipesPageProps = {
  userId: string;
};

export function RecipesPage({ userId }: RecipesPageProps) {
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
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [newRecipeName, setNewRecipeName] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [quickAddItemName, setQuickAddItemName] = useState("");
  const [quickAddPlaceId, setQuickAddPlaceId] = useState("");
  const [quickAddIsStaple, setQuickAddIsStaple] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (isBootstrapping) {
    return <Loading label="Loading recipes..." />;
  }

  const effectiveRecipeId = recipes.some((recipe) => recipe.id === selectedRecipeId)
    ? selectedRecipeId
    : recipes[0]?.id ?? "";
  const selectedRecipe = recipes.find((recipe) => recipe.id === effectiveRecipeId) ?? null;
  const selectedIngredients = recipeIngredients.filter(
    (ingredient) => ingredient.recipeId === effectiveRecipeId,
  );
  const activeShoppingList = getActiveShoppingList(shoppingLists);
  const effectiveQuickAddPlaceId = places.some((place) => place.id === quickAddPlaceId)
    ? quickAddPlaceId
    : places[0]?.id ?? "";
  const filteredItems = items.filter((item) => {
    if (selectedIngredients.some((ingredient) => ingredient.itemId === item.id)) {
      return false;
    }

    if (!ingredientSearch.trim()) {
      return true;
    }

    const query = ingredientSearch.trim().toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      (item.notes ?? "").toLowerCase().includes(query)
    );
  });

  const placeOptions = places.map((place) => ({
    id: place.id,
    label: getPlaceOptionLabel(place, rooms),
  }));

  async function createRecipe() {
    if (!newRecipeName.trim()) {
      return;
    }

    const timestamp = getTimestamp();
    const recipe: RecipeRecord = {
      id: getId(),
      userId,
      name: newRecipeName.trim(),
      notes: "",
      imageUrl: null,
      imageProxyUrl: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyRecipeLocally(recipe);
    await enqueueMutation(buildMutation("recipe", "upsert", recipe, timestamp));
    setNewRecipeName("");
    setSelectedRecipeId(recipe.id);
    setMessage(`Created ${recipe.name}`);

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function saveRecipe(recipe: RecipeRecord, updates: Partial<RecipeRecord>) {
    const timestamp = getTimestamp();
    const nextRecipe: RecipeRecord = {
      ...recipe,
      ...updates,
      updatedAt: timestamp,
    };

    await applyRecipeLocally(nextRecipe);
    await enqueueMutation(buildMutation("recipe", "upsert", nextRecipe, timestamp));
    setMessage("Recipe saved");

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function linkItemToRecipe(
    item: ItemRecord,
    recipe: RecipeRecord,
    options?: { message?: string; syncAfter?: boolean },
  ) {
    const existingIngredient = recipeIngredients.find(
      (ingredient) => ingredient.recipeId === recipe.id && ingredient.itemId === item.id,
    );

    if (existingIngredient) {
      setMessage(`${item.name} is already linked to ${recipe.name}`);
      return;
    }

    const timestamp = getTimestamp();
    const ingredient: RecipeIngredientRecord = {
      id: getId(),
      recipeId: recipe.id,
      userId,
      itemId: item.id,
      quantity: 1,
      unitLabel: null,
      includeInCost: !item.isStaple,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyRecipeIngredientLocally(ingredient);
    await enqueueMutation(buildMutation("recipe-ingredient", "upsert", ingredient, timestamp));
    setMessage(options?.message ?? `${item.name} added to ${recipe.name}`);

    if (options?.syncAfter !== false && navigator.onLine) {
      await syncNow();
    }
  }

  async function addIngredient(itemId: string) {
    if (!selectedRecipe) {
      return;
    }

    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    await linkItemToRecipe(item, selectedRecipe);
  }

  async function createGlobalItemAndLink() {
    if (!selectedRecipe || !quickAddItemName.trim()) {
      return;
    }

    if (!effectiveQuickAddPlaceId) {
      setMessage("Add a place first so new items have somewhere to live");
      return;
    }

    const normalizedName = quickAddItemName.trim().toLowerCase();
    const existingItem = items.find((item) => item.name.trim().toLowerCase() === normalizedName);

    if (existingItem) {
      await linkItemToRecipe(existingItem, selectedRecipe, {
        message: `${existingItem.name} linked to ${selectedRecipe.name}`,
      });
      setQuickAddItemName("");
      return;
    }

    const timestamp = getTimestamp();
    const item: ItemRecord = {
      id: getId(),
      placeId: effectiveQuickAddPlaceId,
      userId,
      name: quickAddItemName.trim(),
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
      recipeId: selectedRecipe.id,
      userId,
      itemId: item.id,
      quantity: 1,
      unitLabel: null,
      includeInCost: !item.isStaple,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyItemLocally(item);
    await enqueueMutation(buildMutation("item", "upsert", item, timestamp));
    await applyRecipeIngredientLocally(ingredient);
    await enqueueMutation(buildMutation("recipe-ingredient", "upsert", ingredient, timestamp));

    setQuickAddItemName("");
    setQuickAddIsStaple(false);
    setMessage(`${item.name} created and linked to ${selectedRecipe.name}`);

    if (navigator.onLine) {
      await syncNow();
    }
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

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function removeIngredient(ingredientId: string) {
    const timestamp = getTimestamp();
    await deleteRecipeIngredientLocally(ingredientId);
    await enqueueMutation(
      buildMutation("recipe-ingredient", "delete", { id: ingredientId }, timestamp),
    );
    setMessage("Ingredient removed");

    if (navigator.onLine) {
      await syncNow();
    }
  }

  async function addRecipeToShoppingList(recipe: RecipeRecord) {
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
      await enqueueMutation(
        buildMutation("shopping-list-entry", "upsert", nextEntry, timestamp),
      );
    }

    setMessage(`Added ingredients for ${recipe.name} to the shopping list`);

    if (navigator.onLine) {
      await syncNow();
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          Recipes
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
          Recipe catalog
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          Build meals from your tracked items, keep staples optional, and push ingredients onto
          the shopping list when you need them.
        </p>
        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              New recipe
            </label>
            <input
              value={newRecipeName}
              onChange={(event) => setNewRecipeName(event.target.value)}
              placeholder="Mushroom stroganoff"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
            />
            <button
              type="button"
              onClick={() => void createRecipe()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
            >
              <Plus className="size-4" />
              Create recipe
            </button>
          </div>

          <div className="space-y-3">
            {recipes.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
                No recipes yet.
              </div>
            ) : (
              recipes.map((recipe) => {
                const ingredientCount = recipeIngredients.filter(
                  (ingredient) => ingredient.recipeId === recipe.id,
                ).length;
                const isSelected = recipe.id === effectiveRecipeId;
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => setSelectedRecipeId(recipe.id)}
                    className={[
                      "w-full rounded-[1.5rem] border px-4 py-4 text-left transition",
                      isSelected
                        ? "border-[color:var(--color-forest)] bg-[color:var(--color-panel-muted)] shadow-[0_16px_40px_-32px_rgba(22,38,32,0.65)]"
                        : "border-black/10 bg-white hover:border-[color:var(--color-forest)]/40 hover:bg-[color:var(--color-panel-muted)]/55",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <ChefHat className="size-4 text-[color:var(--color-forest)]" />
                      <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                        {recipe.name}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                      {ingredientCount} ingredients
                      {formatCurrencyFromPence(
                        getRecipeCostPence(recipe, recipeIngredients, items),
                      )
                        ? ` · ${formatCurrencyFromPence(
                            getRecipeCostPence(recipe, recipeIngredients, items),
                          )}`
                        : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="space-y-4">
          {!selectedRecipe ? (
            <section className="rounded-[2rem] border border-dashed border-black/10 bg-white/75 px-6 py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
              Pick a recipe or create one to start planning meals.
            </section>
          ) : (
            <>
              <RecipeEditor
                key={selectedRecipe.id}
                recipe={selectedRecipe}
                recipeIngredients={selectedIngredients}
                items={items}
                onSave={saveRecipe}
                onAddToShoppingList={addRecipeToShoppingList}
              />

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-3 rounded-[2rem] border border-black/5 bg-white/85 p-4 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        Ingredients
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-[color:var(--color-ink)]">
                        Linked items
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

                      return (
                        <article
                          key={ingredient.id}
                          className="rounded-[1.5rem] bg-[color:var(--color-panel-muted)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-[color:var(--color-ink)]">
                                {item.name}
                              </h4>
                              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                                {item.isStaple ? "Staple" : "Tracked item"}
                                {item.trackPriceHistory ? " · price-tracked" : ""}
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

                          <div className="mt-4 grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)_auto]">
                            <label className="space-y-2">
                              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                                Quantity
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={ingredient.quantity}
                                onChange={(event) =>
                                  void updateIngredient(ingredient, {
                                    quantity: Math.max(Number(event.target.value) || 1, 1),
                                  })
                                }
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
                        Quick add
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                        Create a global item here and link it to this recipe straight away.
                      </p>

                      <div className="mt-4 space-y-3">
                        <input
                          value={quickAddItemName}
                          onChange={(event) => setQuickAddItemName(event.target.value)}
                          placeholder="Add a new ingredient"
                          className="w-full rounded-2xl border border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                        />
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
                          Create and link
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        Add ingredients
                      </p>
                      <input
                        value={ingredientSearch}
                        onChange={(event) => setIngredientSearch(event.target.value)}
                        placeholder="Search items"
                        className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
                      />
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
                        <p className="text-sm font-semibold text-[color:var(--color-ink)]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                          {item.isStaple ? "Staple" : "Recipe item"}
                          {item.trackPriceHistory ? " · price-tracked" : ""}
                        </p>
                      </button>
                    ))}
                    {filteredItems.length === 0 ? (
                      <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
                        No more matching items to add.
                      </div>
                    ) : null}
                  </div>
                </aside>
              </section>
            </>
          )}
        </div>
      </div>
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
  onAddToShoppingList,
}: {
  recipe: RecipeRecord;
  recipeIngredients: RecipeIngredientRecord[];
  items: ItemRecord[];
  onSave: (recipe: RecipeRecord, updates: Partial<RecipeRecord>) => Promise<void>;
  onAddToShoppingList: (recipe: RecipeRecord) => Promise<void>;
}) {
  const [name, setName] = useState(recipe.name);
  const [notes, setNotes] = useState(recipe.notes ?? "");
  const mealCost = formatCurrencyFromPence(getRecipeCostPence(recipe, recipeIngredients, items));

  return (
    <section className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Selected recipe
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
            {recipe.name}
          </h3>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            {recipeIngredients.length} ingredients
            {mealCost ? ` · ${mealCost}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void onAddToShoppingList(recipe)}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
          >
            <ShoppingBasket className="size-4" />
            Add ingredients to list
          </button>
          <button
            type="button"
            onClick={() => void onSave(recipe, { name: name.trim(), notes: notes.trim() || null })}
            className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
          >
            <Save className="size-4" />
            Save recipe
          </button>
        </div>
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
