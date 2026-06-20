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

async function replayPendingMutations(excludedMutationIds: string[] = []) {
  const excludedIds = new Set(excludedMutationIds);
  const pendingMutations = await offlineDb.mutations.orderBy("queuedAt").toArray();

  for (const mutation of pendingMutations) {
    if (excludedIds.has(mutation.id)) {
      continue;
    }

    if (mutation.entity === "room") {
      if (mutation.operation === "upsert") {
        await offlineDb.rooms.put(mutation.payload as RoomRecord);
      }

      if (mutation.operation === "delete") {
        await offlineDb.rooms.delete(String(mutation.payload.id));
      }

      continue;
    }

    if (mutation.entity === "place") {
      if (mutation.operation === "upsert") {
        await offlineDb.places.put(mutation.payload as PlaceRecord);
      }

      if (mutation.operation === "delete") {
        await offlineDb.places.delete(String(mutation.payload.id));
      }

      continue;
    }

    if (mutation.entity === "item") {
      if (mutation.operation === "upsert") {
        await offlineDb.items.put(mutation.payload as ItemRecord);
      }

      if (mutation.operation === "adjust-stock") {
        const itemId = String(mutation.payload.id);
        const delta = Number(mutation.payload.delta ?? 0);
        const item = await offlineDb.items.get(itemId);

        if (item) {
          await offlineDb.items.put({
            ...item,
            actualStock: Math.max(item.actualStock + delta, 0),
            updatedAt: Number(mutation.payload.updatedAt ?? item.updatedAt),
          });
        }
      }

      if (mutation.operation === "delete") {
        const itemId = String(mutation.payload.id);
        await offlineDb.items.delete(itemId);
        await offlineDb.recipeIngredients
          .filter((ingredient) => ingredient.itemId === itemId)
          .delete();
        await offlineDb.shoppingListEntries
          .filter((entry) => entry.itemId === itemId)
          .delete();
      }

      continue;
    }

    if (mutation.entity === "shopping-list") {
      if (mutation.operation === "upsert") {
        await offlineDb.shoppingLists.put(mutation.payload as ShoppingListRecord);
      }

      if (mutation.operation === "delete") {
        await offlineDb.shoppingLists.delete(String(mutation.payload.id));
      }

      continue;
    }

    if (mutation.entity === "shopping-list-entry") {
      if (mutation.operation === "upsert") {
        await offlineDb.shoppingListEntries.put(mutation.payload as ShoppingListEntryRecord);
      }

      if (mutation.operation === "delete") {
        await offlineDb.shoppingListEntries.delete(String(mutation.payload.id));
      }

      continue;
    }

    if (mutation.entity === "recipe") {
      if (mutation.operation === "upsert") {
        await offlineDb.recipes.put(mutation.payload as RecipeRecord);
      }

      if (mutation.operation === "delete") {
        await offlineDb.recipes.delete(String(mutation.payload.id));
      }

      continue;
    }

    if (mutation.entity === "recipe-ingredient") {
      if (mutation.operation === "upsert") {
        await offlineDb.recipeIngredients.put(mutation.payload as RecipeIngredientRecord);
      }

      if (mutation.operation === "delete") {
        await offlineDb.recipeIngredients.delete(String(mutation.payload.id));
      }

      continue;
    }

    if (mutation.entity === "meal-plan") {
      if (mutation.operation === "upsert") {
        await offlineDb.mealPlans.put(mutation.payload as MealPlanRecord);
      }

      if (mutation.operation === "delete") {
        await offlineDb.mealPlans.delete(String(mutation.payload.id));
      }
    }
  }
}

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
  await replayPendingMutations();
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

export async function deleteItemLocally(itemId: string) {
  await offlineDb.transaction(
    "rw",
    [offlineDb.items, offlineDb.recipeIngredients, offlineDb.shoppingListEntries],
    async () => {
      await offlineDb.items.delete(itemId);
      await offlineDb.recipeIngredients
        .filter((ingredient) => ingredient.itemId === itemId)
        .delete();
      await offlineDb.shoppingListEntries
        .filter((entry) => entry.itemId === itemId)
        .delete();
    },
  );
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
        await replayPendingMutations(mutations.map((mutation) => mutation.id));
      },
    );
  } finally {
    setSyncStatus({ active: false, total: 0 });
  }
}
