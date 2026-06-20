"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { offlineDb } from "@/features/inventory/offline-db";
import { bootstrapFromServer, flushMutations } from "@/features/inventory/sync";

export function useInventoryData() {
  const rooms = useLiveQuery(() => offlineDb.rooms.orderBy("sortOrder").toArray(), [], []);
  const places = useLiveQuery(
    () => offlineDb.places.orderBy("sortOrder").toArray(),
    [],
    [],
  );
  const items = useLiveQuery(() => offlineDb.items.orderBy("name").toArray(), [], []);
  const shoppingLists = useLiveQuery(
    () => offlineDb.shoppingLists.orderBy("createdAt").toArray(),
    [],
    [],
  );
  const shoppingListEntries = useLiveQuery(
    () => offlineDb.shoppingListEntries.orderBy("createdAt").toArray(),
    [],
    [],
  );
  const recipes = useLiveQuery(() => offlineDb.recipes.orderBy("name").toArray(), [], []);
  const recipeIngredients = useLiveQuery(
    () => offlineDb.recipeIngredients.orderBy("createdAt").toArray(),
    [],
    [],
  );
  const mealPlans = useLiveQuery(
    () => offlineDb.mealPlans.orderBy("plannedFor").toArray(),
    [],
    [],
  );
  const pendingMutations = useLiveQuery(
    () => offlineDb.mutations.orderBy("queuedAt").toArray(),
    [],
    [],
  );
  const meta = useLiveQuery(() => offlineDb.meta.toArray(), [], []);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await bootstrapFromServer();
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  async function syncNow() {
    if (!navigator.onLine) {
      return;
    }

    setIsSyncing(true);

    try {
      await flushMutations();
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    const onOnline = () => {
      void syncNow();
    };

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  });

  return {
    rooms: rooms ?? [],
    places: places ?? [],
    items: items ?? [],
    shoppingLists: shoppingLists ?? [],
    shoppingListEntries: shoppingListEntries ?? [],
    recipes: recipes ?? [],
    recipeIngredients: recipeIngredients ?? [],
    mealPlans: mealPlans ?? [],
    pendingMutations: pendingMutations ?? [],
    lastBootstrapAt:
      meta?.find((entry) => entry.key === "lastBootstrapAt")?.value ?? null,
    isBootstrapping,
    isSyncing,
    syncNow,
  };
}
