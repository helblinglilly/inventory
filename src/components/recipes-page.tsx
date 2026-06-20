"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChefHat, Loader2, Plus } from "lucide-react";
import { applyRecipeLocally, enqueueMutation } from "@/features/inventory/sync";
import {
  buildMutation,
  getId,
  getRecipeCostPence,
  getTimestamp,
} from "@/features/inventory/helpers";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import type { ItemRecord, RecipeIngredientRecord, RecipeRecord } from "@/features/inventory/types";
import { formatCurrencyFromPence } from "@/lib/utils";

type RecipesPageProps = {
  userId: string;
};

export function RecipesPage({ userId }: RecipesPageProps) {
  const { items, recipes, recipeIngredients, isBootstrapping, syncNow } = useInventoryData();
  const [newRecipeName, setNewRecipeName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (isBootstrapping) {
    return <Loading label="Loading recipes..." />;
  }

  async function createRecipe() {
    const name = newRecipeName.trim();

    if (!name) {
      return;
    }

    const timestamp = getTimestamp();
    const recipe: RecipeRecord = {
      id: getId(),
      userId,
      name,
      notes: null,
      imageUrl: null,
      imageProxyUrl: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyRecipeLocally(recipe);
    await enqueueMutation(buildMutation("recipe", "upsert", recipe, timestamp));
    setNewRecipeName("");
    setMessage(`Created ${recipe.name}`);

    if (navigator.onLine) {
      await syncNow();
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
              Recipes
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">
              Recipe catalog
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              Browse your recipes and open one to view the full details.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <input
              value={newRecipeName}
              onChange={(event) => setNewRecipeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void createRecipe();
                }
              }}
              placeholder="New recipe name"
              className="min-w-0 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)] sm:w-72"
            />
            <button
              type="button"
              onClick={() => void createRecipe()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
            >
              <Plus className="size-4" />
              Add recipe
            </button>
          </div>
        </div>
        {message ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {selectedRecipe ? (
            <Link
              href={`/app/recipe/${selectedRecipe.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[color:var(--color-ink)] transition hover:border-[color:var(--color-forest)] hover:text-[color:var(--color-forest)]"
            >
              <ChefHat className="size-4" />
              Open recipe page
            </Link>
          ) : null}
        </div>
      </header>

      {recipes.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-black/10 bg-white/75 px-6 py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
          No recipes yet.
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              recipeIngredients={recipeIngredients}
              items={items}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RecipeCard({
  recipe,
  recipeIngredients,
  items,
}: {
  recipe: RecipeRecord;
  recipeIngredients: RecipeIngredientRecord[];
  items: ItemRecord[];
}) {
  const ingredients = recipeIngredients.filter((ingredient) => ingredient.recipeId === recipe.id);
  const cost = formatCurrencyFromPence(getRecipeCostPence(recipe, recipeIngredients, items));

  return (
    <Link
      href={`/app/recipe/${recipe.id}`}
      className="group flex h-full flex-col justify-between rounded-[1.75rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.55)] transition hover:-translate-y-0.5 hover:border-[color:var(--color-forest)]/30"
    >
      <div>
        <div className="flex items-center gap-2">
          <ChefHat className="size-4 text-[color:var(--color-forest)]" />
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            Recipe
          </p>
        </div>
        <h3 className="mt-3 text-xl font-semibold text-[color:var(--color-ink)]">{recipe.name}</h3>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="space-y-1 text-sm text-[color:var(--color-ink-soft)]">
          <p>
            <span className="font-semibold text-[color:var(--color-ink)]">
              {ingredients.length}
            </span>{" "}
            {ingredients.length === 1 ? "ingredient" : "ingredients"}
          </p>
          <p>
            <span className="font-semibold text-[color:var(--color-ink)]">{cost ?? "—"}</span> cost
          </p>
        </div>
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-[color:var(--color-panel-muted)] text-[color:var(--color-forest)] transition group-hover:bg-[color:var(--color-forest)] group-hover:text-white">
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
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
