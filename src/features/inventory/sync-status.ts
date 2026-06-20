"use client";

export type SyncStatus = {
  active: boolean;
  total: number;
};

let status: SyncStatus = {
  active: false,
  total: 0,
};

const listeners = new Set<() => void>();

export function getSyncStatusSnapshot() {
  return status;
}

export function subscribeToSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSyncStatus(nextStatus: SyncStatus) {
  status = nextStatus;
  listeners.forEach((listener) => listener());
}
