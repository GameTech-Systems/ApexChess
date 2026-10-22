/**
 * Event display names (0007): a name exists only inside its event. Claude's policy (provisional,
 * until the S19c handle policy): 2 to 20 letters, digits, spaces, and - _ . ', starting with a
 * letter or digit; some names are reserved; names in one event differ by more than case, spaces, or
 * punctuation.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 20;

const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} _.'-]*$/u;

/** Names that could pass for the site, its staff, or a pairing word. */
const RESERVED = new Set([
  "admin",
  "administrator",
  "anonymous",
  "apex",
  "apexchess",
  "bye",
  "host",
  "moderator",
  "official",
  "owner",
  "staff",
  "support",
  "system",
]);

/** The form two names are compared in: lower case, letters and digits only. */
export const nameKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, "");

export function checkName(text: string): { name: string } | { error: string } {
  const name = text.trim().replace(/ +/g, " ");
  const length = [...name].length;
  if (length < NAME_MIN || length > NAME_MAX)
    return { error: `A name needs ${NAME_MIN} to ${NAME_MAX} characters.` };
  if (!ALLOWED.test(name))
    return {
      error: "Use letters, digits, spaces, and - _ . ' only, starting with a letter or digit.",
    };
  if (RESERVED.has(nameKey(name))) return { error: "That name is reserved. Pick another." };
  return { name };
}
