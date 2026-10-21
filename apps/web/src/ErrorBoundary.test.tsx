import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorFallback } from "./ErrorBoundary";

describe("ErrorFallback", () => {
  it("shows a message and a reload button, never a blank screen", () => {
    const html = renderToStaticMarkup(<ErrorFallback />);
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Reload");
  });
});
