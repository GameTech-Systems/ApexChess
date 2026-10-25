import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HANDLE_MAX, HANDLE_MIN, MIN_AGE, REPORT_REASONS } from "@apexchess/online";
import { Account, AccountScreen, CodesScreen, SignedOutScreen } from "./Account";

const noop = () => undefined;

describe("Account screens", () => {
  it("signed out: sign up with a handle, age and Terms, sign in, or use a recovery code", () => {
    const html = renderToStaticMarkup(
      <SignedOutScreen
        busy={false}
        onSignUp={noop}
        onSignIn={noop}
        onRecover={noop}
        onTerms={noop}
      />,
    );
    expect(html).toContain("Create an account");
    expect(html).toContain("Handle");
    expect(html).toContain(`I am ${MIN_AGE} or older`);
    expect(html).toContain("I accept the Terms");
    expect(html).toContain("Sign in with a passkey");
    expect(html).toContain("recovery code");
    expect(html).toContain("No email");
    expect(html).toContain("optional");
  });

  it("puts Back next to the title and groups the forms", () => {
    const store = { getItem: () => null, setItem: noop };
    const html = renderToStaticMarkup(<Account store={store} onClose={noop} onTerms={noop} />);
    expect(html).toMatch(/<h1>Account<\/h1><button[^>]*>Back<\/button>/);
    expect(html.match(/>Back</g)).toHaveLength(1);
    expect(html.match(/class="form-group"/g)).toHaveLength(4);
    expect(html).not.toContain('class="controls"');
  });

  it("says what a handle may contain", () => {
    const html = renderToStaticMarkup(
      <SignedOutScreen
        busy={false}
        onSignUp={noop}
        onSignIn={noop}
        onRecover={noop}
        onTerms={noop}
      />,
    );
    expect(html).toContain(`${HANDLE_MIN} to ${HANDLE_MAX}`);
  });

  it("shows new recovery codes once, with a warning", () => {
    const html = renderToStaticMarkup(
      <CodesScreen codes={["AAAA-BBBB-CCCC-DDDD", "EEEE-FFFF-GGGG-HHHH"]} onDone={noop} />,
    );
    expect(html).toContain("AAAA-BBBB-CCCC-DDDD");
    expect(html).toContain("EEEE-FFFF-GGGG-HHHH");
    expect(html).toContain("shown once");
    expect(html).toContain("I saved them");
  });

  it("signed in: handle, passkeys, codes left, and the account actions", () => {
    const html = renderToStaticMarkup(
      <AccountScreen
        view={{
          handle: "RookLover",
          created: "2026-10-22",
          passkeys: 2,
          codes: 7,
          listed: false,
          ratings: [
            { ruleset: "elbow-room", games: 3, text: "?" },
            { ruleset: "standard", games: 41, text: "1523" },
          ],
        }}
        busy={false}
        onAddPasskey={noop}
        onNewCodes={noop}
        onSignOut={noop}
        onDelete={noop}
        onListing={noop}
      />,
    );
    expect(html).toContain("RookLover");
    expect(html).toContain("2026-10-22");
    expect(html).toContain("Passkeys: 2");
    expect(html).toContain("Recovery codes left: 7");
    expect(html).toContain("standard: 1523 (41 games)");
    expect(html).toContain("elbow-room: ? (3 games)");
    for (const label of ["Add a passkey", "New recovery codes", "Sign out", "Delete account"])
      expect(html).toContain(label);
  });

  it("offers leaderboard listing, off until turned on, and says what it shows", () => {
    const screen = (listed: boolean) =>
      renderToStaticMarkup(
        <AccountScreen
          view={{ handle: "R", created: "2026-10-22", passkeys: 1, codes: 8, listed, ratings: [] }}
          busy={false}
          onAddPasskey={noop}
          onNewCodes={noop}
          onSignOut={noop}
          onDelete={noop}
          onListing={noop}
        />,
      );
    const off = screen(false);
    expect(off).toContain("List me on the public leaderboards");
    expect(off).toMatch(/<input type="checkbox"(?![^>]*checked)/);
    expect(off).toContain("your handle, rating, and number of rated games");
    expect(off).toContain("Anyone can see");
    expect(screen(true)).toMatch(/<input type="checkbox"[^>]*checked/);
  });

  it("offers a report path with every listed reason", async () => {
    const { ReportForm } = await import("./Account");
    const html = renderToStaticMarkup(<ReportForm busy={false} onReport={noop} />);
    expect(html).toContain("Report a handle");
    for (const r of REPORT_REASONS) expect(html).toContain(`value="${r}"`);
  });
});
