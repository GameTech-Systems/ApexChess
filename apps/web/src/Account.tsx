/** Accounts (S19c, D16): sign up with a passkey and a handle, sign in, recover, delete, report. */
import { useEffect, useState } from "react";
import {
  HANDLE_MAX,
  HANDLE_MIN,
  MIN_AGE,
  REPORT_REASONS,
  type ReportReason,
} from "@apexchess/online";
import {
  accountApi,
  clearSession,
  loadSession,
  saveSession,
  type AccountView,
  type Session,
} from "./account";
import { Field, PageHead } from "./Page";
import type { KeyValueStore } from "./savedSetups";

const HANDLE_HINT = `${HANDLE_MIN} to ${HANDLE_MAX} letters A to Z, digits, _ or -, starting with a letter. Don't use your real name.`;

const REASON_LABELS: Record<ReportReason, string> = {
  offensive: "Offensive",
  impersonation: "Pretends to be someone else",
  "personal-info": "Shows personal information",
};

export function SignedOutScreen({
  busy,
  onSignUp,
  onSignIn,
  onRecover,
  onTerms,
}: {
  busy: boolean;
  onSignUp: (handle: string) => void;
  onSignIn: () => void;
  onRecover: (handle: string, code: string) => void;
  onTerms: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [lostHandle, setLostHandle] = useState("");
  const [code, setCode] = useState("");
  return (
    <>
      <p>
        Accounts are optional: you can play everything without one. You sign in with a passkey saved
        on your device or in your password manager. No email and no password.
      </p>
      <form
        className="form-group"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && handle.trim() && age && terms) onSignUp(handle);
        }}
      >
        <h2>Create an account</h2>
        <Field
          label="Handle"
          hint={HANDLE_HINT}
          value={handle}
          onChange={setHandle}
          maxLength={HANDLE_MAX}
          autoComplete="username webauthn"
          spellCheck={false}
        />
        <label className="check">
          <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /> I am{" "}
          {MIN_AGE} or older
        </label>
        <label className="check">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> I
          accept the Terms
        </label>
        <div className="actions">
          <button type="button" onClick={onTerms}>
            Read the Terms
          </button>
          <button type="submit" disabled={busy || !handle.trim() || !age || !terms}>
            Create with a passkey
          </button>
        </div>
      </form>
      <div className="form-group">
        <h2>Sign in</h2>
        <button type="button" onClick={onSignIn} disabled={busy}>
          Sign in with a passkey
        </button>
      </div>
      <form
        className="form-group"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && lostHandle.trim() && code.trim()) onRecover(lostHandle, code);
        }}
      >
        <h2>Lost your passkey?</h2>
        <p>Sign in with your handle and one recovery code, then add a passkey on this device.</p>
        <Field
          label="Handle"
          value={lostHandle}
          onChange={setLostHandle}
          maxLength={HANDLE_MAX}
          spellCheck={false}
        />
        <Field
          label="Recovery code"
          value={code}
          onChange={setCode}
          maxLength={24}
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit" disabled={busy || !lostHandle.trim() || !code.trim()}>
          Use the recovery code
        </button>
      </form>
    </>
  );
}

export function CodesScreen({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="form-group">
      <h2>Your recovery codes</h2>
      <p>
        These are shown once. Save them somewhere safe: each one signs you in once if you lose your
        passkey. Without a passkey or a code, the account cannot be recovered.
      </p>
      <ul className="codes">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onDone}>
        I saved them
      </button>
    </div>
  );
}

export function AccountScreen({
  view,
  busy,
  onAddPasskey,
  onNewCodes,
  onSignOut,
  onDelete,
  onListing,
}: {
  view: AccountView;
  busy: boolean;
  onAddPasskey: () => void;
  onNewCodes: () => void;
  onSignOut: () => void;
  onDelete: () => void;
  onListing: (listed: boolean) => void;
}) {
  const [confirm, setConfirm] = useState("");
  return (
    <>
      <div className="form-group">
        <h2>{view.handle}</h2>
        <p>Account made {view.created}.</p>
        <button type="button" onClick={onSignOut} disabled={busy}>
          Sign out
        </button>
      </div>
      <div className="form-group">
        <h2>Passkeys and recovery</h2>
        <p>
          Passkeys: {view.passkeys}. Recovery codes left: {view.codes}.
        </p>
        <div className="actions">
          <button type="button" onClick={onAddPasskey} disabled={busy}>
            Add a passkey on this device
          </button>
          <button type="button" onClick={onNewCodes} disabled={busy}>
            New recovery codes
          </button>
        </div>
      </div>
      <div className="form-group">
        <h2>Ratings</h2>
        {view.ratings.length ? (
          <>
            <ul>
              {view.ratings.map((r) => (
                <li key={r.ruleset}>
                  {r.ruleset}: {r.text} ({r.games} {r.games === 1 ? "game" : "games"})
                </li>
              ))}
            </ul>
            <p>A rating shows ? until it has settled after a few more games.</p>
          </>
        ) : (
          <p>No rated games yet.</p>
        )}
        <p>
          Quick-match games against another signed-in player count, one rating per rule set. Untimed
          games do not.
        </p>
      </div>
      <div className="form-group">
        <h2>Leaderboards</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={view.listed}
            disabled={busy}
            onChange={(e) => onListing(e.target.checked)}
          />{" "}
          List me on the public leaderboards
        </label>
        <p>
          Off unless you turn it on. Anyone can see the leaderboards: they show your handle, rating,
          and number of rated games for each rule set where your rating has settled. Turn this off
          to leave them at once.
        </p>
      </div>
      <div className="form-group">
        <h2>Delete account</h2>
        <p>
          This deletes your handle, passkeys, recovery codes, and ratings at once. It cannot be
          undone.
        </p>
        <Field
          label="Type your handle to confirm"
          value={confirm}
          onChange={setConfirm}
          spellCheck={false}
        />
        <button type="button" onClick={onDelete} disabled={busy || confirm.trim() !== view.handle}>
          Delete account
        </button>
      </div>
    </>
  );
}

