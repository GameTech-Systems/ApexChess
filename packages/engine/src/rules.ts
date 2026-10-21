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

export interface Movement {
  /** [file, rank] steps written for light; the board's mirror maps them for dark. */
  steps: [number, number][];
  /** Most squares per direction; undefined slides to the board edge. */
  range?: number;
  mode: "move" | "capture" | "both";
  /** Only when the piece is (true) or is not (false) on a far edge of its side. */
  onFarEdge?: boolean;
  /** Only while the piece has not moved. */
  firstMove?: boolean;
  /** Only when each listed parameter has this value. */
  when?: Record<string, string>;
}

export interface PieceRules {
  /** May never be left attacked; checkmating it wins. */
  royal?: boolean;
  /** Its moves reset the move-rule count, as captures do. */
  resetsMoveRule?: boolean;
  moves: Movement[];
  promotesTo?: string[];
}

export interface PieceSet extends Ref {
  status: Status;
  name: string;
  pieces: Record<string, PieceRules>;
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

/** Non-royal material left on the board, both sides together, that cannot mate. */
export type DeadMaterial = { pieces: string[] } | { sameColor: string };

export type DrawMode = "claim" | "auto";

export interface Draws {
  /** `claim`: repetition and the move rule must be claimed. `auto`: they end the game. */
  mode: DrawMode;
  /** The same position this many times, the start included. */
  repetitions: number;
  /** Moves by each side with no capture and no move by a `resetsMoveRule` piece. */
  moveRule: number;
  insufficientMaterial: DeadMaterial[];
}

export interface Ruleset extends Ref {
  status: Status;
  name: string;
  board: Ref;
  pieces: Ref;
  army: Record<string, number>;
  firstToMove: Side;
  setup: { default: Ref; constraints: SetupConstraints };
  /** Parameter id to option value; null means undecided. */
  parameters: Record<string, string | null>;
  draws: Draws;
  source: string;
  notes?: string;
}

export interface RulesCatalog {
  parameters: Parameter[];
  boards: Board[];
  pieces: PieceSet[];
  setups: Setup[];
  rulesets: Ruleset[];
}

export interface ResolvedRuleset {
  id: string;
  version: string;
  status: Status;
  name: string;
  board: Board;
  pieces: PieceSet;
  army: Record<string, number>;
  firstToMove: Side;
  setup: { default: Setup; constraints: SetupConstraints };
  parameters: Record<string, string>;
  draws: Draws;
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

  const pieces = find(catalog.pieces, ruleset.pieces, "pieces");
  const known = (piece: string, where: string) => {
    if (!pieces.pieces[piece]) throw new Error(`${where}: piece ${piece} has no movement data`);
  };
  for (const piece of Object.keys(ruleset.army)) known(piece, `ruleset ${id} army`);
  for (const dead of ruleset.draws.insufficientMaterial) {
    for (const piece of "pieces" in dead ? dead.pieces : [dead.sameColor])
      known(piece, `ruleset ${id} insufficient material`);
  }
  for (const [piece, rules] of Object.entries(pieces.pieces)) {
    for (const to of rules.promotesTo ?? []) known(to, `${piece} promotion`);
    for (const m of rules.moves) {
      for (const [key, value] of Object.entries(m.when ?? {})) {
        if (!registry.get(key)?.options.some((o) => o.value === value))
          throw new Error(`${piece} movement: unknown condition ${key} = ${value}`);
      }
    }
  }

  return {
    id: ruleset.id,
    version: ruleset.version,
    status: ruleset.status,
    name: ruleset.name,
    board: find(catalog.boards, ruleset.board, "board"),
    pieces,
    army: ruleset.army,
    firstToMove: ruleset.firstToMove,
    setup: {
      default: find(catalog.setups, ruleset.setup.default, "setup"),
      constraints: ruleset.setup.constraints,
    },
    parameters,
    draws: ruleset.draws,
  };
}
