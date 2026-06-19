"use client";

import { offlineDb } from "@/features/inventory/offline-db";
import {
  bootstrapResponseSchema,
  mutationSchema,
  type BootstrapResponse,
  type ItemRecord,
  type PlaceRecord,
  type RoomRecord,
  type SyncMutation,
} from "@/features/inventory/types";

export async function hydrateLocalSnapshot(snapshot: BootstrapResponse) {
  await offlineDb.transaction(
    "rw",
    offlineDb.rooms,
    offlineDb.places,
    offlineDb.items,
    offlineDb.meta,
    async () => {
      await offlineDb.rooms.clear();
      await offlineDb.places.clear();
      await offlineDb.items.clear();

      await offlineDb.rooms.bulkPut(snapshot.rooms);
      await offlineDb.places.bulkPut(snapshot.places);
      await offlineDb.items.bulkPut(snapshot.items);
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

export async function applyPlaceLocally(place: PlaceRecord) {
  await offlineDb.places.put(place);
}

export async function applyItemLocally(item: ItemRecord) {
  await offlineDb.items.put(item);
}

export async function flushMutations() {
  const mutations = await offlineDb.mutations.orderBy("queuedAt").toArray();

  if (mutations.length === 0) {
    return;
  }

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
}
