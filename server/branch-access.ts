import { query, queryAll, queryOne } from "./db-helpers";

// Active-branch resolution for staff accounts.
//
// Background: branches.manager_id records a single "manager of record" and is
// not an access grant, so it cannot scope POS work. user_branches (migration
// 0021) is the real many-to-many grant, and the branch a session is scoped to
// travels in the JWT as activeBranchId.
//
// Resolution rules, in order:
//   1. admin and owner resolve to every active branch. They are the shop
//      owners; scoping them to a subset would be a downgrade, and they still
//      have to pick one at login so their sales are attributed.
//   2. Everyone else resolves to their user_branches rows.
//   3. If the shop has exactly one active branch, that branch is available to
//      every account regardless of assignment. Without this, upgrading a
//      single-branch shop would lock every existing cashier out of the POS on
//      deploy day, because no user_branches rows exist yet.
//   4. Otherwise an unassigned account has no branches and is refused by
//      requireBranchContext with an actionable message.

export interface BranchOption {
  id: number;
  name: string;
}

export interface BranchContext {
  branchId: number | null;
  branches: BranchOption[];
  /** True when the account may operate at more than one branch. */
  requiresSelection: boolean;
}

const UNRESTRICTED_ROLES = new Set(["admin", "owner"]);

export function isUnrestrictedBranchRole(role: string | null | undefined): boolean {
  return UNRESTRICTED_ROLES.has(String(role || "").toLowerCase());
}

export async function listActiveBranches(): Promise<BranchOption[]> {
  const rows = (await queryAll(
    "SELECT id, name FROM branches WHERE is_active = 1 ORDER BY name, id"
  )) as { id: number; name: string }[];
  return rows.map((r) => ({ id: Number(r.id), name: r.name }));
}

export async function getUserBranches(userId: number, role: string): Promise<BranchOption[]> {
  if (isUnrestrictedBranchRole(role)) return listActiveBranches();

  const assigned = (await queryAll(
    `SELECT b.id, b.name
       FROM user_branches ub
       JOIN branches b ON b.id = ub.branch_id
      WHERE ub.user_id = $1 AND b.is_active = 1
      ORDER BY b.name, b.id`,
    [userId]
  )) as { id: number; name: string }[];
  if (assigned.length > 0) return assigned.map((r) => ({ id: Number(r.id), name: r.name }));

  // Rule 3: a one-branch shop needs no assignment rows to stay usable.
  const all = await listActiveBranches();
  if (all.length === 1) return all;
  return [];
}

export async function getLastBranchId(userId: number): Promise<number | null> {
  const row = (await queryOne(
    "SELECT last_branch_id FROM users WHERE id = $1",
    [userId]
  )) as { last_branch_id: number | null } | undefined;
  const id = row?.last_branch_id;
  return id == null ? null : Number(id);
}

export async function setLastBranchId(userId: number, branchId: number): Promise<void> {
  await query("UPDATE users SET last_branch_id = $1 WHERE id = $2", [branchId, userId]);
}

export type StaffBranchGate =
  /** No branch the account can use: refuse the login outright. */
  | { kind: "denied"; branches: BranchOption[] }
  /** More than one option: the user has to pick before a session exists. */
  | { kind: "picker"; branches: BranchOption[]; lastBranchId: number | null }
  /** Exactly one option: no prompt, pin the session to it. */
  | { kind: "pinned"; branches: BranchOption[]; branchId: number }
  /**
   * The shop has no active branches at all. Not a permissions problem: there is
   * nothing to scope to, so refusing here would lock every account out of a
   * brand-new install and no one could ever create the first branch. The session
   * is issued with a null branch, and branch-scoped work (the POS) still refuses
   * via requireBranchContext until a branch exists.
   */
  | { kind: "unscoped"; branches: BranchOption[] };

/**
 * The branch decision every staff sign-in path has to make, in one place, so a
 * new login route cannot quietly issue a session with no branch on it. Password,
 * Google OAuth and Google one-tap all funnel through here.
 */
export async function gateStaffBranchAccess(userId: number, role: string): Promise<StaffBranchGate> {
  const branches = await getUserBranches(userId, role);
  if (branches.length === 0) {
    // Distinguish "this account has no grants in a multi-branch shop" from "this
    // shop has no branches yet". Only the first is a lockout.
    const shopBranches = await listActiveBranches();
    if (shopBranches.length === 0) return { kind: "unscoped", branches };
    return { kind: "denied", branches };
  }

  if (branches.length > 1) {
    const last = await getLastBranchId(userId);
    // Only preselect a branch the account can still use; an owner who was since
    // unassigned must be asked rather than dropped somewhere they cannot work.
    const lastBranchId = last !== null && branches.some((b) => b.id === last) ? last : null;
    return { kind: "picker", branches, lastBranchId };
  }

  const branchId = branches[0].id;
  await setLastBranchId(userId, branchId);
  return { kind: "pinned", branches, branchId };
}

