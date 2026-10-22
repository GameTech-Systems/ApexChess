-- Public setup statistics (S19b; docs/decisions/0006). One JSON snapshot per ruleset id and
-- version, rewritten by the daily job from the games table. Aggregates only.
CREATE TABLE stats (
  ruleset_id TEXT NOT NULL,
  ruleset_version TEXT NOT NULL,
  as_of TEXT NOT NULL,
  games INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  PRIMARY KEY (ruleset_id, ruleset_version)
);
