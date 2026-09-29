-- Backfill user_branches for accounts that existed before branch scoping.
--
-- Migration 0021 created the table but left it empty. Because login refuses an
-- unassigned account whenever the shop has more than one active branch, an
-- empty table would lock every existing staff member out of the POS on deploy
-- day: before this feature anyone could work at any branch, and none of them
-- have a grant row.
--
-- So every pre-existing account is granted every active branch. That reproduces
-- exactly the access they had before, and an owner can then narrow it down from
-- the admin Users page at leisure. Granting broadly on day one and tightening
-- later is the safe direction; the reverse locks people out.
--
-- New accounts created after this migration get no rows and must be assigned
-- explicitly, which is the intended steady state.

INSERT INTO user_branches (user_id, branch_id)
SELECT u.id, b.id
  FROM users u
  CROSS JOIN branches b
 WHERE b.is_active = 1
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- A revoked or newly-added grant must not leave a stale pre-selection behind.
UPDATE users
   SET last_branch_id = NULL
 WHERE last_branch_id IS NOT NULL
   AND last_branch_id NOT IN (SELECT branch_id FROM user_branches);
