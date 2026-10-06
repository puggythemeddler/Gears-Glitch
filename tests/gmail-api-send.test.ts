import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// The connected Gmail account used to send through nodemailer's SMTP transport,
// which fails on Render with "Connection timeout" because outbound SMTP is
// blocked: the token refresh (HTTPS) succeeded, so Test connection reported
// healthy while every real send failed. Sending now goes through the Gmail REST
// API over HTTPS. These tests pin the RFC 5322 message that API requires, the
// header-injection guards around store-supplied strings, and the absence of the
// SMTP path that could silently come back.
import { buildGmailRawMessage, parseGmailAddress } from "../server/gmail";

const GMAIL_SRC = path.join(__dirname, "..", "server", "gmail.ts");

function decodeBody(raw: string): string {
  const [, body] = raw.split("\r\n\r\n");
  return Buffer.from(body, "base64").toString("utf8");
}

describe("Gmail REST send message", () => {
  it('formats a named From: as an address and encodes a non-ASCII store name', () => {
    const raw = buildGmailRawMessage({
      from: '"Gears&Glitch" <shop@example.com>',
      to: "customer@example.com",
      subject: "Your order #12",
      html: "<p>Hi</p>",
    });
    assert.match(raw, /^From: Gears&Glitch <shop@example\.com>\r\n/);
    assert.match(raw, /\r\nTo: customer@example\.com\r\n/);
  });

  it("encodes the store name as an RFC 2047 word when it is non-ASCII", () => {
    const raw = buildGmailRawMessage({
      from: '"Café Kiarie" <shop@example.com>',
      to: "customer@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });
    const expected = `=?UTF-8?B?${Buffer.from("Café Kiarie", "utf8").toString("base64")}?=`;
    assert.ok(raw.includes(`From: ${expected} <shop@example.com>`), `expected encoded word, got: ${raw.split("\r\n")[0]}`);
  });

  it("encodes a non-ASCII subject rather than sending raw 8-bit headers", () => {
    const raw = buildGmailRawMessage({
      from: "shop@example.com",
      to: "customer@example.com",
      subject: "You left items in your cart 🛒",
      html: "<p>Hi</p>",
    });
    const subjectLine = raw.split("\r\n").find((l) => l.startsWith("Subject: ")) as string;
    assert.match(subjectLine, /^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  });

  it("declares HTML and round-trips the body through base64", () => {
    const html = "<p>Order <b>#7</b> is ready —  Nairobi</p>";
    const raw = buildGmailRawMessage({ from: "shop@example.com", to: "customer@example.com", subject: "Ready", html });
    assert.match(raw, /\r\nContent-Type: text\/html; charset="UTF-8"\r\n/);
    assert.match(raw, /\r\nContent-Transfer-Encoding: base64\r\n\r\n/);
    assert.equal(decodeBody(raw), html);
  });

  it("strips CR/LF from store-supplied values so a setting cannot inject headers", () => {
    const raw = buildGmailRawMessage({
      from: "Shop\r\nBcc: attacker@example.com",
      to: "customer@example.com",
      subject: "Hi\r\nBcc: attacker@example.com",
      html: "<p>Hi</p>",
    });
    assert.ok(!/^Bcc:/m.test(raw), "a Bcc header was injected");
    assert.equal(raw.split("\r\n").filter((l) => l.startsWith("To: ")).length, 1);
    assert.equal(raw.split("\r\n").filter((l) => l.startsWith("Subject: ")).length, 1);
  });

  it("accepts multiple recipients and rejects an empty recipient list", () => {
    const raw = buildGmailRawMessage({
      from: "shop@example.com",
      to: ["a@example.com", "B <b@example.com>"],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
    assert.match(raw, /\r\nTo: a@example\.com, b@example\.com\r\n/);
    assert.throws(() => buildGmailRawMessage({ from: "shop@example.com", to: [], subject: "Hi", html: "x" }), /at least one recipient/);
  });

  it("parses quoted, bare and display-name address forms", () => {
    assert.deepEqual(parseGmailAddress('"Shop Name" <a@b.com>'), { name: "Shop Name", email: "a@b.com" });
    assert.deepEqual(parseGmailAddress("plain@example.com"), { name: "", email: "plain@example.com" });
    assert.deepEqual(parseGmailAddress("  spaced@example.com "), { name: "", email: "spaced@example.com" });
  });
});

describe("Gmail send transport", () => {
  it("no longer builds a nodemailer SMTP transport", () => {
    const src = fs.readFileSync(GMAIL_SRC, "utf8");
    assert.ok(!/service:\s*"gmail"/.test(src), "the SMTP transport came back");
    assert.ok(!/createTransport/.test(src), "gmail.ts builds a transport again");
    assert.ok(!/require\("nodemailer"\)/.test(src), "gmail.ts depends on nodemailer again");
  });

  it("sends over the Gmail REST API", () => {
    const src = fs.readFileSync(GMAIL_SRC, "utf8");
    assert.ok(src.includes("gmail.googleapis.com/gmail/v1/users/me/messages/send"));
    // The refresh endpoint is HTTPS, which is why the connection test passed
    // while the SMTP send timed out; both must stay on HTTPS.
    assert.ok(src.includes("https://oauth2.googleapis.com/token"));
  });

  it("keeps the nodemailer-shaped sendMail contract the call sites rely on", () => {
    const src = fs.readFileSync(GMAIL_SRC, "utf8");
    assert.match(src, /async sendMail\(/);
    // A revoked/stale access token is retried once, then propagates so email.ts
    // can fail over to SMTP. The check matches the literal "(401)" that the
    // thrown error carries, so the pattern itself is escaped in the source.
    assert.ok(src.includes("/\\(401\\)/"), "the one-shot 401 retry is gone");
    assert.ok(src.includes("refreshGmailAccessToken(creds)"), "the retry must mint a fresh token");
  });
});