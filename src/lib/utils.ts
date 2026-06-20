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

export function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatCurrencyFromPence(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value / 100);
}

export function poundsToPence(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = Number(trimmed);

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error("Enter a valid GBP amount");
  }

  return Math.round(normalized * 100);
}

export function penceToPoundsInput(value: number | null | undefined) {
  if (value == null) {
    return "";
  }

  return (value / 100).toFixed(2);
}
