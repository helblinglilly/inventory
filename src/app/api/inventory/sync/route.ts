import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { items, places, rooms } from "@/db/inventory-schema";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { bootstrapResponseSchema } from "@/features/inventory/types";

const syncSchema = z.object({
  mutations: z.array(
    z.object({
      id: z.string(),
      entity: z.enum(["room", "place", "item"]),
      operation: z.enum(["upsert", "adjust-stock"]),
      payload: z.record(z.string(), z.any()),
      queuedAt: z.number(),
    }),
  ),
});

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

      if (mutation.entity === "item" && mutation.operation === "upsert") {
        await tx
          .insert(items)
          .values({
            id: mutation.payload.id,
            placeId: mutation.payload.placeId,
            userId,
            name: mutation.payload.name,
            notes: mutation.payload.notes ?? null,
            imageUrl: mutation.payload.imageUrl ?? null,
            imageProxyUrl: mutation.payload.imageProxyUrl ?? null,
            desiredStock: mutation.payload.desiredStock,
            actualStock: mutation.payload.actualStock,
            createdAt: new Date(mutation.payload.createdAt),
            updatedAt: new Date(mutation.payload.updatedAt),
          })
          .onConflictDoUpdate({
            target: items.id,
            set: {
              placeId: mutation.payload.placeId,
              name: mutation.payload.name,
              notes: mutation.payload.notes ?? null,
              imageUrl: mutation.payload.imageUrl ?? null,
              imageProxyUrl: mutation.payload.imageProxyUrl ?? null,
              desiredStock: mutation.payload.desiredStock,
              actualStock: mutation.payload.actualStock,
              updatedAt: new Date(mutation.payload.updatedAt),
            },
          });
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
    }
  });

  const [roomRows, placeRows, itemRows] = await Promise.all([
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
  ]);

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
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
    })),
    serverTime: Date.now(),
  });

  return NextResponse.json(payload);
}
