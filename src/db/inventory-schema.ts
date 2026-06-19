import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable(
  "inventory_room",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("inventory_room_user_id_idx").on(table.userId),
    index("inventory_room_sort_order_idx").on(table.sortOrder),
  ],
);

export const places = sqliteTable(
  "inventory_place",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("inventory_place_room_id_idx").on(table.roomId),
    index("inventory_place_user_id_idx").on(table.userId),
  ],
);

export const items = sqliteTable(
  "inventory_item",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
    imageUrl: text("image_url"),
    imageProxyUrl: text("image_proxy_url"),
    desiredStock: integer("desired_stock").notNull().default(1),
    actualStock: integer("actual_stock").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("inventory_item_place_id_idx").on(table.placeId),
    index("inventory_item_user_id_idx").on(table.userId),
    index("inventory_item_name_idx").on(table.name),
  ],
);

export const roomRelations = relations(rooms, ({ many }) => ({
  places: many(places),
}));

export const placeRelations = relations(places, ({ one, many }) => ({
  room: one(rooms, {
    fields: [places.roomId],
    references: [rooms.id],
  }),
  items: many(items),
}));

export const itemRelations = relations(items, ({ one }) => ({
  place: one(places, {
    fields: [items.placeId],
    references: [places.id],
  }),
}));