export function ReportForm({
  busy,
  onReport,
}: {
  busy: boolean;
  onReport: (handle: string, reason: ReportReason) => void;
}) {
  const [handle, setHandle] = useState("");
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  return (
    <form
      className="form-group"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && handle.trim()) onReport(handle, reason);
      }}
    >
      <h2>Report a handle</h2>
      <Field
        label="Handle"
        value={handle}
        onChange={setHandle}
        maxLength={HANDLE_MAX}
        spellCheck={false}
      />
      <label className="field">
        Reason
        <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={busy || !handle.trim()}>
        Send report
      </button>
    </form>
  );
}

/** The Account page: loads the session kept on this device and runs each action. */
export function Account({
  store,
  onClose,
  onTerms,
}: {
  store: KeyValueStore;
  onClose: () => void;
  onTerms: () => void;
}) {
  const [api] = useState(() => accountApi());
  const [session, setSession] = useState<Session | undefined>(() => loadSession(store));
  const [view, setView] = useState<AccountView>();
  const [codes, setCodes] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const signedIn = (s: Session) => {
    saveSession(store, s);
    setSession(s);
  };
  const signedOut = () => {
    clearSession(store);
    setSession(undefined);
    setView(undefined);
  };
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!session || codes) return;
    let live = true;
    // A session that no longer works (expired, signed out elsewhere) is dropped from this device.
    api.view(session.token).then(
      (v) => live && setView(v),
      (e: Error) => {
        if (!live) return;
        clearSession(store);
        setSession(undefined);
        setMessage(e.message);
      },
    );
    return () => {
      live = false;
    };
  }, [api, store, session, codes]);

  return (
    <main className="page">
      <section aria-label="Account" className="form-page">
        {/* While the one-time codes show, leaving would lose them: only "I saved them" moves on. */}
        <PageHead title="Account" onBack={codes ? undefined : onClose} />
        {message && (
          <p role="alert" className="notice">
            {message}
          </p>
        )}
        {codes ? (
          <CodesScreen codes={codes} onDone={() => setCodes(undefined)} />
        ) : session && view ? (
          <AccountScreen
            view={view}
            busy={busy}
            onAddPasskey={() =>
              run(async () => {
                await api.addPasskey(session.token);
                setView(await api.view(session.token));
                setMessage("Passkey added.");
              })
            }
            onNewCodes={() => run(async () => setCodes((await api.newCodes(session.token)).codes))}
            onSignOut={() =>
              run(async () => {
                await api.signOut(session.token).catch(() => undefined);
                signedOut();
              })
            }
            onDelete={() =>
              run(async () => {
                await api.remove(session.token);
                signedOut();
                setMessage("Your account was deleted.");
              })
            }
            onListing={(listed) =>
              run(async () => {
                await api.setListed(session.token, listed);
                setView({ ...view, listed });
              })
            }
          />
        ) : session ? (
          <p>Loading…</p>
        ) : (
          <SignedOutScreen
            busy={busy}
            onTerms={onTerms}
            onSignUp={(handle) =>
              run(async () => {
                const r = await api.signUp({ handle, ageConfirmed: true, termsAccepted: true });
                setCodes(r.codes);
                signedIn({ token: r.token, handle: r.handle });
              })
            }
            onSignIn={() => run(async () => signedIn(await api.signIn()))}
            onRecover={(handle, code) =>
              run(async () => {
                signedIn(await api.recover({ handle, code }));
                setMessage("Signed in. Add a passkey on this device, and make new recovery codes.");
              })
            }
          />
        )}
        {!codes && (
          <ReportForm
            busy={busy}
            onReport={(handle, reason) =>
              run(async () => {
                await api.report({ handle, reason });
                setMessage("Thanks. The report was sent.");
              })
            }
          />
        )}
      </section>
    </main>
  );
}
