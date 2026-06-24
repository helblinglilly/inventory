"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { applyItemLocally, enqueueMutation } from "@/features/inventory/sync";
import { buildMutation, getId, getTimestamp } from "@/features/inventory/helpers";
import { useInventoryData } from "@/features/inventory/use-inventory-data";
import type { ItemRecord, PlaceRecord, RoomRecord } from "@/features/inventory/types";
import { poundsToPence } from "@/lib/utils";

type AddItemPageProps = {
  userId: string;
};

export function AddItemPage({ userId }: AddItemPageProps) {
  const { rooms, places, isBootstrapping, syncNow } = useInventoryData();
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [itemDraft, setItemDraft] = useState({
    name: "",
    desiredStock: 1,
    actualStock: 0,
    notes: "",
    pricePaid: "",
    isStaple: false,
    trackPriceHistory: true,
  });
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<string | null>(null);

  const availablePlaces = places.filter((place) => place.roomId === selectedRoomId);

  async function addItem() {
    if (!itemDraft.name.trim() || !selectedPlaceId) {
      return;
    }

    setUploadState("Preparing item...");
    let uploadPayload: { imageUrl?: string; imageProxyUrl?: string } = {};

    if (itemImage) {
      setUploadState("Uploading image...");
      const formData = new FormData();
      formData.append("file", itemImage);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setUploadState("Image upload failed");
        return;
      }

      uploadPayload = (await response.json()) as {
        imageUrl?: string;
        imageProxyUrl?: string;
      };
    }

    const timestamp = getTimestamp();
    const item: ItemRecord = {
      id: getId(),
      placeId: selectedPlaceId,
      placeIds: [selectedPlaceId],
      userId,
      name: itemDraft.name.trim(),
      notes: itemDraft.notes.trim() || undefined,
      imageUrl: uploadPayload.imageUrl,
      imageProxyUrl: uploadPayload.imageProxyUrl,
      pricePaidPence: poundsToPence(itemDraft.pricePaid),
      isStaple: itemDraft.isStaple,
      trackPriceHistory: itemDraft.trackPriceHistory,
      desiredStock: Number(itemDraft.desiredStock),
      actualStock: Number(itemDraft.actualStock),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await applyItemLocally(item);
    await enqueueMutation(buildMutation("item", "upsert", item, timestamp));
    setItemDraft({
      name: "",
      desiredStock: 1,
      actualStock: 0,
      notes: "",
      pricePaid: "",
      isStaple: false,
      trackPriceHistory: true,
    });
    setItemImage(null);
    setUploadState(null);

    await syncNow();
  }

  if (isBootstrapping) {
    return <Loading label="Loading add page..." />;
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-[2rem] border border-black/5 bg-white/85 p-5 shadow-[0_24px_70px_-48px_rgba(22,38,32,0.7)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">Add</p>
        <h2 className="mt-1 text-2xl font-semibold text-[color:var(--color-ink)]">Add new item</h2>

        <div className="mt-5 space-y-5">
          <Field label="Room">
            <CardSelector
              items={rooms}
              selectedId={selectedRoomId}
              emptyLabel="No rooms yet. Add one first."
              onSelect={(roomId) => {
                setSelectedRoomId(roomId);
                setSelectedPlaceId("");
              }}
            />
          </Field>

          <Field label="Place">
            <CardSelector
              items={availablePlaces}
              selectedId={selectedPlaceId}
              emptyLabel={
                selectedRoomId ? "This room has no places yet." : "Pick a room to see its places."
              }
              onSelect={setSelectedPlaceId}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Item name">
              <input
                value={itemDraft.name}
                onChange={(event) =>
                  setItemDraft((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
            </Field>

            <Field label="Paid (GBP)">
              <input
                value={itemDraft.pricePaid}
                onChange={(event) =>
                  setItemDraft((current) => ({ ...current, pricePaid: event.target.value }))
                }
                placeholder="2.75"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
            </Field>

            <Field label="Desired stock">
              <input
                type="number"
                min={0}
                value={itemDraft.desiredStock}
                onChange={(event) =>
                  setItemDraft((current) => ({
                    ...current,
                    desiredStock: Number(event.target.value),
                  }))
                }
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
            </Field>

            <Field label="Actual stock">
              <input
                type="number"
                min={0}
                value={itemDraft.actualStock}
                onChange={(event) =>
                  setItemDraft((current) => ({
                    ...current,
                    actualStock: Number(event.target.value),
                  }))
                }
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ToggleCard
              title="Kitchen staple"
              description="Tick if this item should not be pulled into the shopping list via the Meal Planner, but only when stock levels are low."
              checked={itemDraft.isStaple}
              onChange={(checked) => setItemDraft((current) => ({ ...current, isStaple: checked }))}
            />
          </div>
        </div>

        <Field label="Notes">
          <textarea
            value={itemDraft.notes}
            onChange={(event) =>
              setItemDraft((current) => ({ ...current, notes: event.target.value }))
            }
            rows={5}
            className="mt-4 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-forest)]"
          />
        </Field>

        <Field label="Optional image">
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-4 text-sm text-[color:var(--color-ink-soft)] transition hover:border-[color:var(--color-forest)]">
            <Upload className="size-4 text-[color:var(--color-forest)]" />
            <span className="truncate">
              {itemImage ? itemImage.name : "Choose a product photo"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setItemImage(event.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        {uploadState ? (
          <p className="mt-4 rounded-2xl bg-[color:var(--color-panel-muted)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
            {uploadState}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void addItem()}
          className="mt-5 w-full rounded-2xl bg-[color:var(--color-clay)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a63c22]"
        >
          Save item
        </button>
      </div>
    </section>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={[
        "rounded-[1.5rem] border px-4 py-4 text-left transition",
        checked
          ? "border-[color:var(--color-forest)] bg-[color:var(--color-panel-muted)] shadow-[0_16px_40px_-32px_rgba(22,38,32,0.65)]"
          : "border-black/10 bg-white hover:border-[color:var(--color-forest)]/40 hover:bg-[color:var(--color-panel-muted)]/55",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-[color:var(--color-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{description}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {checked ? "On" : "Off"}
      </p>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 text-sm font-medium text-[color:var(--color-ink)] shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

function CardSelector({
  items,
  selectedId,
  emptyLabel,
  onSelect,
}: {
  items: Array<RoomRecord | PlaceRecord>;
  selectedId: string;
  emptyLabel: string;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[color:var(--color-panel-muted)] px-4 py-4 text-sm text-[color:var(--color-ink-soft)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={isSelected}
            className={[
              "rounded-[1.5rem] border px-4 py-4 text-left transition",
              isSelected
                ? "border-[color:var(--color-forest)] bg-[color:var(--color-panel-muted)] shadow-[0_16px_40px_-32px_rgba(22,38,32,0.65)]"
                : "border-black/10 bg-white hover:border-[color:var(--color-forest)]/40 hover:bg-[color:var(--color-panel-muted)]/55",
            ].join(" ")}
          >
            <p className="text-sm font-semibold text-[color:var(--color-ink)]">{item.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              {isSelected ? "Selected" : "Tap to select"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
