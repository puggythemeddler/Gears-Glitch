import React from "react";

export default function ContactPage() {
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Contact</span></li>
        </ol>
      </nav>
      <h1>Contact us</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        <div className="panel">
          <h2>Get in touch</h2>
          <p>Have a question about our products or services? Reach out to us and we'll get back to you as soon as possible.</p>
          <p><strong>Email:</strong> info@gearandglitch.com</p>
          <p><strong>Phone:</strong> +254 700 000 000</p>
          <p><strong>Location:</strong> Nairobi, Kenya</p>
        </div>
        <div className="panel">
          <h2>Send a message</h2>
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); alert("Message sent! (demo)"); }}>
            <div className="field">
              <label htmlFor="contactName">Name</label>
              <input id="contactName" required />
            </div>
            <div className="field">
              <label htmlFor="contactEmail">Email</label>
              <input id="contactEmail" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="contactMsg">Message</label>
              <textarea id="contactMsg" rows={4} required />
            </div>
            <button type="submit" className="btn">Send message</button>
          </form>
        </div>
      </div>
    </>
  );
}
