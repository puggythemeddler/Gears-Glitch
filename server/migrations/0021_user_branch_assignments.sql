-- Migration: user -> branch assignments and the account's active branch
-- Desc:
--   1) user_branches: explicit many-to-many link between staff accounts and the
--      branches they may operate at. branches.manager_id already existed but is
--      a single "manager of record", not an access grant, so it could not scope
--      POS work to a branch.
--   2) users.last_branch_id: remembers which branch the account was last working
--      at, so the login picker can pre-select it instead of starting blank.
--
-- Resolution rules live in server/branch-access.ts, not here:
--   - admin/owner resolve to every active branch;
--   - other roles resolve to their user_branches rows;
--   - a shop with exactly one active branch resolves to that branch for
--     everyone, so existing single-branch installs keep working with no
--     assignment rows at all.

CREATE TABLE IF NOT EXISTS user_branches (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches (branch_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
