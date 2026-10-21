/** Pure game logic. No DOM, no I/O. Rules and setups come from `rules/`, never hardcoded. */
export const ENGINE_VERSION = "0.0.0";

export * from "./rules";
export * from "./setup";
export { catalog } from "./catalog";
export * from "./moves";
export * from "./game";
export * from "./record";
export * from "./setupcode";
export * from "./ai";