/**
 * Resolve the branch context for a login. `requestedBranchId` is only honoured
 * when the account is actually allowed to use it.
 */
export async function resolveBranchContext(
  userId: number,
  role: string,
  requestedBranchId?: number | null
): Promise<BranchContext> {
  const branches = await getUserBranches(userId, role);
  const allowed = new Set(branches.map((b) => b.id));

  let branchId: number | null = null;
  if (requestedBranchId != null && Number.isFinite(Number(requestedBranchId)) && allowed.has(Number(requestedBranchId))) {
    branchId = Number(requestedBranchId);
  }

  return { branchId, branches, requiresSelection: branches.length > 1 };
}

export class BranchAccessError extends Error {
  readonly branches: BranchOption[];
  constructor(message: string, branches: BranchOption[] = []) {
    super(message);
    this.name = "BranchAccessError";
    this.branches = branches;
  }
}

/**
 * Assert that a session may sell at `requestedBranchId`.
 *
 * `sessionBranchId` is the activeBranchId claim. When present it is
 * authoritative: a till that sends a different branchId is rejected rather than
 * silently overridden, so a tampered or stale payload cannot misattribute a
 * sale. When absent we fall back to the requested branch so single-branch shops
 * and pre-branch-scope sessions keep working.
 */
export async function requireBranchContext(
  userId: number,
  role: string,
  sessionBranchId: number | null | undefined,
  requestedBranchId: unknown
): Promise<number> {
  const branches = await getUserBranches(userId, role);
  const allowed = new Set(branches.map((b) => b.id));

  const requested =
    requestedBranchId === null || requestedBranchId === undefined || requestedBranchId === ""
      ? null
      : Number(requestedBranchId);
  if (requested !== null && !Number.isFinite(requested)) {
    throw new BranchAccessError("Invalid branch.");
  }

  if (branches.length === 0) {
    throw new BranchAccessError(
      "Your account is not assigned to any branch. Ask an owner or admin to assign you to a branch before using the POS.",
      []
    );
  }

  const session = sessionBranchId == null ? null : Number(sessionBranchId);

  if (session !== null) {
    if (!allowed.has(session)) {
      // The branch was removed, deactivated, or the grant was revoked after the
      // token was issued. Force a fresh selection rather than trusting the claim.
      throw new BranchAccessError("Your branch is no longer available. Please select a branch again.", branches);
    }
    if (requested !== null && requested !== session) {
      throw new BranchAccessError(
        "This till is signed in to a different branch. Switch branches before taking the sale.",
        branches
      );
    }
    return session;
  }

  if (requested !== null && allowed.has(requested)) return requested;

  if (branches.length === 1) return branches[0].id;

  throw new BranchAccessError("Select a branch before taking the sale.", branches);
}

export async function setUserBranches(userId: number, branchIds: number[]): Promise<BranchOption[]> {
  const ids = [...new Set((branchIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n)))];
  if (ids.length > 0) {
    const valid = (await queryAll("SELECT id FROM branches WHERE id = ANY($1::int[])", [ids])) as { id: number }[];
    const found = new Set(valid.map((r) => Number(r.id)));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) throw new BranchAccessError(`Unknown branch id(s): ${missing.join(", ")}`);
  }

  await query("DELETE FROM user_branches WHERE user_id = $1", [userId]);
  for (const id of ids) {
    await query("INSERT INTO user_branches (user_id, branch_id) VALUES ($1, $2)", [userId, id]);
  }
  // A revoked grant must not leave a stale pre-selection behind.
  if (ids.length === 0) {
    await query("UPDATE users SET last_branch_id = NULL WHERE id = $1", [userId]);
  } else {
    await query("UPDATE users SET last_branch_id = NULL WHERE id = $1 AND last_branch_id <> ALL($2::int[])", [userId, ids]);
  }
  return getUserBranches(userId, "staff");
}

export async function getUserBranchIds(userId: number): Promise<number[]> {
  const rows = (await queryAll(
    "SELECT branch_id FROM user_branches WHERE user_id = $1 ORDER BY branch_id",
    [userId]
  )) as { branch_id: number }[];
  return rows.map((r) => Number(r.branch_id));
}
