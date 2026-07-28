import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";

export default function ContactPage() {
  const router = useRouter();
  const { formatPrice } = useApp();
  const [settings, setSettings] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<any>("/api/public-settings").then((s) => setSettings(s)).catch(() => {});
    const productName = router.query.name as string;
    const productId = router.query.product as string;
    if (productName) {
      setSubject(`Enquiry about: ${productName}`);
      setMessage(`Hi, I'd like to know more about "${productName}"${productId ? ` (ID: ${productId})` : ""}.`);
    }
  }, [router.query.name, router.query.product]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api("/api/contact", { method: "POST", body: JSON.stringify({ name, email, subject, message }) });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send message. Please try again.");
    } finally { setSending(false); }
  }

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Contact</span></li>
        </ol>
      </nav>
      <h1>Contact us</h1>
      <p className="page-intro">Have a question about our products or services? Reach out and we&apos;ll get back to you as soon as possible.</p>

      <div className="form-grid" style={{ gap: "2rem" }}>
        <div className="panel">
          <h2>Get in touch</h2>
          {settings ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p><strong>Email:</strong> {settings.email || "info@gearandglitch.com"}</p>
              <p><strong>Phone:</strong> {settings.phone || "Contact us via email"}</p>
              <p><strong>Store:</strong> {settings.storeName || "Gear&Glitch"}</p>
            </div>
          ) : (
            <p>Loading contact details...</p>
          )}
        </div>
        <div className="panel">
          <h2>Send a message</h2>
          {sent ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>&#9993;</div>
              <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Message sent!</p>
              <p className="muted">We&apos;ll get back to you as soon as possible.</p>
              <button className="btn btn-secondary" style={{ marginTop: "1rem" }} onClick={() => { setSent(false); setName(""); setEmail(""); setSubject(""); setMessage(""); }}>Send another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="field">
                <label htmlFor="contactName">Name</label>
                <input id="contactName" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="contactEmail">Email</label>
                <input id="contactEmail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="contactSubject">Subject</label>
                <input id="contactSubject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="contactMsg">Message</label>
                <textarea id="contactMsg" className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required />
              </div>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn" disabled={sending}>{sending ? "Sending..." : "Send message"}</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
