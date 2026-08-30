import React, { useEffect, useState } from "react";
import Icon from "@/components/icons";

interface Stat { value: string; label: string; }
interface AboutData {
  title: string;
  content: string;
  mission: string;
  vision: string;
  missionTitle: string;
  visionTitle: string;
  image: string;
  address: string;
  hours: string;
  stats: Stat[];
}

export default function AboutPage() {
  const [data, setData] = useState<AboutData | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetch("/api/public-settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d);
        if (d.aboutUs) setData(d.aboutUs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><a href="/">Home</a></li>
            <li><span aria-current="page">About Us</span></li>
          </ol>
        </nav>
        <p style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>Loading...</p>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><a href="/">Home</a></li>
            <li><span aria-current="page">About Us</span></li>
          </ol>
        </nav>
        <div className="about-empty">
          <p>No information available yet.</p>
          <a className="btn btn-primary" href="/">Back to home</a>
        </div>
      </>
    );
  }

  const storeName = settings?.storeName || "My Shop";
  const email = settings?.email || "";
  const phone = settings?.phone || "";
  const waPhone = phone.replace(/[^0-9]/g, "");
  const image = data.image || "";
  const stats = Array.isArray(data.stats) ? data.stats.filter((s) => s.value || s.label) : [];
  const missionTitle = data.missionTitle || "Our Mission";
  const visionTitle = data.visionTitle || "Our Vision";
  const showImage = image && !imgError;

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">About Us</span></li>
        </ol>
      </nav>

      <div className="about-wrap">
        <header className="about-header">
          <p className="about-kicker">Our story</p>
          <h1>{data.title || "About Us"}</h1>
        </header>

        {showImage && (
          <div className="about-banner">
            <img src={image} alt={data.title || "About us"} onError={() => setImgError(true)} />
          </div>
        )}

        {data.content && <div className="about-prose">{data.content}</div>}

        {stats.length > 0 && (
          <div className="about-stats">
            {stats.map((s, i) => (
              <div key={i} className="about-stat">
                <div className="about-stat-value">{s.value}</div>
                <div className="about-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {(data.mission || data.vision) && (
          <div className="about-cards">
            {data.mission && (
              <div className="about-card">
                <div className="about-card-icon"><Icon name="target" size={24} /></div>
                <h2>{missionTitle}</h2>
                <p>{data.mission}</p>
              </div>
            )}
            {data.vision && (
              <div className="about-card">
                <div className="about-card-icon"><Icon name="eye" size={24} /></div>
                <h2>{visionTitle}</h2>
                <p>{data.vision}</p>
              </div>
            )}
          </div>
        )}

        <section className="about-trust" aria-label="Why shop with us">
          <h2>Why shop with us</h2>
          <div className="hero-truststrip">
            <span className="hero-truststrip-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              M-Pesa &amp; Cards accepted
            </span>
            <span className="hero-truststrip-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              Nationwide delivery
            </span>
            <span className="hero-truststrip-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
              Warranty on all items
            </span>
            <span className="hero-truststrip-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Nairobi delivery in 24h
            </span>
          </div>
        </section>

        {(email || phone || data.address || data.hours) && (
          <section className="about-contact" aria-label="Contact information">
            <h2>Get in touch</h2>
            <div className="about-contact-grid">
              <div className="about-contact-card">
                <div className="about-contact-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
                </div>
                <div className="about-contact-label">Visit us</div>
                <div className="about-contact-value">{data.address || storeName}</div>
              </div>
              {email && (
                <a className="about-contact-card" href={`mailto:${email}`}>
                  <div className="about-contact-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
                  </div>
                  <div className="about-contact-label">Email us</div>
                  <div className="about-contact-value">{email}</div>
                </a>
              )}
              {phone && (
                <a className="about-contact-card" href={`tel:${phone}`}>
                  <div className="about-contact-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div className="about-contact-label">Call us</div>
                  <div className="about-contact-value">{phone}</div>
                </a>
              )}
              {waPhone && (
                <a
                  className="about-contact-card"
                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent("Hello! I'd like to know more about your products.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="about-contact-icon about-wa">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  </div>
                  <div className="about-contact-label">WhatsApp</div>
                  <div className="about-contact-value">Chat with us</div>
                </a>
              )}
            </div>
            {(data.address || data.hours) && (
              <div className="about-contact-meta">
                {data.address && <span><Icon name="mapPin" size={13} /> {data.address}</span>}
                {data.hours && <span><Icon name="clock" size={13} /> {data.hours}</span>}
              </div>
            )}
          </section>
        )}

        <section className="about-cta" aria-label="Explore">
          <p>Ready to find your next device?</p>
          <div className="about-cta-row">
            <a className="btn btn-primary btn-lg" href="/laptops">Shop Laptops</a>
            <a className="btn btn-secondary btn-lg" href="/repairs">Book a Repair</a>
            <a className="btn btn-ghost btn-lg" href="/contact">Contact Us</a>
          </div>
        </section>
      </div>
    </>
  );
}
