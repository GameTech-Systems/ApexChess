import { describe, expect, it } from "vitest";
import { prerender } from "./prerender";

describe("pre-rendered pages", () => {
  it("rules carry the full text, with no dead buttons", () => {
    const html = prerender("rules")!;
    expect(html).toContain("The Elbow Room");
    expect(html).toContain("Rules version:");
    expect(html).not.toContain("<button");
  });
  it("about links to the rules instead of a button", () => {
    const html = prerender("about")!;
    expect(html).toContain("About Apex Chess");
    expect(html).toContain('href="/rules/"');
    expect(html).not.toContain("<button");
  });
  it("other pages stay with the app", () => {
    expect(prerender("account")).toBeUndefined();
  });
});
