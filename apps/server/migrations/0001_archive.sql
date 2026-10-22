-- Anonymous game archive (S19a; docs/decisions/0006). Game data and the end day only:
-- no seat token, room code, IP address, or time of day. Rows match archiveRow in @apexchess/online.
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  format INTEGER NOT NULL,
  ruleset_id TEXT NOT NULL,
  ruleset_version TEXT NOT NULL,
  setup_light TEXT NOT NULL,
  setup_dark TEXT NOT NULL,
  moves TEXT NOT NULL,
  plies INTEGER NOT NULL,
  status TEXT NOT NULL,
  winner TEXT,
  reason TEXT,
  end_day TEXT NOT NULL
);
CREATE INDEX games_by_ruleset ON games (ruleset_id, ruleset_version);
