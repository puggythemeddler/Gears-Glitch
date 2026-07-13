import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface PinLockProps {
  storageKey: string;
  title?: string;
  onUnlock: () => void;
  verifyPin?: (pin: string) => Promise<boolean>;
}

export default function PinLock({ storageKey, title = "PIN", onUnlock, verifyPin }: PinLockProps) {
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"set" | "confirm" | "unlock">(
    verifyPin ? "unlock" : sessionStorage.getItem(storageKey) ? "unlock" : "set"
  );
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) { handleKey(e.key); return; }
      if (e.key === "Backspace") { handleKey("backspace"); return; }
      if (e.key === "Enter") { handleKey("enter"); return; }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function handleKey(k: string) {
    if (k === "backspace") {
      setPin((p) => p.slice(0, -1));
      setError("");
      return;
    }
    if (k === "enter") {
      if (pin.length < 6) { setError("Minimum 6 digits"); return; }

      if (mode === "set") {
        setFirstPin(pin);
        setPin("");
        setMode("confirm");
        return;
      }

      if (mode === "confirm") {
        if (pin !== firstPin) { setError("PINs don't match"); setPin(""); return; }
        sessionStorage.setItem(storageKey, pin);
        onUnlock();
        return;
      }

      if (mode === "unlock") {
        if (verifyPin) {
          setVerifying(true);
          try {
            const ok = await verifyPin(pin);
            if (ok) { onUnlock(); return; }
            setError("Wrong PIN");
          } catch {
            setError("Verification failed");
          } finally {
            setVerifying(false);
          }
        } else {
          const stored = sessionStorage.getItem(storageKey);
          if (pin === stored) { onUnlock(); return; }
          setError("Wrong PIN");
        }
        setPin("");
        return;
      }
      return;
    }
    setPin((p) => p + k);
    setError("");
  }

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "backspace"],
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", padding: "2rem",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        padding: "2rem", maxWidth: 360, width: "100%", textAlign: "center",
      }}>
        <h2 style={{ margin: "0 0 0.25rem" }}>
          {mode === "set" ? "Set your PIN" : mode === "confirm" ? "Confirm your PIN" : `Enter ${title}`}
        </h2>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {verifying ? "Verifying..." : mode === "set" ? "Minimum 6 digits" : mode === "confirm" ? "Re-enter your PIN" : ""}
        </p>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1.5rem", minHeight: 32 }}>
          {Array.from({ length: Math.max(6, pin.length + 1) }).map((_, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              background: i < pin.length ? "var(--primary)" : "var(--border)",
              transition: "background 0.15s",
            }} />
          ))}
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0 0 1rem" }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", maxWidth: 260, margin: "0 auto" }}>
          {keys.flat().map((k) =>
            k === "" ? <div key="empty" /> : (
              <button
                key={k}
                onClick={() => handleKey(k)}
                disabled={verifying}
                style={{
                  padding: "0.75rem", fontSize: "1.25rem", fontWeight: 600,
                  border: "1px solid var(--border)", borderRadius: 10,
                  background: k === "backspace" ? "var(--bg)" : "var(--surface)",
                  color: "var(--text)", cursor: "pointer", transition: "background 0.1s",
                  lineHeight: 1, opacity: verifying ? 0.5 : 1,
                }}
                onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.background = k === "backspace" ? "var(--bg)" : "var(--surface)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = k === "backspace" ? "var(--bg)" : "var(--surface)"; }}
              >
                {k === "backspace" ? "⌫" : k}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => handleKey("enter")}
          disabled={pin.length < 6 || verifying}
          style={{
            marginTop: "1rem", width: "100%", padding: "0.75rem", fontSize: "1rem", fontWeight: 600,
            border: "none", borderRadius: 10, background: "var(--primary)", color: "#fff", cursor: "pointer",
            opacity: pin.length < 6 || verifying ? 0.5 : 1,
          }}
        >
          {verifying ? "Verifying..." : mode === "unlock" ? "Unlock" : "Continue"}
        </button>

        {!verifyPin && (
          <button
            onClick={() => { sessionStorage.removeItem(storageKey); setPin(""); setError(""); setMode("set"); setFirstPin(""); }}
            style={{ marginTop: "0.75rem", background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
          >
            {mode === "unlock" ? "Reset PIN" : ""}
          </button>
        )}
      </div>
    </div>
  );
}
