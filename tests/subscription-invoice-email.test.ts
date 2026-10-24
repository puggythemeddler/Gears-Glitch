import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { subscriptionInvoiceEmail } from "../server/email";

describe("subscription renewal invoice email", () => {
  it("shows the test billing period due date and safely escapes invoice details", () => {
    const email = subscriptionInvoiceEmail(
      "Test <Client>",
      "SUB-INV-TEST-001",
      "Growth & Pro",
      "4,999",
      "KES",
      "2026-10-31",
      "https://test.example.com/admin"
    );

    assert.match(email.subject, /SUB-INV-TEST-001/);
    assert.match(email.html, /Due Date:<\/strong> 2026-10-31/);
    assert.match(email.html, /KES 4,999/);
    assert.match(email.html, /Test &lt;Client&gt;/);
    assert.match(email.html, /Growth &amp; Pro/);
    assert.doesNotMatch(email.html, /Test <Client>/);
  });
});
