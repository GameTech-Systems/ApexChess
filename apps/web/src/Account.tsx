/** Accounts (S19c, D16): sign up with a passkey and a handle, sign in, recover, delete, report. */
import { useEffect, useState } from "react";
import { HANDLE_MAX, MIN_AGE, REPORT_REASONS, type ReportReason } from "@apexchess/online";
import {
  accountApi,
  clearSession,
  loadSession,
  saveSession,
  type AccountView,
  type Session,
} from "./account";
import type { KeyValueStore } from "./savedSetups";

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
      <h2>Create an account</h2>
      <label>
        Handle{" "}
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          maxLength={HANDLE_MAX}
          autoComplete="username webauthn"
          spellCheck={false}
        />
      </label>
      <label>
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /> I am{" "}
        {MIN_AGE} or older
      </label>
      <label>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> I
        accept the Terms
      </label>
      <button type="button" onClick={onTerms}>
        Read the Terms
      </button>
      <button
        type="button"
        onClick={() => onSignUp(handle)}
        disabled={busy || !handle.trim() || !age || !terms}
      >
        Create with a passkey
      </button>
      <h2>Sign in</h2>
      <button type="button" onClick={onSignIn} disabled={busy}>
        Sign in with a passkey
      </button>
      <h2>Lost your passkey?</h2>
      <p>Sign in with your handle and one recovery code, then add a passkey on this device.</p>
      <label>
        Handle{" "}
        <input
          value={lostHandle}
          onChange={(e) => setLostHandle(e.target.value)}
          maxLength={HANDLE_MAX}
          spellCheck={false}
        />
      </label>
      <label>
        Recovery code{" "}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={24}
          autoCapitalize="characters"
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        onClick={() => onRecover(lostHandle, code)}
        disabled={busy || !lostHandle.trim() || !code.trim()}
      >
        Use the recovery code
      </button>
    </>
  );
}

export function CodesScreen({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <>
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
    </>
  );
}

export function AccountScreen({
  view,
  busy,
  onAddPasskey,
  onNewCodes,
  onSignOut,
  onDelete,
}: {
  view: AccountView;
  busy: boolean;
  onAddPasskey: () => void;
  onNewCodes: () => void;
  onSignOut: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  return (
    <>
      <h2>{view.handle}</h2>
      <p>Account made {view.created}.</p>
      <p>
        Passkeys: {view.passkeys}. Recovery codes left: {view.codes}.
      </p>
      <button type="button" onClick={onAddPasskey} disabled={busy}>
        Add a passkey on this device
      </button>
      <button type="button" onClick={onNewCodes} disabled={busy}>
        New recovery codes
      </button>
      <button type="button" onClick={onSignOut} disabled={busy}>
        Sign out
      </button>
      <h2>Delete account</h2>
      <p>This deletes your handle, passkeys, and recovery codes at once. It cannot be undone.</p>
      <label>
        Type your handle to confirm{" "}
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} spellCheck={false} />
      </label>
      <button type="button" onClick={onDelete} disabled={busy || confirm.trim() !== view.handle}>
        Delete account
      </button>
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
    <>
      <h2>Report a handle</h2>
      <label>
        Handle{" "}
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          maxLength={HANDLE_MAX}
          spellCheck={false}
        />
      </label>
      <label>
        Reason{" "}
        <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onReport(handle, reason)}
        disabled={busy || !handle.trim()}
      >
        Send report
      </button>
    </>
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
    <main>
      <section aria-label="Account" className="controls">
        <h1>Account</h1>
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
        {message && <p role="alert">{message}</p>}
        <button type="button" onClick={onClose}>
          Back
        </button>
      </section>
    </main>
  );
}
