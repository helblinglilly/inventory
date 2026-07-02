"use client";

import type {
  InventoryAccessRecord,
  InventoryInviteRecord,
  InventoryMemberRecord,
  ItemRecord,
  MealPlanRecord,
  PlaceRecord,
  RecipeIngredientRecord,
  RecipeRecord,
  RoomRecord,
  ShoppingListEntryRecord,
  ShoppingListRecord,
  SyncMutation,
} from "@/features/inventory/types";

export type InventoryStoreState = {
  access: InventoryAccessRecord | null;
  sharedMembers: InventoryMemberRecord[];
  pendingInvites: InventoryInviteRecord[];
  rooms: RoomRecord[];
  places: PlaceRecord[];
  items: ItemRecord[];
  shoppingLists: ShoppingListRecord[];
  shoppingListEntries: ShoppingListEntryRecord[];
  recipes: RecipeRecord[];
  recipeIngredients: RecipeIngredientRecord[];
  mealPlans: MealPlanRecord[];
  pendingMutations: SyncMutation[];
  lastBootstrapAt: string | null;
  isBootstrapping: boolean;
  isSyncing: boolean;
};

const EMPTY_STATE: InventoryStoreState = {
  access: null,
  sharedMembers: [],
  pendingInvites: [],
  rooms: [],
  places: [],
  items: [],
  shoppingLists: [],
  shoppingListEntries: [],
  recipes: [],
  recipeIngredients: [],
  mealPlans: [],
  pendingMutations: [],
  lastBootstrapAt: null,
  isBootstrapping: true,
  isSyncing: false,
};

let state: InventoryStoreState = EMPTY_STATE;

const listeners = new Set<() => void>();

export function getInventoryStoreSnapshot() {
  return state;
}

export function subscribeToInventoryStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setInventoryStoreState(
  nextState:
    | InventoryStoreState
    | ((currentState: InventoryStoreState) => InventoryStoreState),
) {
  state =
    typeof nextState === "function"
      ? nextState(state)
      : nextState;

  listeners.forEach((listener) => listener());
}

export function resetInventoryStoreState() {
  setInventoryStoreState({ ...EMPTY_STATE, isBootstrapping: false });
}
