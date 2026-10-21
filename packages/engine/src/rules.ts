/** Rules data types and the resolver. Data comes from `rules/`; the engine never hardcodes it. */

export type Side = "light" | "dark";
export type Status = "draft" | "official" | "retired";

export interface Ref {
  id: string;
  version: string;
}

export interface Parameter {
  id: string;
  name: string;
  description: string;
  default: string;
  options: { value: string; label: string }[];
  status: "decided" | "provisional";
  decision?: string;
  affects: string[];
  source: string;
  notes?: string;
}

export interface BoardSide {
  corner: string;
  forward: [number, number];
  farEdges: ({ file: string } | { rank: number })[];
  promotionSquares: string[];
  mirror: "identity" | "rotate180";
}

export interface Board extends Ref {
  status: Status;
  name: string;
  files: number;
  ranks: number;
  sides: Record<Side, BoardSide>;
  source: string;
  notes?: string;
}

export interface Setup extends Ref {
  status: Status;
  name: string;
  /** Square to piece id, written for light. */
  pieces: Record<string, string>;
  source: string;
  notes?: string;
}

export interface SetupConstraints {
  cornerPiece: string;
  frontChord: number;
  beyondFrontChord: { chords: number[]; maxPieces: number };
}

export interface Ruleset extends Ref {
  status: Status;
  name: string;
  board: Ref;
  army: Record<string, number>;
  firstToMove: Side;
  setup: { default: Ref; constraints: SetupConstraints };
  /** Parameter id to option value; null means undecided. */
  parameters: Record<string, string | null>;
  source: string;
  notes?: string;
}

export interface RulesCatalog {
  parameters: Parameter[];
  boards: Board[];
  setups: Setup[];
  rulesets: Ruleset[];
}

export interface ResolvedRuleset {
  id: string;
  version: string;
  status: Status;
  name: string;
  board: Board;
  army: Record<string, number>;
  firstToMove: Side;
  setup: { default: Setup; constraints: SetupConstraints };
  parameters: Record<string, string>;
}

function find<T extends Ref>(list: T[], ref: Ref, what: string): T {
  const hit = list.find((x) => x.id === ref.id && x.version === ref.version);
  if (!hit) throw new Error(`${what} ${ref.id}@${ref.version} not found`);
  return hit;
}

/** Resolve a ruleset's references and parameters. Throws on anything missing, unknown, or undecided. */
export function resolveRuleset(
  catalog: RulesCatalog,
  id: string,
  version?: string,
): ResolvedRuleset {
  const candidates = catalog.rulesets.filter(
    (r) => r.id === id && (version === undefined || r.version === version),
  );
  const ruleset = candidates.at(-1);
  if (!ruleset) throw new Error(`ruleset ${id}${version ? "@" + version : ""} not found`);

  const registry = new Map(catalog.parameters.map((p) => [p.id, p]));
  for (const p of catalog.parameters) {
    if (!p.options.some((o) => o.value === p.default)) {
      throw new Error(`parameter ${p.id}: default "${p.default}" is not one of its options`);
    }
  }
  for (const key of Object.keys(ruleset.parameters)) {
    if (!registry.has(key)) throw new Error(`ruleset ${id}: unknown parameter ${key}`);
  }
  const parameters: Record<string, string> = {};
  for (const p of catalog.parameters) {
    const value = p.id in ruleset.parameters ? ruleset.parameters[p.id] : p.default;
    if (value === null || value === undefined)
      throw new Error(`ruleset ${id}: parameter ${p.id} is undecided`);
    if (!p.options.some((o) => o.value === value)) {
      throw new Error(`ruleset ${id}: parameter ${p.id} has no option "${value}"`);
    }
    parameters[p.id] = value;
  }

  return {
    id: ruleset.id,
    version: ruleset.version,
    status: ruleset.status,
    name: ruleset.name,
    board: find(catalog.boards, ruleset.board, "board"),
    army: ruleset.army,
    firstToMove: ruleset.firstToMove,
    setup: {
      default: find(catalog.setups, ruleset.setup.default, "setup"),
      constraints: ruleset.setup.constraints,
    },
    parameters,
  };
}
