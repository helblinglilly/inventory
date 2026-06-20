"use client";

import Dexie, { type EntityTable } from "dexie";
import type { ItemRecord, PlaceRecord, RoomRecord, SyncMutation } from "@/features/inventory/types";

type MetaRecord = {
  key: string;
  value: string;
};

const LOCAL_SCHEMA_VERSION = 2;

export class InventoryOfflineDatabase extends Dexie {
  rooms!: EntityTable<RoomRecord, "id">;
  places!: EntityTable<PlaceRecord, "id">;
  items!: EntityTable<ItemRecord, "id">;
  mutations!: EntityTable<SyncMutation, "id">;
  meta!: EntityTable<MetaRecord, "key">;

  constructor() {
    super("inventory-offline");

    this.version(LOCAL_SCHEMA_VERSION).stores({
      rooms: "id, userId, sortOrder, createdAt, updatedAt",
      places: "id, roomId, userId, sortOrder, createdAt, updatedAt",
      items: "id, placeId, userId, name, desiredStock, actualStock, createdAt, updatedAt",
      mutations: "id, queuedAt, entity, operation",
      meta: "key",
      // Compatibility shim for pre-inventory local databases and cached clients.
      shoppingLists: "id, createdAt, updatedAt",
    });
  }
}

export const offlineDb = new InventoryOfflineDatabase();
