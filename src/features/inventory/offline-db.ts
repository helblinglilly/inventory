"use client";

import Dexie, { type EntityTable } from "dexie";
import type {
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

type MetaRecord = {
  key: string;
  value: string;
};

const LOCAL_SCHEMA_VERSION = 4;

const LEGACY_SCHEMA = {
  rooms: "id, userId, sortOrder, createdAt, updatedAt",
  places: "id, roomId, userId, sortOrder, createdAt, updatedAt",
  items: "id, placeId, userId, name, desiredStock, actualStock, createdAt, updatedAt",
  mutations: "id, queuedAt, entity, operation",
  meta: "key",
  // Compatibility shim for pre-inventory local databases and cached clients.
  shoppingLists: "id, createdAt, updatedAt",
} as const;

const CURRENT_SCHEMA = {
  rooms: "id, userId, sortOrder, createdAt, updatedAt",
  places: "id, roomId, userId, sortOrder, createdAt, updatedAt",
  items:
    "id, placeId, userId, name, isStaple, pricePaidPence, desiredStock, actualStock, createdAt, updatedAt",
  shoppingLists: "id, userId, status, createdAt, updatedAt",
  shoppingListEntries: "id, listId, userId, itemId, recipeId, createdAt, checkedAt, updatedAt",
  recipes: "id, userId, name, createdAt, updatedAt",
  recipeIngredients: "id, recipeId, userId, itemId, createdAt, updatedAt",
  mealPlans: "id, userId, plannedFor, mealSlot, recipeId, createdAt, updatedAt",
  mutations: "id, queuedAt, entity, operation",
  meta: "key",
} as const;

export class InventoryOfflineDatabase extends Dexie {
  rooms!: EntityTable<RoomRecord, "id">;
  places!: EntityTable<PlaceRecord, "id">;
  items!: EntityTable<ItemRecord, "id">;
  shoppingLists!: EntityTable<ShoppingListRecord, "id">;
  shoppingListEntries!: EntityTable<ShoppingListEntryRecord, "id">;
  recipes!: EntityTable<RecipeRecord, "id">;
  recipeIngredients!: EntityTable<RecipeIngredientRecord, "id">;
  mealPlans!: EntityTable<MealPlanRecord, "id">;
  mutations!: EntityTable<SyncMutation, "id">;
  meta!: EntityTable<MetaRecord, "key">;

  constructor() {
    super("inventory-offline");

    this.version(2).stores(LEGACY_SCHEMA);
    this.version(LOCAL_SCHEMA_VERSION).stores(CURRENT_SCHEMA);
  }
}

export const offlineDb = new InventoryOfflineDatabase();
