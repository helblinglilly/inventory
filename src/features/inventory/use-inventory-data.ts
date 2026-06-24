"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getInventoryStoreSnapshot,
  subscribeToInventoryStore,
} from "@/features/inventory/store";
import { bootstrapFromServer, flushMutations } from "@/features/inventory/sync";

export function useInventoryData() {
  const state = useSyncExternalStore(
    subscribeToInventoryStore,
    getInventoryStoreSnapshot,
    getInventoryStoreSnapshot,
  );

  useEffect(() => {
    void (async () => {
      await bootstrapFromServer();
    })();
  }, []);

  async function syncNow() {
    await flushMutations();
  }

  return {
    ...state,
    syncNow,
  };
}
