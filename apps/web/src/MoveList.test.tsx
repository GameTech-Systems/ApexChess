import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoveList, movePairs } from "./MoveList";

describe("move list", () => {
  it("pairs moves into numbered turns", () => {
    expect(
      movePairs(["e2-d3", "a3-c4", "d1-e2"]).map((p) => [p.n, p.plies.map((x) => x.text)]),
    ).toEqual([
      [1, ["e2-d3", "a3-c4"]],
      [2, ["d1-e2", undefined]],
    ]);
  });
  it("leaves light's cell empty when dark moved first", () => {
    const [first] = movePairs(["a3-c4"], "dark");
    expect(first!.plies[0]!.text).toBeUndefined();
    expect(first!.plies[1]).toEqual({ text: "a3-c4", index: 0 });
  });
  it("renders one row per turn with its number, not one list marker per move", () => {
    const html = renderToStaticMarkup(<MoveList moves={["e2-d3", "a3-c4", "d1-e2"]} />);
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain('<span class="move-no">2.</span>');
  });
  it("marks the move on the board when selectable", () => {
    const html = renderToStaticMarkup(
      <MoveList moves={["e2-d3", "a3-c4"]} current={2} onSelect={() => undefined} />,
    );
    expect(html).toContain('aria-current="step"');
    expect(html.match(/<button/g)).toHaveLength(2);
  });
  it("says so when there are no moves", () => {
    expect(renderToStaticMarkup(<MoveList moves={[]} />)).toContain("No moves yet.");
  });
});
