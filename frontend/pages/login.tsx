import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { api, setCustomerSession, setStaffSession, setProviderSession, clearCustomerSession, clearStaffSession, clearProviderSession, migrateGuestCartToServer } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { PageHead } from "@/components/ui";

export default function LoginPage() {
  const { login: contextLogin, refreshCartCount } = useApp();
  const router = useRouter();
  const { redirect } = router.query;
  const [tab, setTab] = useState<"customer" | "staff">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  async function finishCustomerLogin(token: string, displayName: string) {
    setCustomerSession(token, displayName);
    contextLogin(token, displayName);
    await migrateGuestCartToServer();
    refreshCartCount();
  }

  useEffect(() => {
    api<{ googleClientId: string }>("/api/public-settings").then((d) => setGoogleClientId(d.googleClientId || "")).catch(() => {});
  }, []);

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
        router.push((redirect as string) || "/dashboard");
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
        if (role === "provider") {
          setProviderSession(data.token, displayName);
        } else {
          setStaffSession(data.token, displayName, role, data.permissions || []);
        }
        if (role === "admin" || role === "owner" || role === "technician" || role === "manager" || role === "staff" || role === "provider") router.push("/admin");
        else router.push("/dashboard");
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
              href={`/api/auth/google?mode=customer${redirect ? `&redirect=${encodeURIComponent(String(redirect))}` : ""}`}
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
    </div>
  );
}
