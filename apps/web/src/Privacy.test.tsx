import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Privacy } from "./Privacy";

describe("Privacy screen", () => {
  it("states what is stored and what is not collected", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Privacy");
    expect(html).toContain("this browser");
    expect(html).toContain("No accounts");
    expect(html).toContain("Close");
    expect(html).toContain("Online games");
    expect(html).toContain("7 days");
  });

  it("describes the anonymous game archive and rate limiting", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Game archive");
    expect(html).toContain("the day it ended");
    expect(html).toContain("no clock times, room code, ticket, IP address, or time of day");
    expect(html).toContain("the time control");
    expect(html).toContain("time left");
    expect(html).toContain("Games that ended before");
    expect(html).toContain("not stored");
  });
});
