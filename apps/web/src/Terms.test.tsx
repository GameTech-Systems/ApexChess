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
  it("names the trademarks and limits liability", () => {
    const html = renderToStaticMarkup(<Terms onClose={() => undefined} />);
    expect(html).toContain("Apex Chess™");
    expect(html).toContain("not affiliated");
    expect(html).toContain("not liable");
  });
  it("names Chess Nines as the one related site that may be linked", () => {
    const html = renderToStaticMarkup(<Terms onClose={() => undefined} />);
    expect(html).toContain("Chess Nines (Chess9s.com)");
    expect(html).toContain("not affiliated with any chess federation");
  });
});
