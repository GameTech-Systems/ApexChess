import { describe, expect, it, vi } from "vitest";
import {
  addMove,
  catalog,
  legalMoves,
  newRecord,
  replay,
  resolveRuleset,
  toPgn,
  type GameRecord,
} from "@apexchess/engine";
import {
  PGN_MAX_CHARS,
  downloadPgn,
  gameLink,
  importPgn,
  openPgnFile,
  parseShare,
  setupLink,
} from "./share";

const ruleset = resolveRuleset(catalog, "standard");
const d = ruleset.setup.default.pieces;

function played(n: number): GameRecord {
  let rec = newRecord(ruleset, d, d);
  for (let i = 0; i < n; i++)
    rec = addMove(ruleset, rec, legalMoves(ruleset, replay(ruleset, rec).position)[0]!);
  return rec;
}

describe("share links", () => {
  it("round-trips a setup through the link fragment", () => {
    const link = setupLink(ruleset, d);
    expect(link.startsWith("#setup=")).toBe(true);
    expect(parseShare(ruleset, link)).toEqual({ kind: "setup", pieces: d });
  });
  it("round-trips a game: ruleset, both setups, moves", () => {
    const rec = played(6);
    const link = gameLink(ruleset, rec);
    const got = parseShare(ruleset, link);
    expect(got).toEqual({ kind: "game", record: rec, ruleset });
    expect(rec.moves).toHaveLength(6);
  });
  it("still opens a game recorded under a retired ruleset version, with that version's rules", () => {
    const old = resolveRuleset(catalog, "standard", "0.1.0");
    expect(old.status).toBe("retired");
    let rec = newRecord(old, d, d);
    for (let i = 0; i < 4; i++)
      rec = addMove(old, rec, legalMoves(old, replay(old, rec).position)[0]!);
    const got = parseShare(ruleset, gameLink(old, rec));
    expect(got).toEqual({ kind: "game", record: rec, ruleset: old });
  });
  it("carries no names, tokens, or room codes", () => {
    expect(gameLink(ruleset, played(2))).toMatch(/^#game=[A-Za-z0-9_.~-]+$/);
  });
  it("rejects junk, wrong ruleset versions, and illegal moves", () => {
    expect(parseShare(ruleset, "")).toBeUndefined();
    expect(parseShare(ruleset, "#setup=nonsense")).toBeUndefined();
    expect(parseShare(ruleset, "#game=%%%")).toBeUndefined();
    const rec = played(2);
    const other = { ...rec, ruleset: { id: rec.ruleset.id, version: "0.0.0-x" } };
    expect(parseShare(ruleset, gameLink(ruleset, other))).toBeUndefined();
    const bad = { ...rec, moves: ["a1-a8"] };
    expect(parseShare(ruleset, gameLink(ruleset, bad))).toBeUndefined();
  });
});

describe("importPgn", () => {
  it("opens an exported game at the same record and ruleset", () => {
    const rec = played(6);
    expect(importPgn(toPgn(ruleset, rec))).toEqual({
      ok: true,
      shared: { kind: "game", record: rec, ruleset },
    });
  });
  it("opens a game from a retired ruleset version", () => {
    const old = resolveRuleset(catalog, "standard", "0.1.0");
    let rec = newRecord(old, d, d);
    for (let i = 0; i < 3; i++)
      rec = addMove(old, rec, legalMoves(old, replay(old, rec).position)[0]!);
    const got = importPgn(toPgn(old, rec));
    expect(got).toMatchObject({ ok: true, shared: { kind: "game", record: rec } });
  });
  it("gives a plain reason for junk, a missing tag, an unknown version, and an illegal move", () => {
    const pgn = toPgn(ruleset, played(2));
    const bad = (text: string) => {
      const got = importPgn(text);
      expect(got.ok).toBe(false);
      return got.ok ? "" : got.error;
    };
    expect(bad("hello")).toMatch(/Apex Chess/);
    expect(bad("")).toMatch(/empty|Paste|choose/i);
    expect(bad(pgn.replace(/^\[DarkSetup.*\n/m, ""))).toMatch(/DarkSetup/);
    expect(bad(pgn.replace(/standard \S+"/, 'standard 9.9.9"'))).toMatch(/version|ruleset/i);
    const move = played(2).moves[0]!;
    expect(bad(pgn.replace(move, "a1-a8"))).toMatch(/illegal|move/i);
  });
  it("refuses text over the size cap before parsing it", () => {
    const got = importPgn("x".repeat(PGN_MAX_CHARS + 1));
    expect(got).toEqual({ ok: false, error: expect.stringMatching(/too large/i) });
  });
});

describe("openPgnFile", () => {
  it("reads a chosen file's text", async () => {
    const text = toPgn(ruleset, played(3));
    const got = await openPgnFile({ size: text.length, text: async () => text });
    expect(got).toMatchObject({ ok: true, shared: { kind: "game" } });
  });
  it("refuses an oversize file without reading it", async () => {
    const read = vi.fn(async () => "");
    const got = await openPgnFile({ size: PGN_MAX_CHARS * 4 + 1, text: read });
    expect(got).toMatchObject({ ok: false, error: expect.stringMatching(/too large/i) });
    expect(read).not.toHaveBeenCalled();
  });
  it("reports a file the browser cannot read", async () => {
    const got = await openPgnFile({
      size: 10,
      text: async () => {
        throw new Error("denied");
      },
    });
    expect(got).toMatchObject({ ok: false, error: expect.stringMatching(/could not be read/i) });
  });
});

describe("downloadPgn", () => {
  it("saves the game as a .pgn file", async () => {
    let blob: Blob | undefined;
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => link });
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => ((blob = b as Blob), "blob:x"));
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    downloadPgn(ruleset, played(2));
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.download).toBe("apex-chess-game.pgn");
    expect(await blob!.text()).toContain('[Variant "Apex Chess"]');
    vi.unstubAllGlobals();
  });

  it("revokes the object URL only after the click has been handled", () => {
    vi.useFakeTimers();
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => link });
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:x");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    downloadPgn(ruleset, played(2));
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:x");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
