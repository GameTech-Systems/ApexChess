/** Terms of use (S19c). Provisional text; the minimum age is the owner's decision (13). */
import { HANDLE_MAX, HANDLE_MIN, MIN_AGE } from "@apexchess/online";

export function Terms({ onClose }: { onClose: () => void }) {
  return (
    <section aria-label="Terms" className="rules">
      <h1>Terms</h1>
      <p>
        Apex Chess is free to play. You can play on one screen, against the computer, online, and in
        events without an account; accounts are optional.
      </p>
      <h2>Who can have an account</h2>
      <p>You must be {MIN_AGE} or older to create an account. If you are not, play without one.</p>
      <h2>Handles</h2>
      <p>
        A handle is {HANDLE_MIN} to {HANDLE_MAX} characters: letters A to Z, digits, _ and -,
        starting with a letter. Handles that differ only in case, _ or - count as the same. Some
        handles are reserved, including any that use the site's name or a staff word. Don't use your
        real name, someone else's name, or anything offensive or personal. A handle that breaks
        these rules may be removed with its account.
      </p>
      <h2>Report a handle</h2>
      <p>
        On the Account page, anyone can report a handle as offensive, impersonating someone, or
        showing personal information. Reports are reviewed by hand.
      </p>
      <h2>Your account</h2>
      <p>
        You sign in with a passkey kept by your device or password manager. There is no email or
        password. At sign-up you get recovery codes; keep them safe. If you lose every passkey and
        every code, the account cannot be recovered. Delete account, on the Account page, removes it
        at once.
      </p>
      <h2>Play fair</h2>
      <p>
        Don't use an engine or another person's help in an online game, and don't disrupt games,
        events, or the site.
      </p>
      <h2>No warranty</h2>
      <p>
        The site is provided as is, without any warranty. It may change, pause, or stop at any time.
        These terms may change; the version on this page applies.
      </p>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </section>
  );
}
