import type { Pieces } from "@apexchess/engine";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface SavedSetup {
  name: string;
  pieces: Pieces;
}

const KEY = "apexchess.setups.v1";

/** Arrangements saved on this device. Never throws: blocked or damaged storage reads as empty. */
export function loadSetups(store: KeyValueStore): SavedSetup[] {
  try {
    const data: unknown = JSON.parse(store.getItem(KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter(
      (x): x is SavedSetup =>
        typeof x?.name === "string" && typeof x?.pieces === "object" && x.pieces !== null,
    );
  } catch {
    return [];
  }
}

function write(store: KeyValueStore, list: SavedSetup[]): void {
  try {
    store.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the setup just isn't kept.
  }
}

/** Save under a name; the same name replaces the earlier one. A blank name saves nothing. */
export function saveSetup(store: KeyValueStore, name: string, pieces: Pieces): void {
  const clean = name.trim();
  if (!clean) return;
  write(store, [...loadSetups(store).filter((s) => s.name !== clean), { name: clean, pieces }]);
}

export function deleteSetup(store: KeyValueStore, name: string): void {
  write(
    store,
    loadSetups(store).filter((s) => s.name !== name),
  );
}
