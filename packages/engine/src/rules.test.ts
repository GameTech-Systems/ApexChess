import { describe, expect, it } from "vitest";
import { catalog } from "./catalog";
import { resolveRuleset, type RulesCatalog } from "./rules";
import { parseSquare } from "./setup";

const withRuleset = (patch: (r: RulesCatalog["rulesets"][number]) => void): RulesCatalog => {
  const copy = structuredClone(catalog);
  patch(copy.rulesets[0]!);
  return copy;
};

function nullPaths(value: unknown, path = "ruleset"): string[] {
  if (value === null || value === undefined) return [path];
  if (typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => nullPaths(v, `${path}.${k}`));
}

describe("resolveRuleset", () => {
  it("resolves the standard ruleset with no null values", () => {
    const r = resolveRuleset(catalog, "standard");
    expect(nullPaths(r)).toEqual([]);
    expect(r.board.id).toBe("standard");
    expect(r.setup.default.id).toBe("default");
    expect(r.parameters).toEqual({ pawnFirstMove: "one", firstMoveCaptures: "allowed" });
  });

  it("refuses an undecided (null) parameter", () => {
    const c = withRuleset((r) => (r.parameters.pawnFirstMove = null));
    expect(() => resolveRuleset(c, "standard")).toThrow(/pawnFirstMove.*undecided/);
  });

  it("uses the registry default for a parameter the ruleset omits", () => {
    const c = withRuleset((r) => delete r.parameters.firstMoveCaptures);
    expect(resolveRuleset(c, "standard").parameters.firstMoveCaptures).toBe("allowed");
  });

  it("rejects unknown parameters, unknown options, and missing references", () => {
    expect(() =>
      resolveRuleset(
        withRuleset((r) => (r.parameters.castling = "yes")),
        "standard",
      ),
    ).toThrow(/castling/);
    expect(() =>
      resolveRuleset(
        withRuleset((r) => (r.parameters.pawnFirstMove = "three")),
        "standard",
      ),
    ).toThrow(/three/);
    expect(() =>
      resolveRuleset(
        withRuleset((r) => (r.board.version = "9.9.9")),
        "standard",
      ),
    ).toThrow(/board/);
    expect(() =>
      resolveRuleset(
        withRuleset((r) => (r.setup.default.id = "nope")),
        "standard",
      ),
    ).toThrow(/setup/);
    expect(() => resolveRuleset(catalog, "nope")).toThrow(/nope/);
  });

  it("rejects pieces without movement data and unknown movement conditions", () => {
    const army = withRuleset((r) => (r.army.dragon = 1));
    expect(() => resolveRuleset(army, "standard")).toThrow(/dragon/);
    const promo = structuredClone(catalog);
    promo.pieces[0]!.pieces.pawn!.promotesTo = ["dragon"];
    expect(() => resolveRuleset(promo, "standard")).toThrow(/dragon/);
    const when = structuredClone(catalog);
    when.pieces[0]!.pieces.pawn!.moves[1]!.when = { pawnFirstMove: "three" };
    expect(() => resolveRuleset(when, "standard")).toThrow(/three/);
    expect(() =>
      resolveRuleset(
        withRuleset((r) => (r.pieces.version = "9.9.9")),
        "standard",
      ),
    ).toThrow(/pieces/);
  });

  it("rejects a parameter registry whose default is not one of its options", () => {
    const c = structuredClone(catalog);
    c.parameters[0]!.default = "three";
    expect(() => resolveRuleset(c, "standard")).toThrow(/default/);
  });

  for (const p of catalog.parameters) {
    for (const o of p.options) {
      it(`resolves ${p.id} = ${o.value}${o.value === p.default ? " (default)" : ""}`, () => {
        const c = withRuleset((r) => (r.parameters[p.id] = o.value));
        expect(resolveRuleset(c, "standard").parameters[p.id]).toBe(o.value);
      });
    }
  }
});

describe("standard board data", () => {
  const { board } = resolveRuleset(catalog, "standard");
  for (const [side, s] of Object.entries(board.sides)) {
    it(`${side}: forward from the corner reaches the promotion square on the far edges`, () => {
      const c = parseSquare(board, s.corner);
      const far = {
        file: c.file + s.forward[0] * (board.files - 1),
        rank: c.rank + s.forward[1] * (board.ranks - 1),
      };
      const promo = parseSquare(board, s.promotionSquares[0]!);
      expect(promo).toEqual(far);
      for (const edge of s.farEdges) {
        if ("file" in edge) expect(edge.file.charCodeAt(0) - 97).toBe(promo.file);
        else expect(edge.rank - 1).toBe(promo.rank);
      }
    });
  }
});
