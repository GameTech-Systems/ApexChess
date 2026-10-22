-- Leaderboards (S20d; docs/decisions/0006): off until the player turns listing on. A listed account
-- shows its handle, rating, and rated-game count for each settled rating. Nothing else is stored.
ALTER TABLE accounts ADD COLUMN listed INTEGER NOT NULL DEFAULT 0;
