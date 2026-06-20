"use client";

import { offlineDb } from "@/features/inventory/offline-db";
import { setSyncStatus } from "@/features/inventory/sync-status";
import {
  bootstrapResponseSchema,
  mutationSchema,
  type BootstrapResponse,
  type ItemRecord,
  type MealPlanRecord,
  type PlaceRecord,
  type RecipeIngredientRecord,
  type RecipeRecord,
  type RoomRecord,
  type ShoppingListEntryRecord,
  type ShoppingListRecord,
  type SyncMutation,
} from "@/features/inventory/types";

export async function hydrateLocalSnapshot(snapshot: BootstrapResponse) {
  await offlineDb.transaction(
    "rw",
    [
      offlineDb.rooms,
      offlineDb.places,
      offlineDb.items,
      offlineDb.shoppingLists,
      offlineDb.shoppingListEntries,
      offlineDb.recipes,
      offlineDb.recipeIngredients,
      offlineDb.mealPlans,
      offlineDb.meta,
    ],
    async () => {
      await offlineDb.rooms.clear();
      await offlineDb.places.clear();
      await offlineDb.items.clear();
      await offlineDb.shoppingLists.clear();
      await offlineDb.shoppingListEntries.clear();
      await offlineDb.recipes.clear();
      await offlineDb.recipeIngredients.clear();
      await offlineDb.mealPlans.clear();

      await offlineDb.rooms.bulkPut(snapshot.rooms);
      await offlineDb.places.bulkPut(snapshot.places);
      await offlineDb.items.bulkPut(snapshot.items);
      await offlineDb.shoppingLists.bulkPut(snapshot.shoppingLists);
      await offlineDb.shoppingListEntries.bulkPut(snapshot.shoppingListEntries);
      await offlineDb.recipes.bulkPut(snapshot.recipes);
      await offlineDb.recipeIngredients.bulkPut(snapshot.recipeIngredients);
      await offlineDb.mealPlans.bulkPut(snapshot.mealPlans);
      await offlineDb.meta.put({
        key: "lastBootstrapAt",
        value: String(snapshot.serverTime),
      });
    },
  );
}

export async function bootstrapFromServer() {
  const response = await fetch("/api/inventory/bootstrap", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load inventory bootstrap");
  }

  const payload = bootstrapResponseSchema.parse(await response.json());
  await hydrateLocalSnapshot(payload);
  return payload;
}

export async function enqueueMutation(mutation: SyncMutation) {
  await offlineDb.mutations.put(mutationSchema.parse(mutation));
}

export async function applyRoomLocally(room: RoomRecord) {
  await offlineDb.rooms.put(room);
}

export async function deleteRoomLocally(roomId: string) {
  await offlineDb.rooms.delete(roomId);
}

export async function applyPlaceLocally(place: PlaceRecord) {
  await offlineDb.places.put(place);
}

export async function deletePlaceLocally(placeId: string) {
  await offlineDb.places.delete(placeId);
}

export async function applyItemLocally(item: ItemRecord) {
  await offlineDb.items.put(item);
}

export async function applyShoppingListLocally(list: ShoppingListRecord) {
  await offlineDb.shoppingLists.put(list);
}

export async function applyShoppingListEntryLocally(entry: ShoppingListEntryRecord) {
  await offlineDb.shoppingListEntries.put(entry);
}

export async function deleteShoppingListEntryLocally(entryId: string) {
  await offlineDb.shoppingListEntries.delete(entryId);
}

export async function applyRecipeLocally(recipe: RecipeRecord) {
  await offlineDb.recipes.put(recipe);
}

export async function applyRecipeIngredientLocally(ingredient: RecipeIngredientRecord) {
  await offlineDb.recipeIngredients.put(ingredient);
}

export async function deleteRecipeIngredientLocally(ingredientId: string) {
  await offlineDb.recipeIngredients.delete(ingredientId);
}

export async function applyMealPlanLocally(mealPlan: MealPlanRecord) {
  await offlineDb.mealPlans.put(mealPlan);
}

export async function deleteMealPlanLocally(mealPlanId: string) {
  await offlineDb.mealPlans.delete(mealPlanId);
}

export async function flushMutations() {
  const mutations = await offlineDb.mutations.orderBy("queuedAt").toArray();

  if (mutations.length === 0) {
    return;
  }

  setSyncStatus({ active: true, total: mutations.length });

  try {
    const response = await fetch("/api/inventory/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mutations }),
    });

    if (!response.ok) {
      throw new Error("Unable to sync inventory changes");
    }

    const payload = bootstrapResponseSchema.parse(await response.json());

    await offlineDb.transaction(
      "rw",
      offlineDb.mutations,
      async () => {
        await hydrateLocalSnapshot(payload);
        await offlineDb.mutations.bulkDelete(mutations.map((mutation) => mutation.id));
      },
    );
  } finally {
    setSyncStatus({ active: false, total: 0 });
  }
}
