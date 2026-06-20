import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
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
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { bootstrapResponseSchema } from "@/features/inventory/types";
import { getId } from "@/features/inventory/helpers";

const syncSchema = z.object({
  mutations: z.array(
    z.object({
      id: z.string(),
      entity: z.enum([
        "room",
        "place",
        "item",
        "shopping-list",
        "shopping-list-entry",
        "recipe",
        "recipe-ingredient",
        "meal-plan",
      ]),
      operation: z.enum(["upsert", "adjust-stock", "delete"]),
      payload: z.record(z.string(), z.any()),
      queuedAt: z.number(),
    }),
  ),
});

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

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = syncSchema.parse(await request.json());
  const userId = session.user.id;

  await db.transaction(async (tx) => {
    for (const mutation of body.mutations) {
      if (mutation.entity === "room" && mutation.operation === "upsert") {
        await tx
          .insert(rooms)
          .values({
            id: mutation.payload.id,
            userId,
            name: mutation.payload.name,
            sortOrder: mutation.payload.sortOrder ?? 0,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: rooms.id,
            set: {
              name: mutation.payload.name,
              sortOrder: mutation.payload.sortOrder ?? 0,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
      }

      if (mutation.entity === "room" && mutation.operation === "delete") {
        await tx
          .delete(rooms)
          .where(and(eq(rooms.id, String(mutation.payload.id)), eq(rooms.userId, userId)));
      }

      if (mutation.entity === "place" && mutation.operation === "upsert") {
        await tx
          .insert(places)
          .values({
            id: mutation.payload.id,
            roomId: mutation.payload.roomId,
            userId,
            name: mutation.payload.name,
            sortOrder: mutation.payload.sortOrder ?? 0,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: places.id,
            set: {
              roomId: mutation.payload.roomId,
              name: mutation.payload.name,
              sortOrder: mutation.payload.sortOrder ?? 0,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
      }

      if (mutation.entity === "place" && mutation.operation === "delete") {
        await tx
          .delete(places)
          .where(and(eq(places.id, String(mutation.payload.id)), eq(places.userId, userId)));
      }

      if (mutation.entity === "item" && mutation.operation === "upsert") {
        const placeIds = Array.isArray(mutation.payload.placeIds)
          ? mutation.payload.placeIds.map(String)
          : [String(mutation.payload.placeId)];
        const primaryPlaceId = placeIds[0] ?? String(mutation.payload.placeId);

        await tx
          .insert(items)
          .values({
            id: mutation.payload.id,
            placeId: primaryPlaceId,
            userId,
            name: mutation.payload.name,
            notes: mutation.payload.notes ?? null,
            imageUrl: mutation.payload.imageUrl ?? null,
            imageProxyUrl: mutation.payload.imageProxyUrl ?? null,
            pricePaidPence: mutation.payload.pricePaidPence ?? null,
            isStaple: mutation.payload.isStaple ?? false,
            trackPriceHistory: mutation.payload.trackPriceHistory ?? false,
            desiredStock: mutation.payload.desiredStock,
            actualStock: mutation.payload.actualStock,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: items.id,
            set: {
              placeId: primaryPlaceId,
              name: mutation.payload.name,
              notes: mutation.payload.notes ?? null,
              imageUrl: mutation.payload.imageUrl ?? null,
              imageProxyUrl: mutation.payload.imageProxyUrl ?? null,
              pricePaidPence: mutation.payload.pricePaidPence ?? null,
              isStaple: mutation.payload.isStaple ?? false,
              trackPriceHistory: mutation.payload.trackPriceHistory ?? false,
              desiredStock: mutation.payload.desiredStock,
              actualStock: mutation.payload.actualStock,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });

        await tx
          .delete(itemPlaceLinks)
          .where(and(eq(itemPlaceLinks.itemId, String(mutation.payload.id)), eq(itemPlaceLinks.userId, userId)));

        if (placeIds.length > 0) {
          await tx.insert(itemPlaceLinks).values(
            placeIds.map((placeId: string) => ({
              id: getId(),
              itemId: mutation.payload.id,
              placeId,
              userId,
              createdAt: new Date(mutation.payload.createdAt),
              updatedAt: new Date(mutation.payload.updatedAt),
            })),
          );
        }
      }

      if (mutation.entity === "item" && mutation.operation === "adjust-stock") {
        const delta = Number(mutation.payload.delta ?? 0);
        const itemId = String(mutation.payload.id);

        await tx
          .update(items)
          .set({
            actualStock: sql`MAX(${items.actualStock} + ${delta}, 0)`,
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      }

      if (mutation.entity === "item" && mutation.operation === "delete") {
        const itemId = String(mutation.payload.id);

        await tx
          .delete(shoppingListEntries)
          .where(and(eq(shoppingListEntries.itemId, itemId), eq(shoppingListEntries.userId, userId)));

        await tx
          .delete(recipeIngredients)
          .where(and(eq(recipeIngredients.itemId, itemId), eq(recipeIngredients.userId, userId)));

        await tx
          .delete(items)
          .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      }

      if (mutation.entity === "shopping-list" && mutation.operation === "upsert") {
        await tx
          .insert(shoppingLists)
          .values({
            id: mutation.payload.id,
            userId,
            name: mutation.payload.name,
            status: mutation.payload.status ?? "active",
            clearedAt: mutation.payload.clearedAt
              ? new Date(mutation.payload.clearedAt)
              : null,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: shoppingLists.id,
            set: {
              name: mutation.payload.name,
              status: mutation.payload.status ?? "active",
              clearedAt: mutation.payload.clearedAt
                ? new Date(mutation.payload.clearedAt)
                : null,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
      }

      if (mutation.entity === "shopping-list-entry" && mutation.operation === "upsert") {
        await tx
          .insert(shoppingListEntries)
          .values({
            id: mutation.payload.id,
            listId: mutation.payload.listId,
            userId,
            itemId: mutation.payload.itemId ?? null,
            recipeId: mutation.payload.recipeId ?? null,
            label: mutation.payload.label,
            sourceType: mutation.payload.sourceType ?? "manual",
            quantity: mutation.payload.quantity ?? 1,
            unitLabel: mutation.payload.unitLabel ?? null,
            checkedAt: mutation.payload.checkedAt
              ? new Date(mutation.payload.checkedAt)
              : null,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: shoppingListEntries.id,
            set: {
              listId: mutation.payload.listId,
              itemId: mutation.payload.itemId ?? null,
              recipeId: mutation.payload.recipeId ?? null,
              label: mutation.payload.label,
              sourceType: mutation.payload.sourceType ?? "manual",
              quantity: mutation.payload.quantity ?? 1,
              unitLabel: mutation.payload.unitLabel ?? null,
              checkedAt: mutation.payload.checkedAt
                ? new Date(mutation.payload.checkedAt)
                : null,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
      }

      if (mutation.entity === "shopping-list-entry" && mutation.operation === "delete") {
        await tx
          .delete(shoppingListEntries)
          .where(
            and(
              eq(shoppingListEntries.id, String(mutation.payload.id)),
              eq(shoppingListEntries.userId, userId),
            ),
          );
      }

      if (mutation.entity === "recipe" && mutation.operation === "upsert") {
        await tx
          .insert(recipes)
          .values({
            id: mutation.payload.id,
            userId,
            name: mutation.payload.name,
            notes: mutation.payload.notes ?? null,
            imageUrl: mutation.payload.imageUrl ?? null,
            imageProxyUrl: mutation.payload.imageProxyUrl ?? null,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: recipes.id,
            set: {
              name: mutation.payload.name,
              notes: mutation.payload.notes ?? null,
              imageUrl: mutation.payload.imageUrl ?? null,
              imageProxyUrl: mutation.payload.imageProxyUrl ?? null,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
      }

      if (mutation.entity === "recipe" && mutation.operation === "delete") {
        await tx
          .delete(recipes)
          .where(and(eq(recipes.id, String(mutation.payload.id)), eq(recipes.userId, userId)));
      }

      if (mutation.entity === "recipe-ingredient" && mutation.operation === "upsert") {
        await tx
          .insert(recipeIngredients)
          .values({
            id: mutation.payload.id,
            recipeId: mutation.payload.recipeId,
            userId,
            itemId: mutation.payload.itemId,
            quantity: mutation.payload.quantity ?? 1,
            unitLabel: mutation.payload.unitLabel ?? null,
            includeInCost: mutation.payload.includeInCost ?? true,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: recipeIngredients.id,
            set: {
              itemId: mutation.payload.itemId,
              quantity: mutation.payload.quantity ?? 1,
              unitLabel: mutation.payload.unitLabel ?? null,
              includeInCost: mutation.payload.includeInCost ?? true,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
      }

      if (mutation.entity === "recipe-ingredient" && mutation.operation === "delete") {
        await tx
          .delete(recipeIngredients)
          .where(
            and(
              eq(recipeIngredients.id, String(mutation.payload.id)),
              eq(recipeIngredients.userId, userId),
            ),
          );
      }

      if (mutation.entity === "meal-plan" && mutation.operation === "upsert") {
        await tx
          .insert(mealPlans)
          .values({
            id: mutation.payload.id,
            userId,
            plannedFor: mutation.payload.plannedFor,
            mealSlot: mutation.payload.mealSlot ?? "dinner",
            recipeId: mutation.payload.recipeId ?? null,
            notes: mutation.payload.notes ?? null,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: mealPlans.id,
            set: {
              plannedFor: mutation.payload.plannedFor,
              mealSlot: mutation.payload.mealSlot ?? "dinner",
              recipeId: mutation.payload.recipeId ?? null,
              notes: mutation.payload.notes ?? null,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
      }

      if (mutation.entity === "meal-plan" && mutation.operation === "delete") {
        await tx
          .delete(mealPlans)
          .where(
            and(eq(mealPlans.id, String(mutation.payload.id)), eq(mealPlans.userId, userId)),
          );
      }
    }
  });

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
  ]);

  const itemPlaceIdsByItemId = new Map<string, string[]>();
  for (const link of itemPlaceLinkRows) {
    const current = itemPlaceIdsByItemId.get(link.itemId) ?? [];
    current.push(link.placeId);
    itemPlaceIdsByItemId.set(link.itemId, current);
  }

  const payload = bootstrapResponseSchema.parse({
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
  });

  return NextResponse.json(payload);
}
