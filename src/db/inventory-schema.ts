import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "@/db/auth-schema";

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
    pricePaidPence: integer("price_paid_pence"),
    isStaple: integer("is_staple", { mode: "boolean" }).notNull().default(false),
    trackPriceHistory: integer("track_price_history", { mode: "boolean" })
      .notNull()
      .default(false),
    desiredStock: real("desired_stock").notNull().default(1),
    actualStock: real("actual_stock").notNull().default(0),
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

export const itemPlaceLinks = sqliteTable(
  "inventory_item_place_link",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("inventory_item_place_link_item_id_idx").on(table.itemId),
    index("inventory_item_place_link_place_id_idx").on(table.placeId),
    index("inventory_item_place_link_user_id_idx").on(table.userId),
  ],
);

export const shoppingLists = sqliteTable(
  "shopping_list",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    clearedAt: integer("cleared_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("shopping_list_user_id_idx").on(table.userId),
    index("shopping_list_status_idx").on(table.status),
  ],
);

export const shoppingListEntries = sqliteTable(
  "shopping_list_entry",
  {
    id: text("id").primaryKey(),
    listId: text("list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
    recipeId: text("recipe_id"),
    label: text("label").notNull(),
    sourceType: text("source_type").notNull().default("manual"),
    quantity: real("quantity").notNull().default(1),
    unitLabel: text("unit_label"),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("shopping_list_entry_list_id_idx").on(table.listId),
    index("shopping_list_entry_user_id_idx").on(table.userId),
    index("shopping_list_entry_item_id_idx").on(table.itemId),
  ],
);

export const recipes = sqliteTable(
  "recipe",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    notes: text("notes"),
    imageUrl: text("image_url"),
    imageProxyUrl: text("image_proxy_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("recipe_user_id_idx").on(table.userId),
    index("recipe_name_idx").on(table.name),
  ],
);

export const recipeIngredients = sqliteTable(
  "recipe_ingredient",
  {
    id: text("id").primaryKey(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    quantity: real("quantity").notNull().default(1),
    unitLabel: text("unit_label"),
    costPenceOverride: integer("cost_pence_override"),
    includeInCost: integer("include_in_cost", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("recipe_ingredient_recipe_id_idx").on(table.recipeId),
    index("recipe_ingredient_item_id_idx").on(table.itemId),
    index("recipe_ingredient_user_id_idx").on(table.userId),
  ],
);

export const mealPlans = sqliteTable(
  "meal_plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    plannedFor: text("planned_for").notNull(),
    mealSlot: text("meal_slot").notNull().default("dinner"),
    recipeId: text("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("meal_plan_user_id_idx").on(table.userId),
    index("meal_plan_planned_for_idx").on(table.plannedFor),
  ],
);

export const inventoryShares = sqliteTable(
  "inventory_share",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    memberUserId: text("member_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("inventory_share_owner_user_id_idx").on(table.ownerUserId),
    uniqueIndex("inventory_share_member_user_id_uidx").on(table.memberUserId),
    uniqueIndex("inventory_share_owner_member_uidx").on(table.ownerUserId, table.memberUserId),
  ],
);

export const inventoryInvites = sqliteTable(
  "inventory_invite",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("inventory_invite_owner_user_id_idx").on(table.ownerUserId),
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
  itemPlaceLinks: many(itemPlaceLinks),
}));

export const itemRelations = relations(items, ({ one, many }) => ({
  place: one(places, {
    fields: [items.placeId],
    references: [places.id],
  }),
  itemPlaceLinks: many(itemPlaceLinks),
}));

export const itemPlaceLinkRelations = relations(itemPlaceLinks, ({ one }) => ({
  item: one(items, {
    fields: [itemPlaceLinks.itemId],
    references: [items.id],
  }),
  place: one(places, {
    fields: [itemPlaceLinks.placeId],
    references: [places.id],
  }),
}));

export const shoppingListRelations = relations(shoppingLists, ({ many }) => ({
  entries: many(shoppingListEntries),
}));

export const shoppingListEntryRelations = relations(shoppingListEntries, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingListEntries.listId],
    references: [shoppingLists.id],
  }),
  item: one(items, {
    fields: [shoppingListEntries.itemId],
    references: [items.id],
  }),
}));

export const recipeRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
  mealPlans: many(mealPlans),
}));

export const recipeIngredientRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  item: one(items, {
    fields: [recipeIngredients.itemId],
    references: [items.id],
  }),
}));

export const mealPlanRelations = relations(mealPlans, ({ one }) => ({
  recipe: one(recipes, {
    fields: [mealPlans.recipeId],
    references: [recipes.id],
  }),
}));
