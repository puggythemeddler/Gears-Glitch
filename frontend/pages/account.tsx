import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  api,
  isCustomerLoggedIn,
  setCustomerSession,
  clearStaffSession,
  clearProviderSession,
  migrateGuestCartToServer,
} from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { usePageTitle } from "@/lib/use-page-title";

type Mode = "idle" | "magic" | "reset" | "adminReset";

export default function AccountPage() {
  const { login: contextLogin, refreshCartCount } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  usePageTitle("My account - Gear&Glitch");

  useEffect(() => {
    if (!router.isReady) return;
    const { magic, reset, adminReset } = router.query;
    if (typeof magic === "string" && magic) {
      setMode("magic");
      completeMagic(magic);
    } else if (typeof reset === "string" && reset) {
      setMode("reset");
    } else if (typeof adminReset === "string" && adminReset) {
      setMode("adminReset");
    } else if (isCustomerLoggedIn()) {
      setRedirecting(true);
      router.push("/dashboard");
    } else {
      setMode("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  async function completeMagic(token: string) {
    setBusy(true);
    try {
      clearStaffSession();
      clearProviderSession();
      const data = await api("/api/auth/magic-login", { method: "POST", body: JSON.stringify({ token }) });
      setCustomerSession(data.token, data.name || "Customer");
      contextLogin(data.token, data.name || "Customer");
      await migrateGuestCartToServer();
      refreshCartCount();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "This magic link is invalid or has expired.");
      setBusy(false);
    }
  }

  async function submitPasswordReset(e: React.FormEvent, isAdmin: boolean, token: string) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const endpoint = isAdmin ? "/api/auth/admin-password-reset" : "/api/auth/password-reset";
      await api(endpoint, { method: "POST", body: JSON.stringify({ token, newPassword }) });
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(isAdmin
        ? "Your admin password was reset. Sign in with the new password."
        : "Your password was reset. Sign in with the new password.");
    } catch (err: any) {
      setError(err.message || "This reset link is invalid or has expired.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "magic") {
    return (
      <div className="auth-page">
        <h1>Signing you in...</h1>
        <p className="muted" style={{ marginBottom: "var(--space-3)" }}>{busy ? "Checking your magic link..." : "Could not sign you in with that link."}</p>
        {error && <p className="form-status error">{error}</p>}
        {!busy && <a href="/login?redirect=/dashboard" className="btn btn-primary btn-block">Go to sign in</a>}
      </div>
    );
  }

  if (mode === "reset" || mode === "adminReset") {
    const isAdmin = mode === "adminReset";
    const token = String(router.query[isAdmin ? "adminReset" : "reset"] || "");
    return (
      <div className="auth-page">
        <h1>Set a new password</h1>
        <p className="muted">
          {isAdmin
            ? "Use the email link you received to set a new admin password."
            : "Use the email link you received to set a new password for your account."}
        </p>
        <form className="auth-form" onSubmit={(e) => submitPasswordReset(e, isAdmin, token)}>
          <div className="field">
            <label htmlFor="new-password" className="input-label">New password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password" className="input-label">Confirm new password</label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          {error && <p className="form-status error">{error}</p>}
          {success && <p className="form-status success">{success}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !!success}>
            {busy ? "Saving..." : "Set new password"}
          </button>
        </form>
        {success && (
          <p style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
            <a href={isAdmin ? "/login?redirect=/admin" : "/login"} className="btn btn-ghost">Go to sign in</a>
          </p>
        )}
      </div>
    );
  }

  const signedIn = isCustomerLoggedIn();
  if (mode === "idle" && (redirecting || signedIn)) return null;

  return (
    <div className="auth-page">
      <h1>Account</h1>
      <p className="muted">Please <a href="/login?redirect=/dashboard">sign in</a> to access your account.</p>
    </div>
  );
}