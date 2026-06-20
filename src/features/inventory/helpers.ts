import type {
  ItemRecord,
  MealPlanRecord,
  PlaceRecord,
  RecipeIngredientRecord,
  RecipeRecord,
  RoomRecord,
  ShoppingListEntryRecord,
  ShoppingListRecord,
  SyncMutation,
} from "@/features/inventory/types";

export const ROOM_LEVEL_PLACE_NAME = "Room-level items";
export const UNCATEGORIZED_ROOM_NAME = "Uncategorised";
export const UNCATEGORIZED_PLACE_NAME = "Needs assigning";

export function buildMutation(
  entity: SyncMutation["entity"],
  operation: SyncMutation["operation"],
  payload: SyncMutation["payload"],
  queuedAt: number,
): SyncMutation {
  return {
    id: crypto.randomUUID(),
    entity,
    operation,
    payload,
    queuedAt,
  };
}

export function getTimestamp() {
  return Date.now();
}

export function getId() {
  return crypto.randomUUID();
}

export function getPlaceById(places: PlaceRecord[], placeId: string) {
  return places.find((place) => place.id === placeId) ?? null;
}

export function getRoomById(rooms: RoomRecord[], roomId: string) {
  return rooms.find((room) => room.id === roomId) ?? null;
}

export function getLocationLabel(
  item: ItemRecord,
  places: PlaceRecord[],
  rooms: RoomRecord[],
) {
  const place = getPlaceById(places, item.placeId);
  const room = place ? getRoomById(rooms, place.roomId) : null;

  if (room && place) {
    if (place.name === ROOM_LEVEL_PLACE_NAME) {
      return room.name;
    }

    if (room.name === UNCATEGORIZED_ROOM_NAME && place.name === UNCATEGORIZED_PLACE_NAME) {
      return UNCATEGORIZED_ROOM_NAME;
    }

    return `${room.name} / ${place.name}`;
  }

  if (place) {
    return place.name;
  }

  return "Unknown location";
}

export function sortLowStockItems(items: ItemRecord[]) {
  return [...items].sort((left, right) => {
    if (left.actualStock === 0 && right.actualStock !== 0) {
      return -1;
    }

    if (left.actualStock !== 0 && right.actualStock === 0) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getActiveShoppingList(shoppingLists: ShoppingListRecord[]) {
  return shoppingLists.find((list) => list.status === "active") ?? null;
}

export function getRecipeCostPence(
  recipe: RecipeRecord,
  recipeIngredients: RecipeIngredientRecord[],
  items: ItemRecord[],
) {
  return recipeIngredients
    .filter((ingredient) => ingredient.recipeId === recipe.id && ingredient.includeInCost)
    .reduce((total, ingredient) => {
      const item = items.find((entry) => entry.id === ingredient.itemId);
      if (!item?.pricePaidPence) {
        return total;
      }

      return total + item.pricePaidPence * ingredient.quantity;
    }, 0);
}

export function getDinnerPlanForDate(mealPlans: MealPlanRecord[], plannedFor: string) {
  return (
    mealPlans.find(
      (mealPlan) => mealPlan.plannedFor === plannedFor && mealPlan.mealSlot === "dinner",
    ) ?? null
  );
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthGrid(monthAnchor: Date) {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

export function getShoppingListCarryOverEntries(
  entries: ShoppingListEntryRecord[],
  activeListId: string,
  items: ItemRecord[],
) {
  return entries.filter((entry) => {
    if (entry.listId !== activeListId || entry.checkedAt) {
      return false;
    }

    if (!entry.itemId) {
      return true;
    }

    const item = items.find((candidate) => candidate.id === entry.itemId);
    return item ? item.actualStock < item.desiredStock : true;
  });
}
