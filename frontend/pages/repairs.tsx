import React from "react";

export default function RepairsPage() {
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Repairs</span></li>
        </ol>
      </nav>
      <h1>Repair services</h1>
      <p className="page-intro">We offer professional repair services for laptops, desktops, Macs, tablets, and printers.</p>
      <div className="product-grid">
        <div className="panel">
          <h3>Laptop &amp; PC repairs</h3>
          <p>Screen replacement, keyboard repair, battery replacement, motherboard diagnostics, and more.</p>
        </div>
        <div className="panel">
          <h3>Software &amp; OS</h3>
          <p>Virus removal, OS reinstallation, data recovery, driver updates, and software troubleshooting.</p>
        </div>
        <div className="panel">
          <h3>Upgrades</h3>
          <p>RAM upgrades, SSD installation, CPU upgrades, and general performance improvements.</p>
        </div>
        <div className="panel">
          <h3>Mac &amp; Apple devices</h3>
          <p>MacBook, iMac, and Mac Pro repairs including display, keyboard, and logic board issues.</p>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <a href="/repair-book" className="btn">Book a repair</a>
        <a href="/my-repairs" className="btn btn-secondary" style={{ marginLeft: "0.75rem" }}>Track my repairs</a>
      </div>
    </>
  );
}
