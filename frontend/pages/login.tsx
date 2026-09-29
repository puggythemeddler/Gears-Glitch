import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { api, setCustomerSession, setStaffSession, setProviderSession, clearCustomerSession, clearStaffSession, clearProviderSession, migrateGuestCartToServer } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { PageHead } from "@/components/ui";
import BranchPicker from "@/components/BranchPicker";
import { setBranchState, type BranchOption } from "@/lib/branches";
import { safeRedirectPath } from "@/lib/sanitize";

export default function LoginPage() {
  const { login: contextLogin, refreshCartCount } = useApp();
  const router = useRouter();
  const { redirect } = router.query;
  // `?redirect=` is user input - never navigate straight to it.
  const redirectTo = safeRedirectPath(redirect);
  const [tab, setTab] = useState<"customer" | "staff">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  // Staff accounts that work at more than one branch stop here and say which
  // branch they are in before the server issues a session.
  const [pendingBranch, setPendingBranch] = useState<{
    token: string;
    branches: BranchOption[];
    lastBranchId: number | null;
    username: string;
    role: string;
  } | null>(null);
  const [branchBusy, setBranchBusy] = useState(false);
  const [branchError, setBranchError] = useState("");

  // `?redirect=` only ever applies to the customer journey. safeRedirectPath
  // falls back to "/dashboard", so letting staff fall through to it would send an
  // admin/technician into the customer area, which bounces them straight back to
  // this page. Staff always land in the portal.
  function destinationFor(role: string): string {
    if (role === "provider") return "/admin";
    const portal = ["admin", "owner", "technician", "manager", "staff"];
    return portal.includes(role) ? "/admin" : redirectTo || routeForRole(role);
  }

  function routeForRole(role: string): string {
    if (role === "admin" || role === "owner" || role === "technician" || role === "manager" || role === "staff" || role === "provider") return "/admin";
    return "/dashboard";
  }

  async function completeBranchSelection(branchId: number) {
    if (!pendingBranch) return;
    setBranchBusy(true);
    setBranchError("");
    try {
      const res = await fetch("/api/auth/select-branch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The short-lived branch-select token authorizes only this call.
          Authorization: `Bearer ${pendingBranch.token}`,
        },
        body: JSON.stringify({ branchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set your branch.");
      setBranchState(data.activeBranchId ?? null, data.branches || pendingBranch.branches);
      const role = data.role || pendingBranch.role;
      const displayName = data.username || pendingBranch.username || "Staff";
      if (role === "provider") setProviderSession(data.token, displayName);
      else setStaffSession(data.token, displayName, role, data.permissions || []);
      const dest = destinationFor(role);
      setPendingBranch(null);
      router.push(dest);
    } catch (err: any) {
      setBranchError(err.message || "Could not set your branch.");
    } finally {
      setBranchBusy(false);
    }
  }

  async function finishCustomerLogin(token: string, displayName: string) {
    setCustomerSession(token, displayName);
    contextLogin(token, displayName);
    await migrateGuestCartToServer();
    refreshCartCount();
  }

  useEffect(() => {
    api<{ googleClientId: string }>("/api/public-settings").then((d) => setGoogleClientId(d.googleClientId || "")).catch(() => {});
  }, []);

  // Google staff OAuth is a redirect, so it cannot run the JSON handshake the
  // password form does. When the account works at more than one branch the server
  // bounces here with a short-lived, purpose-scoped select token; decode it and
  // render the same picker. The token carries no session authority, and it is
  // stripped from the URL so it cannot linger in history or a referrer.
  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.staff_branch_select;
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (typeof token !== "string" || !token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/branch-options", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Your sign-in link has expired.");
        setTab("staff");
        setError("");
        setPendingBranch({
          token,
          branches: data.branches || [],
          lastBranchId: data.lastBranchId ?? null,
          username: data.username || "Staff",
          role: data.role || "staff",
        });
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || "Your sign-in link has expired. Please sign in again.");
      } finally {
        // Drop the token from the address bar either way.
        if (window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady, router.query.staff_branch_select]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "customer") {
        clearStaffSession();
        clearProviderSession();
        const data = await api("/api/customer/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        await finishCustomerLogin(data.token, data.name || "Customer");
        router.push(redirectTo);
      } else {
        clearCustomerSession();
        clearProviderSession();
        const body: any = { username: email, password };
        if (totpRequired && totpCode) body.totpCode = totpCode;
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.totpRequired) {
            setTotpRequired(true);
            setError("Enter your 2FA code.");
            setLoading(false);
            return;
          }
          throw new Error(data.error || "Login failed");
        }
        setTotpRequired(false);
        setTotpCode("");
        const role = data.role || "";
        const displayName = data.username || data.email || "Staff";
        // Server stopped at the branch picker; hold the short-lived token and
        // render the chooser instead of a session.
        if (data.requiresBranch) {
          setPendingBranch({
            token: data.branchSelectToken,
            branches: Array.isArray(data.branches) ? data.branches : [],
            lastBranchId: data.lastBranchId ?? null,
            username: displayName,
            role,
          });
          setBranchError("");
          setLoading(false);
          return;
        }
        setBranchState(data.activeBranchId ?? null, Array.isArray(data.branches) ? data.branches : []);
        if (role === "provider") {
          setProviderSession(data.token, displayName);
        } else {
          setStaffSession(data.token, displayName, role, data.permissions || []);
        }
        router.push(destinationFor(role));
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <PageHead title="Sign in - Gear&Glitch" description="Sign in to your Gear&Glitch account to shop, track repairs and manage orders." />
      <h1>Sign in</h1>
      <div className="auth-tabs">
        <button className={`auth-tab ${tab === "customer" ? "active" : ""}`} onClick={() => setTab("customer")}>
          Customer
        </button>
        <button className={`auth-tab ${tab === "staff" ? "active" : ""}`} onClick={() => setTab("staff")}>
          Staff &amp; Provider
        </button>
      </div>

      {pendingBranch ? (
        <BranchPicker
          branches={pendingBranch.branches}
          initialBranchId={pendingBranch.lastBranchId}
          busy={branchBusy}
          error={branchError}
          submitLabel="Start session"
          onSubmit={completeBranchSelection}
          onCancel={() => { setPendingBranch(null); setBranchError(""); }}
        />
      ) : (
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="email" className="input-label">{tab === "customer" ? "Email" : "Username or email"}</label>
          <input
            id="email"
            className="input"
            type={tab === "customer" ? "email" : "text"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="password" className="input-label">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {totpRequired && (
          <div className="field">
            <label htmlFor="totpCode" className="input-label">2FA Code</label>
            <input
              id="totpCode"
              className="input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              required
              autoFocus
            />
          </div>
        )}
        {tab === "customer" && (
          <div className="field">
            <label htmlFor="name" className="input-label">Name (for new accounts)</label>
            <input
              id="name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave blank to sign in"
            />
          </div>
        )}
        {tab === "customer" && (
          <p className="input-hint" style={{ marginBottom: "var(--space-3)" }}>
            No account? Enter a name and we&apos;ll create one.
          </p>
        )}
        {error && <p className="form-status error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Signing in..." : totpRequired ? "Verify & Sign in" : "Sign in"}
        </button>
        {tab === "customer" && googleClientId && (
          <>
            <div style={{ textAlign: "center", margin: "var(--space-4) 0", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>or</div>
            <a
              href={`/api/auth/google?mode=customer${redirectTo !== "/dashboard" ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="google-signin-btn"
            >
              <svg className="google-signin-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </a>
          </>
        )}
      </form>
      )}

      {tab === "customer" && !pendingBranch && (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => { setTab("staff"); setError(""); }}
          style={{ marginTop: "var(--space-3)" }}
        >
          Staff or provider sign-in
        </button>
      )}
    </div>
  );
}
