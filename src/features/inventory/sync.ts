"use client";

import {
  getInventoryStoreSnapshot,
  resetInventoryStoreState,
  setInventoryStoreState,
} from "@/features/inventory/store";
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

let bootstrapPromise: Promise<BootstrapResponse> | null = null;
let flushPromise: Promise<void> | null = null;

function getBootstrapResponseFromStore(): BootstrapResponse {
  const snapshot = getInventoryStoreSnapshot();

  return {
    rooms: snapshot.rooms,
    places: snapshot.places,
    items: snapshot.items,
    shoppingLists: snapshot.shoppingLists,
    shoppingListEntries: snapshot.shoppingListEntries,
    recipes: snapshot.recipes,
    recipeIngredients: snapshot.recipeIngredients,
    mealPlans: snapshot.mealPlans,
    serverTime: Number(snapshot.lastBootstrapAt ?? Date.now()),
  };
}

function replaceBootstrapData(snapshot: BootstrapResponse) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    rooms: snapshot.rooms,
    places: snapshot.places,
    items: snapshot.items,
    shoppingLists: snapshot.shoppingLists,
    shoppingListEntries: snapshot.shoppingListEntries,
    recipes: snapshot.recipes,
    recipeIngredients: snapshot.recipeIngredients,
    mealPlans: snapshot.mealPlans,
    lastBootstrapAt: String(snapshot.serverTime),
  }));
}

function updatePendingMutations(
  updater: (pendingMutations: SyncMutation[]) => SyncMutation[],
) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    pendingMutations: updater(currentState.pendingMutations),
  }));
}

export async function clearLocalInventoryData() {
  resetInventoryStoreState();
}

export async function hydrateLocalSnapshot(snapshot: BootstrapResponse) {
  replaceBootstrapData(snapshot);
}

export async function bootstrapFromServer(force = false) {
  const snapshot = getInventoryStoreSnapshot();

  if (!force && snapshot.lastBootstrapAt !== null && !snapshot.isBootstrapping) {
    return getBootstrapResponseFromStore();
  }

  if (bootstrapPromise && !force) {
    return bootstrapPromise;
  }

  setInventoryStoreState((currentState) => ({
    ...currentState,
    isBootstrapping: true,
  }));

  bootstrapPromise = (async () => {
    const response = await fetch("/api/inventory/bootstrap", {
      cache: "no-store",
    });

    if (response.status === 401) {
      await clearLocalInventoryData();
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      throw new Error("Unable to load inventory data");
    }

    const payload = bootstrapResponseSchema.parse(await response.json());
    await hydrateLocalSnapshot(payload);
    return payload;
  })();

  try {
    return await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
    setInventoryStoreState((currentState) => ({
      ...currentState,
      isBootstrapping: false,
    }));
  }
}

export async function enqueueMutation(mutation: SyncMutation) {
  const parsedMutation = mutationSchema.parse(mutation);
  updatePendingMutations((pendingMutations) => [...pendingMutations, parsedMutation]);
}

export async function applyRoomLocally(room: RoomRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    rooms: [
      ...currentState.rooms.filter((entry) => entry.id !== room.id),
      room,
    ].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
  }));
}

export async function deleteRoomLocally(roomId: string) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    rooms: currentState.rooms.filter((entry) => entry.id !== roomId),
  }));
}

export async function applyPlaceLocally(place: PlaceRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    places: [
      ...currentState.places.filter((entry) => entry.id !== place.id),
      place,
    ].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
  }));
}

export async function deletePlaceLocally(placeId: string) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    places: currentState.places.filter((entry) => entry.id !== placeId),
  }));
}

export async function applyItemLocally(item: ItemRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    items: [
      ...currentState.items.filter((entry) => entry.id !== item.id),
      item,
    ].sort((left, right) => left.name.localeCompare(right.name)),
  }));
}

export async function deleteItemLocally(itemId: string) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    items: currentState.items.filter((entry) => entry.id !== itemId),
    recipeIngredients: currentState.recipeIngredients.filter((entry) => entry.itemId !== itemId),
    shoppingListEntries: currentState.shoppingListEntries.filter((entry) => entry.itemId !== itemId),
  }));
}

export async function applyShoppingListLocally(list: ShoppingListRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    shoppingLists: [
      ...currentState.shoppingLists.filter((entry) => entry.id !== list.id),
      list,
    ].sort((left, right) => left.createdAt - right.createdAt),
  }));
}

export async function applyShoppingListEntryLocally(entry: ShoppingListEntryRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    shoppingListEntries: [
      ...currentState.shoppingListEntries.filter((candidate) => candidate.id !== entry.id),
      entry,
    ].sort((left, right) => left.createdAt - right.createdAt),
  }));
}

export async function deleteShoppingListEntryLocally(entryId: string) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    shoppingListEntries: currentState.shoppingListEntries.filter((entry) => entry.id !== entryId),
  }));
}

export async function applyRecipeLocally(recipe: RecipeRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    recipes: [
      ...currentState.recipes.filter((entry) => entry.id !== recipe.id),
      recipe,
    ].sort((left, right) => left.name.localeCompare(right.name)),
  }));
}

export async function deleteRecipeLocally(recipeId: string) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    recipes: currentState.recipes.filter((entry) => entry.id !== recipeId),
    recipeIngredients: currentState.recipeIngredients.filter(
      (entry) => entry.recipeId !== recipeId,
    ),
    shoppingListEntries: currentState.shoppingListEntries.filter(
      (entry) => entry.recipeId !== recipeId,
    ),
    mealPlans: currentState.mealPlans.map((entry) =>
      entry.recipeId === recipeId
        ? { ...entry, recipeId: null }
        : entry,
    ),
  }));
}

