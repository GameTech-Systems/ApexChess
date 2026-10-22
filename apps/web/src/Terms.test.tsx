import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HANDLE_MAX, HANDLE_MIN, MIN_AGE } from "@apexchess/online";
import { Terms } from "./Terms";

describe("Terms screen", () => {
  it("states the minimum age, the handle rules, reports, deletion, and Close", () => {
    const html = renderToStaticMarkup(<Terms onClose={() => undefined} />);
    expect(html).toContain("Terms");
    expect(html).toContain(`${MIN_AGE} or older`);
    expect(html).toContain(`${HANDLE_MIN} to ${HANDLE_MAX}`);
    expect(html).toContain("Report a handle");
    expect(html).toContain("Delete account");
    expect(html).toContain("optional");
    expect(html).toContain("Close");
  });
});
