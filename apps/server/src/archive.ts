/** Writing archive rows to D1. The row itself is built by the pure archiveRow in @apexchess/online. */
import type { ArchiveRow } from "@apexchess/online";

/** An insert for one row under a random id (so row ids say nothing about who or when). */
export function insertGame(row: ArchiveRow, id: string) {
  const columns = ["id", ...Object.keys(row)];
  return {
    sql: `INSERT INTO games (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    values: [id, ...Object.values(row)],
  };
}
