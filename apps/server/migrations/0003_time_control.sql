-- Time controls (S20a, D19; docs/decisions/0007). Format 2 rows name the time control id;
-- format 1 rows (before clocks) leave it null. Clock times are never stored.
ALTER TABLE games
  ADD COLUMN time_control TEXT;
