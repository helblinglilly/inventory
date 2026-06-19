import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatRelativeStock(actualStock: number, desiredStock: number) {
  if (actualStock <= 0) {
    return "Out of stock";
  }

  if (actualStock < desiredStock) {
    return "Low stock";
  }

  return "Healthy";
}

export function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
