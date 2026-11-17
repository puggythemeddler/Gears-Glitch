import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHead } from "@/components/ui";
import RepairsSceneAnimation from "@/components/RepairsSceneAnimation";

const DEFAULT_PANELS = [
  { title: "Laptop & PC repairs", description: "Screen replacement, keyboard repair, battery replacement, motherboard diagnostics, and more." },
  { title: "Software & OS", description: "Virus removal, OS reinstallation, data recovery, driver updates, and software troubleshooting." },
  { title: "Upgrades", description: "RAM upgrades, SSD installation, CPU upgrades, and general performance improvements." },
  { title: "Mac & Apple devices", description: "MacBook, iMac, and Mac Pro repairs including display, keyboard, and logic board issues." },
];

export default function RepairsPage() {
  const [intro, setIntro] = useState("We offer professional repair services for laptops, desktops, Macs, tablets, and printers.");
  const [panels, setPanels] = useState<any[]>(DEFAULT_PANELS);
  const [catalog, setCatalog] = useState<{ enabled: boolean; services: Array<{ id: string; name: string; description: string; mode: string; feePolicies: Record<string, string> }> }>({ enabled: false, services: [] });

  useEffect(() => {
    api<any>("/api/repairs-page").then((d) => {
      if (d?.intro) setIntro(d.intro);
      if (Array.isArray(d?.panels) && d.panels.length > 0) setPanels(d.panels);
    }).catch(() => {});
    api<any>("/api/service-catalog").then((d) => {
      if (d?.enabled && Array.isArray(d.services)) setCatalog({ enabled: true, services: d.services });
    }).catch(() => {});
  }, []);

  const modeLabels: Record<string, string> = {
    workshop_appointment: "Home workshop by appointment",
    on_site: "On-site service",
    installation: "Installation",
    custom_build: "Custom build",
  };
  const feeLabels: Record<string, string> = {
    diagnosis: "Diagnosis / assessment",
    labour: "Labour",
    parts: "Parts",
    materials: "Materials",
    travel: "Travel / call-out",
    delivery: "Delivery",
  };
  const feePolicyLabels: Record<string, string> = {
    included: "included in quote",
    itemised_quote: "quoted separately",
    not_applicable: "not applicable",
    confirm_in_quote: "confirmed in quote",
  };

  return (
    <>
      <PageHead title="Repair services - Gear&Glitch" description={intro} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Repairs</span></li>
        </ol>
      </nav>
      <h1>Repair services</h1>
      <RepairsSceneAnimation />
      <p className="page-intro">{intro}</p>
      {catalog.enabled && catalog.services.length > 0 && <section aria-labelledby="service-catalogue-heading" style={{ margin: "1.5rem 0 2rem" }}>
        <h2 id="service-catalogue-heading">Book a service</h2>
        <p className="muted">All services are quote-based. We’ll confirm the scope and price with you before any work begins.</p>
        <div className="product-grid">
          {catalog.services.map((service) => <article className="panel" key={service.id}>
            <p className="muted" style={{ marginTop: 0 }}>{modeLabels[service.mode] || "Service by arrangement"}</p>
            <h3>{service.name}</h3>
            <p>{service.description}</p>
            {Object.keys(service.feePolicies || {}).length > 0 && <ul className="muted" style={{ paddingLeft: "1.2rem" }}>
              {Object.entries(service.feePolicies).map(([key, policy]) => policy && <li key={key}>{feeLabels[key] || key}: {feePolicyLabels[policy] || "confirmed in quote"}</li>)}
            </ul>}
            <a className="btn btn-sm" href={`/repair-book?catalogService=${encodeURIComponent(service.id)}`}>Request a quote</a>
          </article>)}
        </div>
      </section>}
      <div className="product-grid">
        {panels.filter((p) => p.active !== false).map((p, i) => {
          const booking = p.booking;
          const inner = (
            <>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              {booking && (
                <div style={{ marginTop: "0.75rem" }}>
                  <span className="btn btn-sm">Book this service</span>
                </div>
              )}
            </>
          );
          return booking ? (
            <a key={p.id || i} href={`/repair-book?service=${encodeURIComponent(p.id || i)}`} className="panel" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
              {inner}
            </a>
          ) : (
            <div className="panel" key={p.id || i}>{inner}</div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <a href="/repair-book" className="btn">Book a repair</a>
        <a href="/my-repairs" className="btn btn-secondary" style={{ marginLeft: "0.75rem" }}>Track my repairs</a>
      </div>
    </>
  );
}
