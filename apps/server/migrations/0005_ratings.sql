-- Ratings (S19d, D17 default, provisional; docs/decisions/0006): one Glicko-2 rating per account
-- and ruleset id. No game ids, opponents, or days are kept. Deleting an account deletes its rows.
CREATE TABLE ratings (
  account_id TEXT NOT NULL,
  ruleset_id TEXT NOT NULL,
  rating REAL NOT NULL,
  rd REAL NOT NULL,
  volatility REAL NOT NULL,
  games INTEGER NOT NULL,
  PRIMARY KEY (account_id, ruleset_id)
);
