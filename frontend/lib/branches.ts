import { api } from "./api";

// Client mirror of the session's active branch.
//
// The server is the source of truth: the branch lives in the httpOnly session
// cookie as the activeBranchId claim and is enforced on every branch-sensitive
// write (e.g. POST /api/pos/checkout). These helpers only cache it so the UI can
// label the current branch without re-fetching the session on every render.
//
// Do not use this to authorise anything. A tampered value here changes nothing
// server-side; it just makes the UI show the wrong label.

export interface BranchOption {
  id: number;
  name: string;
}

const BRANCH_ID_KEY = "ggActiveBranchId";
const BRANCHES_KEY = "ggBranchOptions";

let activeBranchId: number | null = null;
let branchOptions: BranchOption[] = [];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readStoredBranches(): BranchOption[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(BRANCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((b: any) => ({ id: Number(b?.id), name: String(b?.name ?? "") }))
      .filter((b: any) => Number.isFinite(b.id));
  } catch {
    return [];
  }
}

export function setBranchState(id: number | null, branches: BranchOption[]): void {
  activeBranchId = id == null || !Number.isFinite(Number(id)) ? null : Number(id);
  branchOptions = Array.isArray(branches) ? branches : [];
  if (!isBrowser()) return;
  try {
    if (activeBranchId === null) localStorage.removeItem(BRANCH_ID_KEY);
    else localStorage.setItem(BRANCH_ID_KEY, String(activeBranchId));
    if (branchOptions.length === 0) localStorage.removeItem(BRANCHES_KEY);
    else localStorage.setItem(BRANCHES_KEY, JSON.stringify(branchOptions));
  } catch {
    /* storage unavailable (private mode) - in-memory copy still works */
  }
}

export function getActiveBranchId(): number | null {
  if (activeBranchId !== null) return activeBranchId;
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(BRANCH_ID_KEY);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function getBranchOptions(): BranchOption[] {
  if (branchOptions.length > 0) return branchOptions;
  branchOptions = readStoredBranches();
  return branchOptions;
}

export function getActiveBranchName(): string | null {
  const id = getActiveBranchId();
  if (id === null) return null;
  return getBranchOptions().find((b) => b.id === id)?.name ?? null;
}

export function clearBranchState(): void {
  setBranchState(null, []);
}

export interface SwitchBranchResult {
  ok: boolean;
  activeBranchId: number | null;
  branches: BranchOption[];
}

/**
 * Switch the session to a different branch. The server re-issues the session
 * cookie, so this must be followed by a session bootstrap for the rest of the app
 * to observe the new claim.
 */
export async function switchBranch(branchId: number): Promise<SwitchBranchResult> {
  const data = await api<{ ok: boolean; activeBranchId: number; branches: BranchOption[] }>(
    "/api/auth/switch-branch",
    { method: "POST", body: JSON.stringify({ branchId }) }
  );
  setBranchState(data.activeBranchId ?? null, data.branches || []);
  return { ok: !!data.ok, activeBranchId: data.activeBranchId ?? null, branches: data.branches || [] };
}
