import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

const DEFAULT_PANELS = [
  { title: "Laptop & PC repairs", description: "Screen replacement, keyboard repair, battery replacement, motherboard diagnostics, and more." },
  { title: "Software & OS", description: "Virus removal, OS reinstallation, data recovery, driver updates, and software troubleshooting." },
  { title: "Upgrades", description: "RAM upgrades, SSD installation, CPU upgrades, and general performance improvements." },
  { title: "Mac & Apple devices", description: "MacBook, iMac, and Mac Pro repairs including display, keyboard, and logic board issues." },
];

export default function RepairsPage() {
  const [intro, setIntro] = useState("We offer professional repair services for laptops, desktops, Macs, tablets, and printers.");
  const [panels, setPanels] = useState(DEFAULT_PANELS);

  useEffect(() => {
    api<any>("/api/repairs-page").then((d) => {
      if (d?.intro) setIntro(d.intro);
      if (Array.isArray(d?.panels) && d.panels.length > 0) setPanels(d.panels);
    }).catch(() => {});
  }, []);

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Repairs</span></li>
        </ol>
      </nav>
      <h1>Repair services</h1>
      <p className="page-intro">{intro}</p>
      <div className="product-grid">
        {panels.map((p, i) => (
          <div className="panel" key={i}>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <a href="/repair-book" className="btn">Book a repair</a>
        <a href="/my-repairs" className="btn btn-secondary" style={{ marginLeft: "0.75rem" }}>Track my repairs</a>
      </div>
    </>
  );
}
