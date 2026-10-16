import React, { useEffect, useState } from "react";

// =============================================================================
// DRAFT TERMS OF SERVICE - NOT LEGAL ADVICE, NOT YET REVIEWED.
//
// Starting template only. Replace every [BRACKETED] field and obtain review by a
// qualified legal professional before relying on or advertising these terms.
//
// See LEGAL_REVIEW_REQUIRED.md in the repository root.
// =============================================================================

export default function TermsPage() {
  const [storeName, setStoreName] = useState("this store");

  useEffect(() => {
    fetch("/api/public-settings")
      .then((r) => r.json())
      .then((d) => { if (d?.storeName) setStoreName(d.storeName); })
      .catch(() => {});
  }, []);

  return (
    <div className="legal-page" style={{ maxWidth: 820, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Terms of Service</span></li>
        </ol>
      </nav>

      <div
        role="note"
        style={{
          border: "1px solid #d98a00",
          background: "#fff7e6",
          color: "#7a4b00",
          borderRadius: 8,
          padding: "0.85rem 1rem",
          margin: "1rem 0 1.5rem",
          fontSize: "0.9rem",
        }}
      >
        <strong>DRAFT - pending legal review.</strong> This template is provided for
        configuration only and has not been reviewed by a lawyer. Replace every
        highlighted placeholder and obtain legal review before publishing.
      </div>

      <h1>Terms of Service</h1>
      <p><em>Last updated: [EFFECTIVE DATE].</em></p>

      <p>
        These terms govern your use of the website and services operated by
        <strong> [COMPANY LEGAL NAME]</strong>, trading as <strong>{storeName}</strong>.
        By using the service you agree to these terms.
      </p>

      <h2>1. Accounts</h2>
      <p>You are responsible for the accuracy of your account information and for keeping your credentials secure. [ELIGIBILITY / AGE REQUIREMENT].</p>

      <h2>2. Orders, pricing and availability</h2>
      <p>Prices and availability are as shown at the time of order and may change. [CURRENCY, TAXES, AND PRICING RULES].</p>

      <h2>3. Payments</h2>
      <p>Payments are processed via [PAYMENT PROVIDERS]. [REFUND / CHARGEBACK RULES].</p>

      <h2>4. Delivery</h2>
      <p>[DELIVERY AREAS, TIMESCALES, FEES, AND RISK/OWNERSHIP TRANSFER].</p>

      <h2>5. Warranty, returns and cancellations</h2>
      <p>[WARRANTY PERIOD, WHAT IS COVERED/EXCLUDED, RETURNS WINDOW, STATUTORY RIGHTS].</p>

      <h2>6. Repairs</h2>
      <p>[DIAGNOSTIC/QUOTE ACCEPTANCE, DATA BACKUP RESPONSIBILITY, UNCOLLECTED ITEMS, PARTS].</p>

      <h2>7. Acceptable use</h2>
      <p>Do not misuse the service, attempt to gain unauthorised access, or use it for unlawful purposes.</p>

      <h2>8. Intellectual property</h2>
      <p>[OWNERSHIP OF SITE CONTENT, TRADEMARKS AND LICENCES].</p>

      <h2>9. Disclaimers and liability</h2>
      <p>[LIMITATION OF LIABILITY TO THE MAXIMUM EXTENT PERMITTED BY LAW].</p>

      <h2>10. Governing law and disputes</h2>
      <p>[GOVERNING LAW AND DISPUTE-RESOLUTION FORUM].</p>

      <h2>11. Changes</h2>
      <p>We may update these terms. Continued use after changes means you accept them.</p>

      <h2>12. Contact</h2>
      <p>[COMPANY LEGAL NAME], [REGISTERED ADDRESS] - [CONTACT EMAIL].</p>
    </div>
  );
}