export async function applyRecipeIngredientLocally(ingredient: RecipeIngredientRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    recipeIngredients: [
      ...currentState.recipeIngredients.filter((entry) => entry.id !== ingredient.id),
      ingredient,
    ].sort((left, right) => left.createdAt - right.createdAt),
  }));
}

export async function deleteRecipeIngredientLocally(ingredientId: string) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    recipeIngredients: currentState.recipeIngredients.filter((entry) => entry.id !== ingredientId),
  }));
}

export async function applyMealPlanLocally(mealPlan: MealPlanRecord) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    mealPlans: [
      ...currentState.mealPlans.filter((entry) => entry.id !== mealPlan.id),
      mealPlan,
    ].sort((left, right) => left.plannedFor.localeCompare(right.plannedFor)),
  }));
}

export async function deleteMealPlanLocally(mealPlanId: string) {
  setInventoryStoreState((currentState) => ({
    ...currentState,
    mealPlans: currentState.mealPlans.filter((entry) => entry.id !== mealPlanId),
  }));
}

async function applyMutationLocally(mutation: SyncMutation) {
  switch (mutation.entity) {
    case "room": {
      if (mutation.operation === "upsert") {
        await applyRoomLocally(mutation.payload as RoomRecord);
      } else if (mutation.operation === "delete") {
        await deleteRoomLocally(String(mutation.payload.id));
      }
      return;
    }
    case "place": {
      if (mutation.operation === "upsert") {
        await applyPlaceLocally(mutation.payload as PlaceRecord);
      } else if (mutation.operation === "delete") {
        await deletePlaceLocally(String(mutation.payload.id));
      }
      return;
    }
    case "item": {
      if (mutation.operation === "upsert") {
        await applyItemLocally(mutation.payload as ItemRecord);
      } else if (mutation.operation === "delete") {
        await deleteItemLocally(String(mutation.payload.id));
      } else if (mutation.operation === "adjust-stock") {
        const payloadItemId = String(mutation.payload.id);
        const delta = Number(mutation.payload.delta ?? 0);
        const updatedAt = Number(mutation.payload.updatedAt ?? Date.now());
        const currentItem =
          getInventoryStoreSnapshot().items.find((entry) => entry.id === payloadItemId) ?? null;

        if (!currentItem) {
          return;
        }

        await applyItemLocally({
          ...currentItem,
          actualStock: Math.max(currentItem.actualStock + delta, 0),
          updatedAt,
        });
      }
      return;
    }
    case "shopping-list": {
      if (mutation.operation === "upsert") {
        await applyShoppingListLocally(mutation.payload as ShoppingListRecord);
      }
      return;
    }
    case "shopping-list-entry": {
      if (mutation.operation === "upsert") {
        await applyShoppingListEntryLocally(mutation.payload as ShoppingListEntryRecord);
      } else if (mutation.operation === "delete") {
        await deleteShoppingListEntryLocally(String(mutation.payload.id));
      }
      return;
    }
    case "recipe": {
      if (mutation.operation === "upsert") {
        await applyRecipeLocally(mutation.payload as RecipeRecord);
      } else if (mutation.operation === "delete") {
        await deleteRecipeLocally(String(mutation.payload.id));
      }
      return;
    }
    case "recipe-ingredient": {
      if (mutation.operation === "upsert") {
        await applyRecipeIngredientLocally(mutation.payload as RecipeIngredientRecord);
      } else if (mutation.operation === "delete") {
        await deleteRecipeIngredientLocally(String(mutation.payload.id));
      }
      return;
    }
    case "meal-plan": {
      if (mutation.operation === "upsert") {
        await applyMealPlanLocally(mutation.payload as MealPlanRecord);
      } else if (mutation.operation === "delete") {
        await deleteMealPlanLocally(String(mutation.payload.id));
      }
    }
  }
}

async function replayPendingMutationsLocally(pendingMutations: SyncMutation[]) {
  for (const mutation of pendingMutations) {
    await applyMutationLocally(mutation);
  }
}

export async function flushMutations() {
  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
    try {
      while (true) {
        const { pendingMutations } = getInventoryStoreSnapshot();
        const mutationsToFlush = [...pendingMutations];

        if (mutationsToFlush.length === 0) {
          return;
        }

        setInventoryStoreState((currentState) => ({
          ...currentState,
          isSyncing: true,
        }));

        const response = await fetch("/api/inventory/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mutations: mutationsToFlush }),
        });

        if (response.status === 401) {
          await clearLocalInventoryData();
          throw new Error("Unauthorized");
        }

        if (!response.ok) {
          throw new Error("Unable to save inventory changes");
        }

        const payload = bootstrapResponseSchema.parse(await response.json());
        await hydrateLocalSnapshot(payload);

        const flushedMutationIds = new Set(mutationsToFlush.map((mutation) => mutation.id));
        updatePendingMutations((currentPendingMutations) =>
          currentPendingMutations.filter((mutation) => !flushedMutationIds.has(mutation.id)),
        );

        const remainingMutations = getInventoryStoreSnapshot().pendingMutations;
        if (remainingMutations.length === 0) {
          return;
        }

        await replayPendingMutationsLocally(remainingMutations);
      }
    } catch (error) {
      await bootstrapFromServer(true).catch(() => undefined);
      throw error;
    } finally {
      setInventoryStoreState((currentState) => ({
        ...currentState,
        isSyncing: false,
      }));
    }
  })();

  try {
    await flushPromise;
  } finally {
    flushPromise = null;
  }
}
