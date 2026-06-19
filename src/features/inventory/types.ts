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
  userId: z.string(),
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageProxyUrl: z.string().nullable().optional(),
  desiredStock: z.number().int().nonnegative(),
  actualStock: z.number().int().nonnegative(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const mutationSchema = z.object({
  id: z.string(),
  entity: z.enum(["room", "place", "item"]),
  operation: z.enum(["upsert", "adjust-stock"]),
  payload: z.record(z.string(), z.any()),
  queuedAt: z.number(),
});

export const bootstrapResponseSchema = z.object({
  rooms: z.array(roomSchema),
  places: z.array(placeSchema),
  items: z.array(itemSchema),
  serverTime: z.number(),
});

export type RoomRecord = z.infer<typeof roomSchema>;
export type PlaceRecord = z.infer<typeof placeSchema>;
export type ItemRecord = z.infer<typeof itemSchema>;
export type SyncMutation = z.infer<typeof mutationSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
