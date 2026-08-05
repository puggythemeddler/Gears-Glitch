import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { api, setCustomerSession, clearCustomerSession, clearStaffSession, clearProviderSession, migrateGuestCartToServer } from "@/lib/api";
import { useApp } from "@/lib/app-context";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: any; prompt: any; renderButton: any } } };
  }
}

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
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const gisLoadedRef = useRef(false);

  async function finishCustomerLogin(token: string, displayName: string) {
    setCustomerSession(token, displayName);
    contextLogin(token, displayName);
    await migrateGuestCartToServer();
    refreshCartCount();
  }

  useEffect(() => {
    api<{ googleClientId: string }>("/api/public-settings").then((d) => setGoogleClientId(d.googleClientId || "")).catch(() => {});
  }, []);

  useEffect(() => {
    if (!googleClientId || tab !== "customer" || !googleBtnRef.current || gisLoadedRef.current) return;
    if (typeof window.google === "undefined") {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => renderGoogleBtn();
      document.head.appendChild(script);
    } else {
      renderGoogleBtn();
    }
  }, [googleClientId, tab]);

  function renderGoogleBtn() {
    if (!window.google || !googleBtnRef.current) return;
    gisLoadedRef.current = true;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, { theme: "outline", size: "large", width: 320 });
  }

  async function handleGoogleCredential(response: { credential: string }) {
    if (!response.credential) return;
    setLoading(true);
    setError("");
    try {
      clearStaffSession();
      clearProviderSession();
      const data = await api("/api/customer/google-login", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential }),
      });
      await finishCustomerLogin(data.token, data.name || "Customer");
      router.push((redirect as string) || "/dashboard");
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

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
        localStorage.setItem("computerStoreToken", data.token);
        localStorage.setItem("staffUserName", data.username || data.email || "Staff");
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
            <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center" }}></div>
          </>
        )}
      </form>
    </div>
  );
}
