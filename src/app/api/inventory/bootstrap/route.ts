import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  items,
  mealPlans,
  places,
  recipeIngredients,
  recipes,
  rooms,
  shoppingListEntries,
  shoppingLists,
} from "@/db/inventory-schema";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getId } from "@/features/inventory/helpers";

async function ensureActiveShoppingList(userId: string) {
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

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  await ensureActiveShoppingList(userId);

  const [
    roomRows,
    placeRows,
    itemRows,
    shoppingListRows,
    shoppingListEntryRows,
    recipeRows,
    recipeIngredientRows,
    mealPlanRows,
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
  ]);

  return NextResponse.json({
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
  });
}
