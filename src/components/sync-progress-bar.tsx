"use client";

import { useSyncExternalStore } from "react";
import {
  getSyncStatusSnapshot,
  subscribeToSyncStatus,
} from "@/features/inventory/sync-status";

export function SyncProgressBar() {
  const syncStatus = useSyncExternalStore(
    subscribeToSyncStatus,
    getSyncStatusSnapshot,
    getSyncStatusSnapshot,
  );

  if (!syncStatus.active) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        <span>Syncing changes</span>
        <span>{syncStatus.total} queued</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/8">
        <div className="sync-progress-bar h-full w-1/3 rounded-full bg-[color:var(--color-forest)]" />
      </div>
    </div>
  );
}
