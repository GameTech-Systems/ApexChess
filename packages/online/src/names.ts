/**
 * Handles (S19c, docs/decisions/0006) and event display names (0007) share one policy. Claude's
 * policy (provisional): 3 to 20 ASCII letters, digits, _ and -, starting with a letter. ASCII only,
 * so a look-alike letter from another script cannot pass for someone else. Two names are the same
 * when they differ only in case, _ or -. Some names are reserved, and so is anything that uses the
 * site's name or a staff word.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
/** Event names follow the handle policy. */
export const NAME_MIN = HANDLE_MIN;
export const NAME_MAX = HANDLE_MAX;

const ALLOWED = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Names that could pass for the site, its staff, a pairing word, or a missing account. */
const RESERVED = new Set([
  "admin",
  "administrator",
  "anonymous",
  "apex",
  "bye",
  "deleted",
  "guest",
  "host",
  "mod",
  "moderator",
  "null",
  "official",
  "owner",
  "root",
  "staff",
  "support",
  "system",
  "undefined",
]);
/** Reserved anywhere inside a name. */
const RESERVED_PARTS = ["apexchess", "admin", "moderator"];

/** The form two handles are compared in: lower case, without _ or -. */
export const handleKey = (handle: string) => handle.toLowerCase().replace(/[_-]/g, "");
export const nameKey = handleKey;

export function checkHandle(text: string): { handle: string } | { error: string } {
  const handle = text.trim();
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX)
    return { error: `A name needs ${HANDLE_MIN} to ${HANDLE_MAX} characters.` };
  if (!ALLOWED.test(handle))
    return { error: "Use letters A to Z, digits, _ and - only, starting with a letter." };
  const key = handleKey(handle);
  if (RESERVED.has(key) || RESERVED_PARTS.some((part) => key.includes(part)))
    return { error: "That name is reserved. Pick another." };
  return { handle };
}

/** An event display name: the handle policy, under the name the event code uses. */
export function checkName(text: string): { name: string } | { error: string } {
  const r = checkHandle(text);
  return "handle" in r ? { name: r.handle } : r;
}
