import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import net from "net";
import fs from "fs";
import path from "path";

// The notification queue records delivery outcomes correctly, but with no
// transport configured sendEmail() returns false for everything and nothing is
// ever delivered - the "No email transport configured. Would send to=..."
// line in the logs. These tests pin the provider selection, prove a real SMTP
// conversation succeeds end to end, and prove the retry/dead-letter path
// records failures.
//
// A throwaway SMTP server is started on a loopback port so delivery is
// genuinely exercised (nodemailer really speaks SMTP) without needing
// credentials, a network, or an external provider.
import { getPool, query, queryOne, runSchema } from "../server/db-helpers";

const HAS_DB = !!process.env.DATABASE_URL;

const SAVED_ENV = [
  "EMAIL_PROVIDER", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER",
  "SMTP_PASS", "SMTP_PASSWORD", "FROM_EMAIL", "EMAIL_FROM",
];

interface Captured {
  messages: Array<{ from: string; to: string; data: string }>;
  authAttempts: Array<{ user: string; pass: string }>;
  failNext: boolean;
}

interface FakeSmtp {
  port: number;
  captured: Captured;
  close: () => Promise<void>;
}

// A deliberately small SMTP server: greeting, EHLO/AUTH/MAIL/RCPT/DATA/QUIT.
async function startFakeSmtp(): Promise<FakeSmtp> {
  const captured: Captured = { messages: [], authAttempts: [], failNext: false };
  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    let inData = false;
    let buffer = "";
    let current = { from: "", to: "", data: "" };
    // SMTP AUTH state machine: "" | "plain" | "username" | "password".
    let authStep = "";
    let pendingUser = "";

    const write = (line: string) => { if (!socket.destroyed) socket.write(line + "\r\n"); };
    const decode = (token: string): string => {
      try { return Buffer.from(token, "base64").toString("utf8"); } catch { return ""; }
    };
    const finishAuth = (user: string, pass: string) => {
      captured.authAttempts.push({ user, pass });
      write("235 2.7.0 Authentication successful");
    };
    // AUTH PLAIN carries "\0user\0pass" in one token.
    const finishPlainAuth = (token: string) => {
      const parts = decode(token).split("\0");
      finishAuth(parts[1] || "", parts.slice(2).join("\0"));
    };
    // AUTH LOGIN is a two-step challenge: username, then password.
    const askPassword = (userToken: string) => {
      pendingUser = decode(userToken);
      authStep = "password";
      write("334 " + Buffer.from("Password:", "utf8").toString("base64"));
    };

    write("220 fake.smtp.test ESMTP ready");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        if (inData) {
          if (line === ".") {
            inData = false;
            if (captured.failNext) {
              captured.failNext = false;
              write("554 5.3.0 simulated delivery failure");
            } else {
              captured.messages.push(current);
              write("250 2.0.0 Ok: queued");
            }
            current = { from: "", to: "", data: "" };
          } else {
            current.data += line + "\n";
          }
          continue;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          write("250-fake.smtp.test");
          write("250-AUTH PLAIN LOGIN");
          write("250 8BITMIME");
        } else if (upper.startsWith("AUTH PLAIN")) {
          const token = line.slice("AUTH PLAIN".length).trim();
          if (!token) { authStep = "plain"; write("334 "); }
          else finishPlainAuth(token);
        } else if (upper.startsWith("AUTH LOGIN")) {
          const token = line.slice("AUTH LOGIN".length).trim();
          authStep = "username";
          if (!token) write("334 " + Buffer.from("Username:", "utf8").toString("base64"));
          else askPassword(token);
        } else if (authStep) {
          // A bare credential line continuing the AUTH exchange.
          if (authStep === "plain") finishPlainAuth(line.trim());
          else if (authStep === "username") askPassword(line.trim());
          else if (authStep === "password") {
            finishAuth(pendingUser, decode(line.trim()));
            authStep = "";
            pendingUser = "";
          }
        } else if (upper.startsWith("MAIL FROM")) {
          current.from = (line.match(/<([^>]*)>/) || [])[1] || "";
          write("250 2.1.0 Ok");
        } else if (upper.startsWith("RCPT TO")) {
          current.to = (line.match(/<([^>]*)>/) || [])[1] || "";
          write("250 2.1.5 Ok");
        } else if (upper.startsWith("DATA")) {
          inData = true;
          write("354 End data with <CR><LF>.<CR><LF>");
        } else if (upper.startsWith("RSET")) {
          current = { from: "", to: "", data: "" };
          write("250 2.0.0 Ok");
        } else if (upper.startsWith("QUIT")) {
          write("221 2.0.0 Bye");
          socket.end();
        } else {
          write("250 2.0.0 Ok");
        }
      }
    });
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;

  return {
    port,
    captured,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe("email transport configuration", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let smtp: FakeSmtp;

  before(async () => {
    getPool();
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    smtp = await startFakeSmtp();
  });

  after(async () => {
    await smtp.close();
  });

  beforeEach(async () => {
    for (const k of SAVED_ENV) delete process.env[k];
    smtp.captured.messages = [];
    smtp.captured.authAttempts = [];
    smtp.captured.failNext = false;
    // The store's From: setting wins over EMAIL_FROM, so start from a clean slate
    // (a reused test database may still carry it from an earlier run).
    await query(`DELETE FROM settings WHERE key = 'emailSender'`);
    // Imported lazily so the module-level transporter cache can be reset.
    const { resetTransporter } = await import("../server/email");
    resetTransporter();
  });

  async function loadEmail() {
    const mod = await import("../server/email");
    mod.resetTransporter();
    return mod;
  }

  it("is unconfigured by default and the app still works", async () => {
    const { emailTransportStatus, sendEmail } = await loadEmail();
    const status = await emailTransportStatus();
    assert.equal(status.configured, false);
    assert.equal(status.provider, "auto");
    assert.equal(status.active, null);
    assert.match(status.detail, /smtp missing/);

    // No transport must degrade to the log, not throw.
    assert.equal(await sendEmail("nobody@example.com", "Subject", "<p>hi</p>", "test"), false);
  });

  it("EMAIL_PROVIDER=none disables delivery explicitly", async () => {
    process.env.EMAIL_PROVIDER = "none";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = "should-not-be-used";
    const { emailTransportStatus, sendEmail } = await loadEmail();
    const status = await emailTransportStatus();
    assert.equal(status.provider, "none");
    assert.equal(status.configured, false);
    assert.match(status.detail, /EMAIL_PROVIDER=none/);
    assert.equal(await sendEmail("nobody@example.com", "Subject", "<p>hi</p>", "test"), false);
    assert.equal(smtp.captured.messages.length, 0, "nothing may be sent when disabled");
  });

  it("reports the exact missing variables without printing any secret", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    const { emailTransportStatus } = await loadEmail();
    const status = await emailTransportStatus();
    assert.equal(status.configured, false);
    assert.match(status.detail, /SMTP_HOST/);
    assert.match(status.detail, /SMTP_USER/);
    assert.match(status.detail, /SMTP_PASSWORD\/SMTP_PASS/);
  });

  it("accepts SMTP_PASSWORD as well as SMTP_PASS, and never echoes either", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_USER = "mailer@example.com";
    const secret = "sup3r-s3cret-value";
    process.env.SMTP_PASSWORD = secret;

    const { emailTransportStatus } = await loadEmail();
    const status = await emailTransportStatus();
    assert.equal(status.configured, true);
    assert.equal(status.active, "smtp");
    const serialised = JSON.stringify(status);
    assert.ok(!serialised.includes(secret), "the status object must not contain the password");
    assert.ok(!status.detail.includes(secret));

    // SMTP_PASS alias still works.
    delete process.env.SMTP_PASSWORD;
    process.env.SMTP_PASS = secret;
    (await loadEmail()).resetTransporter();
    assert.equal((await emailTransportStatus()).configured, true);
  });

  it("delivers real mail over SMTP and records the success", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_SECURE = "0";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = "fake-password";
    process.env.EMAIL_FROM = "shop@example.com";

    const { sendEmail } = await loadEmail();
    const ok = await sendEmail("customer@example.com", "Order received", "<p>Thanks!</p>", "order.placed");
    assert.equal(ok, true, "a delivered message must report success");

    assert.equal(smtp.captured.messages.length, 1);
    const msg = smtp.captured.messages[0];
    assert.equal(msg.to, "customer@example.com");
    assert.equal(msg.from, "shop@example.com", "EMAIL_FROM is the default From: address");
    assert.match(msg.data, /Order received/);
    assert.match(msg.data, /Thanks!/);

    // And it is persisted to the delivery log.
    const log = await queryOne(
      `SELECT status, to_email, from_email FROM email_logs WHERE to_email = $1 ORDER BY id DESC LIMIT 1`,
      ["customer@example.com"]
    );
    assert.equal(log.status, "sent");
    assert.equal(log.from_email, "shop@example.com");
  });

  it("records a failure when the SMTP server rejects the message", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = "fake-password";
    process.env.EMAIL_FROM = "shop@example.com";

    const { sendEmail } = await loadEmail();
    smtp.captured.failNext = true;
    const ok = await sendEmail("customer@example.com", "Will fail", "<p>x</p>", "order.placed");
    assert.equal(ok, false, "a rejected message must report failure");

    const log = await queryOne(
      `SELECT status FROM email_logs WHERE to_email = $1 ORDER BY id DESC LIMIT 1`,
      ["customer@example.com"]
    );
    assert.equal(log.status, "failed");
    assert.equal(smtp.captured.messages.length, 0, "nothing is delivered when the server rejects it");
  });

  it("records a failure when the SMTP host is unreachable", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    // Nothing is listening here.
    process.env.SMTP_PORT = "1";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = "fake-password";
    const { sendEmail } = await loadEmail();
    assert.equal(await sendEmail("customer@example.com", "Unreachable", "<p>x</p>", "order.placed"), false);
    const log = await queryOne(
      `SELECT status FROM email_logs WHERE to_email = $1 ORDER BY id DESC LIMIT 1`,
      ["customer@example.com"]
    );
    assert.equal(log.status, "failed");
  });

  it("authenticates as SMTP_USER, not as the store's From: address", async () => {
    // The transport used to fall back to settings.emailSender for the SMTP
    // username, which is a From: address and not an SMTP account.
    await query(
      `INSERT INTO settings (key, value) VALUES ('emailSender', 'store-from@example.com')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_USER = "smtp-account@example.com";
    process.env.SMTP_PASSWORD = "fake-password";

    const { sendEmail } = await loadEmail();
    assert.equal(await sendEmail("customer@example.com", "Auth check", "<p>x</p>", "order.placed"), true);
    assert.equal(smtp.captured.messages.length, 1);
    assert.equal(smtp.captured.messages[0].from, "store-from@example.com", "settings still decide the From: address");
    assert.ok(
      smtp.captured.authAttempts.some((a) => a.user === "smtp-account@example.com"),
      "the SMTP session must authenticate as SMTP_USER"
    );
    assert.ok(
      !smtp.captured.authAttempts.some((a) => a.user === "store-from@example.com"),
      "the From: address must never be used as the SMTP username"
    );
    await query(`DELETE FROM settings WHERE key = 'emailSender'`);
  });

  it("never persists SMTP credentials to the database", async () => {
    const secret = "do-not-persist-me";
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = secret;

    const { sendEmail } = await loadEmail();
    await sendEmail("customer@example.com", "Credential check", "<p>x</p>", "order.placed");

    // Nothing in settings, notification logs or the delivery log may contain it.
    const settings = await queryOne(
      `SELECT count(*)::int AS n FROM settings WHERE value LIKE '%' || $1 || '%'`, [secret]
    );
    assert.equal(settings.n, 0, "SMTP credentials must never be written to settings");

    const logs = await queryOne(
      `SELECT count(*)::int AS n FROM email_logs
       WHERE COALESCE(body_html,'') LIKE '%' || $1 || '%' OR COALESCE(error_message,'') LIKE '%' || $1 || '%'`,
      [secret]
    );
    assert.equal(logs.n, 0, "SMTP credentials must never reach the email log");
  });
});

// The transport is only half the story: the point of the queue is that a
// delivery actually goes out and that the outcome is recorded. These drive the
// real drain against the fake SMTP server.
describe("notification queue delivers through SMTP", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  let smtp: FakeSmtp;
  let runId: string;

  before(async () => {
    getPool();
    await runSchema(fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8"));
    smtp = await startFakeSmtp();
  });

  after(async () => {
    await smtp.close();
  });

  beforeEach(async () => {
    for (const k of SAVED_ENV) delete process.env[k];
    smtp.captured.messages = [];
    smtp.captured.authAttempts = [];
    smtp.captured.failNext = false;
    runId = `et-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await query(`DELETE FROM notification_deliveries`);
    await query(`DELETE FROM settings WHERE key = 'emailSender'`);

    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASSWORD = "fake-password";
    process.env.EMAIL_FROM = "shop@example.com";
    const { resetTransporter } = await import("../server/email");
    resetTransporter();
  });

  async function enqueue(opts: { maxAttempts?: number; recipient?: string } = {}) {
    const { enqueueDelivery } = await import("../server/integrations-store");
    const recipient = opts.recipient || `${runId}@example.com`;
    await enqueueDelivery({
      eventId: `${runId}-${Math.random().toString(36).slice(2, 7)}`,
      eventType: "order.placed",
      channel: "email",
      audience: "customer",
      entityType: "order",
      entityId: "1",
      recipient,
      subject: "Order received",
      payload: JSON.stringify({ orderNumber: "ORD-1", total: "1000" }),
      maxAttempts: opts.maxAttempts ?? 5,
    } as any);
    return recipient;
  }

  const onlyRow = () => queryOne(`SELECT * FROM notification_deliveries LIMIT 1`);

  it("processes a queued email and records the successful delivery", async () => {
    const { drainNotificationQueueOnce } = await import("../server/notification-service");
    const recipient = await enqueue();

    const counters = await drainNotificationQueueOnce();
    assert.equal(counters.processed, 1);
    assert.equal(counters.sent, 1);
    assert.equal(counters.failed, 0);
    assert.equal(counters.dead, 0);

    assert.equal(smtp.captured.messages.length, 1, "the message must actually leave the process");
    assert.equal(smtp.captured.messages[0].to, recipient);

    const row = await onlyRow();
    assert.equal(row.status, "sent");
    assert.ok(row.sent_at, "a delivered row records when it was sent");
    assert.equal(row.attempts, 1);
    assert.equal(row.last_error, null);

    const log = await queryOne(
      `SELECT status FROM email_logs WHERE to_email = $1 ORDER BY id DESC LIMIT 1`, [recipient]
    );
    assert.equal(log.status, "sent");
  });

  it("records a failed delivery and schedules a retry instead of losing it", async () => {
    const { drainNotificationQueueOnce } = await import("../server/notification-service");
    await enqueue();
    smtp.captured.failNext = true;

    const counters = await drainNotificationQueueOnce();
    assert.equal(counters.failed, 1);
    assert.equal(counters.sent, 0);

    const row = await onlyRow();
    assert.equal(row.status, "failed");
    assert.equal(row.attempts, 1);
    assert.ok(row.last_error, "the failure reason must be recorded");
    assert.ok(
      new Date(row.next_attempt_at as string).getTime() > Date.now(),
      "a failed delivery must be rescheduled into the future, not dropped"
    );
    assert.equal(row.sent_at, null);
  });

  it("retries a failed delivery and succeeds once the provider recovers", async () => {
    const { drainNotificationQueueOnce } = await import("../server/notification-service");
    const recipient = await enqueue();

    smtp.captured.failNext = true;
    await drainNotificationQueueOnce();
    assert.equal((await onlyRow()).status, "failed");

    // Make the queued row due again, as the passage of backoff time would.
    await query(`UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '1 second'`);

    const retry = await drainNotificationQueueOnce();
    assert.equal(retry.sent, 1);
    const row = await onlyRow();
    assert.equal(row.status, "sent");
    assert.equal(row.attempts, 2, "the retry is counted");
    assert.ok(row.sent_at);
    assert.equal(smtp.captured.messages.length, 1);
    assert.equal(smtp.captured.messages[0].to, recipient);
  });

  it("dead-letters after max_attempts and keeps the row diagnosable", async () => {
    const { drainNotificationQueueOnce } = await import("../server/notification-service");
    await enqueue({ maxAttempts: 1 });
    smtp.captured.failNext = true;

    const counters = await drainNotificationQueueOnce();
    assert.equal(counters.dead, 1);

    const row = await onlyRow();
    assert.equal(row.status, "dead");
    assert.equal(row.attempts, 1);
    assert.ok(row.last_error, "a dead row must say why it died");
    // The dead-letter update used to violate next_attempt_at's NOT NULL, which
    // rolled the whole tick back and left deliveries pending forever.
    assert.notEqual(row.next_attempt_at, null, "the existing schedule must be preserved, not nulled");
  });

  it("does not retry a dead row", async () => {
    const { drainNotificationQueueOnce } = await import("../server/notification-service");
    await enqueue({ maxAttempts: 1 });
    smtp.captured.failNext = true;
    await drainNotificationQueueOnce();
    assert.equal((await onlyRow()).status, "dead");

    await query(`UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '1 second'`);
    const again = await drainNotificationQueueOnce();
    assert.equal(again.processed, 0, "a dead delivery is terminal until an operator requeues it");
    assert.equal(smtp.captured.messages.length, 0);
  });

  it("stops retrying once max_attempts is reached", async () => {
    // The regression: attempts was never persisted, so it stayed 0, the
    // "attemptsAfter >= maxAttempts" check could never fire and a permanently
    // failing notification was retried forever.
    const { drainNotificationQueueOnce } = await import("../server/notification-service");
    await enqueue({ maxAttempts: 3 });

    const statuses: string[] = [];
    for (let i = 0; i < 5; i++) {
      smtp.captured.failNext = true;
      await drainNotificationQueueOnce();
      const row = await onlyRow();
      statuses.push(`${row.status}:${row.attempts}`);
      if (row.status === "dead") break;
      // Skip the backoff wait so the loop does not idle.
      await query(`UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '1 second'`);
    }

    const row = await onlyRow();
    assert.equal(row.status, "dead", `expected dead-lettering, saw ${statuses.join(" -> ")}`);
    assert.equal(row.attempts, 3, `the counter must reach max_attempts, saw ${statuses.join(" -> ")}`);
  });
});