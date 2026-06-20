import { z } from "zod";

export const roomSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const placeSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const itemSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  placeIds: z.array(z.string()).default([]),
  userId: z.string(),
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageProxyUrl: z.string().nullable().optional(),
  pricePaidPence: z.number().int().nonnegative().nullable().optional(),
  isStaple: z.boolean().default(false),
  trackPriceHistory: z.boolean().default(false),
  desiredStock: z.number().int().nonnegative(),
  actualStock: z.number().int().nonnegative(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const shoppingListSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  status: z.enum(["active", "archived"]).default("active"),
  clearedAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const shoppingListEntrySchema = z.object({
  id: z.string(),
  listId: z.string(),
  userId: z.string(),
  itemId: z.string().nullable().optional(),
  recipeId: z.string().nullable().optional(),
  label: z.string().min(1),
  sourceType: z.enum(["manual", "low-stock", "recipe"]).default("manual"),
  quantity: z.number().int().positive().default(1),
  unitLabel: z.string().nullable().optional(),
  checkedAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const recipeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageProxyUrl: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const recipeIngredientSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  userId: z.string(),
  itemId: z.string(),
  quantity: z.number().int().positive().default(1),
  unitLabel: z.string().nullable().optional(),
  includeInCost: z.boolean().default(true),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const mealPlanSchema = z.object({
  id: z.string(),
  userId: z.string(),
  plannedFor: z.string(),
  mealSlot: z.enum(["dinner"]).default("dinner"),
  recipeId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const mutationSchema = z.object({
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
});

export const bootstrapResponseSchema = z.object({
  rooms: z.array(roomSchema),
  places: z.array(placeSchema),
  items: z.array(itemSchema),
  shoppingLists: z.array(shoppingListSchema).default([]),
  shoppingListEntries: z.array(shoppingListEntrySchema).default([]),
  recipes: z.array(recipeSchema).default([]),
  recipeIngredients: z.array(recipeIngredientSchema).default([]),
  mealPlans: z.array(mealPlanSchema).default([]),
  serverTime: z.number(),
});

export type RoomRecord = z.infer<typeof roomSchema>;
export type PlaceRecord = z.infer<typeof placeSchema>;
export type ItemRecord = z.infer<typeof itemSchema>;
export type ShoppingListRecord = z.infer<typeof shoppingListSchema>;
export type ShoppingListEntryRecord = z.infer<typeof shoppingListEntrySchema>;
export type RecipeRecord = z.infer<typeof recipeSchema>;
export type RecipeIngredientRecord = z.infer<typeof recipeIngredientSchema>;
export type MealPlanRecord = z.infer<typeof mealPlanSchema>;
export type SyncMutation = z.infer<typeof mutationSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
