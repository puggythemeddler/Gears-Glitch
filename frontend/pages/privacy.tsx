import React, { useEffect, useState } from "react";

// =============================================================================
// DRAFT PRIVACY POLICY - NOT LEGAL ADVICE, NOT YET REVIEWED.
//
// This page is a starting template only. Every [BRACKETED] field must be filled
// in, and the whole document must be reviewed by a qualified legal
// professional before it is relied upon or advertised as compliant with any
// law (e.g. the Kenya Data Protection Act 2019, GDPR, or any other regime).
// The wording below is deliberately generic and makes no compliance claim.
//
// See LEGAL_REVIEW_REQUIRED.md in the repository root.
// =============================================================================

export default function PrivacyPolicyPage() {
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
          <li><span aria-current="page">Privacy Policy</span></li>
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

      <h1>Privacy Policy</h1>
      <p><em>Last updated: [EFFECTIVE DATE].</em></p>

      <p>
        This policy describes how <strong>[COMPANY LEGAL NAME]</strong> ("we", "us"),
        trading as <strong>{storeName}</strong>, handles personal data when you use
        this website or our services.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Data controller: [COMPANY LEGAL NAME], [REGISTERED ADDRESS], [COUNTRY].
        Contact for privacy matters: [PRIVACY CONTACT EMAIL] / [PHONE].
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li>Account and contact details you provide (name, email, phone number, delivery address).</li>
        <li>Order, repair and payment-related records (M-Pesa references, invoices).</li>
        <li>Communications you send us (including WhatsApp messages, where you have opted in).</li>
        <li>Technical data such as IP address, device/browser type, and pages viewed.</li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To create and manage your account and fulfil orders and repairs.</li>
        <li>To send order, repair and service updates (including by WhatsApp where you have opted in).</li>
        <li>To provide support, prevent fraud, and meet legal and tax obligations.</li>
        <li>To improve and secure the service.</li>
      </ul>

      <h2>4. Legal bases</h2>
      <p>
        [SPECIFY THE LEGAL BASIS FOR EACH PURPOSE UNDER THE APPLICABLE LAW - e.g.
        contract performance, consent, legitimate interests, legal obligation.]
      </p>

      <h2>5. Sharing</h2>
      <p>
        We share data only with service providers that help us operate (for example
        hosting, payment, delivery and messaging providers) and where required by law.
        Current categories of recipients: [LIST RECIPIENTS / CATEGORIES].
      </p>

      <h2>6. Retention</h2>
      <p>We keep personal data only as long as necessary for the purposes above: [RETENTION PERIODS].</p>

      <h2>7. Your rights</h2>
      <p>
        Depending on your location you may have rights to access, correct, delete,
        restrict or object to processing, and to data portability. To exercise them,
        contact [PRIVACY CONTACT EMAIL]. [SET OUT COMPLAINT ROUTE TO THE RELEVANT AUTHORITY.]
      </p>

      <h2>8. Security</h2>
      <p>
        We use technical and organisational measures to protect personal data. No
        method of transmission or storage is completely secure.
      </p>

      <h2>9. Cookies</h2>
      <p>
        We use cookies and similar technologies. See the cookie banner on this site
        for choices, and [COOKIE POLICY LINK OR SECTION].
      </p>

      <h2>10. Changes</h2>
      <p>We may update this policy. Material changes will be notified as required by law.</p>

      <h2>11. Contact</h2>
      <p>[COMPANY LEGAL NAME], [REGISTERED ADDRESS] - [PRIVACY CONTACT EMAIL].</p>
    </div>
  );
}
