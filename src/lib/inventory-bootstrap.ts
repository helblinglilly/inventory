import { asc, eq } from "drizzle-orm";
import {
  items,
  itemPlaceLinks,
  mealPlans,
  places,
  recipeIngredients,
  recipes,
  rooms,
  shoppingListEntries,
  shoppingLists,
} from "@/db/inventory-schema";
import { getId } from "@/features/inventory/helpers";
import { db } from "@/lib/db";
import {
  type InventoryAccess,
  listInventoryInvites,
  listInventoryMembers,
} from "@/lib/inventory-sharing";

export async function ensureActiveShoppingList(userId: string) {
  const existingLists = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.userId, userId))
    .orderBy(asc(shoppingLists.createdAt));

  if (existingLists.some((entry) => entry.status === "active")) {
    return;
  }

  const now = Date.now();
  await db.insert(shoppingLists).values({
    id: getId(),
    userId,
    name: "Current list",
    status: "active",
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
}

export async function getInventoryBootstrapPayload(access: InventoryAccess) {
  const userId = access.inventoryUserId;

  await ensureActiveShoppingList(userId);

  const [
    roomRows,
    placeRows,
    itemRows,
    itemPlaceLinkRows,
    shoppingListRows,
    shoppingListEntryRows,
    recipeRows,
    recipeIngredientRows,
    mealPlanRows,
    sharedMembers,
    pendingInvites,
  ] = await Promise.all([
    db
      .select()
      .from(rooms)
      .where(eq(rooms.userId, userId))
      .orderBy(asc(rooms.sortOrder), asc(rooms.name)),
    db
      .select()
      .from(places)
      .where(eq(places.userId, userId))
      .orderBy(asc(places.sortOrder), asc(places.name)),
    db
      .select()
      .from(items)
      .where(eq(items.userId, userId))
      .orderBy(asc(items.name)),
    db
      .select()
      .from(itemPlaceLinks)
      .where(eq(itemPlaceLinks.userId, userId))
      .orderBy(asc(itemPlaceLinks.createdAt)),
    db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.userId, userId))
      .orderBy(asc(shoppingLists.createdAt)),
    db
      .select()
      .from(shoppingListEntries)
      .where(eq(shoppingListEntries.userId, userId))
      .orderBy(asc(shoppingListEntries.createdAt)),
    db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(asc(recipes.name)),
    db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.userId, userId))
      .orderBy(asc(recipeIngredients.createdAt)),
    db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.userId, userId))
      .orderBy(asc(mealPlans.plannedFor)),
    listInventoryMembers(userId),
    access.isOwner ? listInventoryInvites(userId) : Promise.resolve([]),
  ]);

  const itemPlaceIdsByItemId = new Map<string, string[]>();
  for (const link of itemPlaceLinkRows) {
    const current = itemPlaceIdsByItemId.get(link.itemId) ?? [];
    current.push(link.placeId);
    itemPlaceIdsByItemId.set(link.itemId, current);
  }

  return {
    access,
    sharedMembers,
    pendingInvites,
    rooms: roomRows.map((room) => ({
      ...room,
      createdAt: room.createdAt.getTime(),
      updatedAt: room.updatedAt.getTime(),
    })),
    places: placeRows.map((place) => ({
      ...place,
      createdAt: place.createdAt.getTime(),
      updatedAt: place.updatedAt.getTime(),
    })),
    items: itemRows.map((item) => ({
      ...item,
      placeIds: itemPlaceIdsByItemId.get(item.id) ?? [item.placeId],
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
    })),
    shoppingLists: shoppingListRows.map((list) => ({
      ...list,
      clearedAt: list.clearedAt?.getTime() ?? null,
      createdAt: list.createdAt.getTime(),
      updatedAt: list.updatedAt.getTime(),
    })),
    shoppingListEntries: shoppingListEntryRows.map((entry) => ({
      ...entry,
      checkedAt: entry.checkedAt?.getTime() ?? null,
      createdAt: entry.createdAt.getTime(),
      updatedAt: entry.updatedAt.getTime(),
    })),
    recipes: recipeRows.map((recipe) => ({
      ...recipe,
      createdAt: recipe.createdAt.getTime(),
      updatedAt: recipe.updatedAt.getTime(),
    })),
    recipeIngredients: recipeIngredientRows.map((ingredient) => ({
      ...ingredient,
      createdAt: ingredient.createdAt.getTime(),
      updatedAt: ingredient.updatedAt.getTime(),
    })),
    mealPlans: mealPlanRows.map((mealPlan) => ({
      ...mealPlan,
      createdAt: mealPlan.createdAt.getTime(),
      updatedAt: mealPlan.updatedAt.getTime(),
    })),
    serverTime: Date.now(),
  };
}
