-- Accounts (S19c, D16; docs/decisions/0006): a passkey plus a handle. No email, password, real
-- name, birth date, or IP address. Deleting an account deletes every row below that names it.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  handle_key TEXT NOT NULL UNIQUE,
  created_day TEXT NOT NULL
);
-- Passkey public keys only; the private key never leaves the player's device.
CREATE TABLE passkeys (
  credential_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT NOT NULL,
  created_day TEXT NOT NULL
);
CREATE INDEX passkeys_by_account ON passkeys (account_id);
-- SHA-256 of each unused recovery code.
CREATE TABLE recovery_codes (
  account_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  PRIMARY KEY (account_id, code_hash)
);
-- SHA-256 of each session token, with its expiry in ms.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_by_account ON sessions (account_id);
-- One-use passkey challenges, a few minutes each. `purpose` is JSON (a sign-up keeps its handle here
-- until the account exists).
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires INTEGER NOT NULL
);
-- Handle reports: the handle, a listed reason, and the day. Nothing about who sent it.
CREATE TABLE handle_reports (
  id TEXT PRIMARY KEY,
  handle_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  day TEXT NOT NULL
);
