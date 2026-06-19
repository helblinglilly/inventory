import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { items, places, rooms } from "@/db/inventory-schema";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

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
    serverTime: Date.now(),
  });
}
