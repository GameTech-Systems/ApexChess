import { useState } from "react";
import { catalog, resolveRuleset, startPosition, type Side } from "@apexchess/engine";
import { Board } from "./Board";
import "./board.css";

const ruleset = resolveRuleset(catalog, "standard");
const setup = ruleset.setup.default.pieces;
const position = startPosition(ruleset, setup, setup);

export function App() {
  const [view, setView] = useState<Side>("light");
  return (
    <main>
      <Board board={ruleset.board} position={position} view={view} pieceSet={ruleset.pieces} />
      <button type="button" onClick={() => setView(view === "light" ? "dark" : "light")}>
        View from {view === "light" ? "dark" : "light"} seat
      </button>
    </main>
  );
}
