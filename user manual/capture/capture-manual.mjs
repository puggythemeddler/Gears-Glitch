import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.resolve(__dirname, "..", "screenshots");

const BASE_URL = process.env.MANUAL_BASE_URL || "http://localhost:3000";
const USERNAME = process.env.MANUAL_ADMIN_USERNAME || readEnv("ADMIN_USERNAME") || "admin";
const PASSWORD = process.env.MANUAL_ADMIN_PASSWORD || readEnv("ADMIN_PASSWORD");

if (!PASSWORD) {
  console.error("No ADMIN_PASSWORD found. Set MANUAL_ADMIN_PASSWORD or ADMIN_PASSWORD in the root .env.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Chapter / module map                                               */
/* ------------------------------------------------------------------ */

// group = sidebar group to expand. tabs = sub-view buttons inside the module.
const CHAPTERS = [
  {
    slug: "01-overview",
    title: "Overview",
    modules: [{ label: "Home", file: "dashboard", home: true }],
  },
  {
    slug: "02-sales",
    title: "Sales",
    modules: [
      { label: "Products", file: "products", group: "Sales" },
      { label: "Groups", file: "groups", group: "Sales" },
      { label: "Categories", file: "categories", group: "Sales" },
      { label: "Category Order", file: "category-order", group: "Sales" },
      { label: "Orders", file: "orders", group: "Sales" },
      { label: "Customers", file: "customers", group: "Sales" },
      { label: "Coupons", file: "coupons", group: "Sales" },
      { label: "Gift Cards", file: "gift-cards", group: "Sales" },
      { label: "Campaigns", file: "campaigns", group: "Sales" },
      { label: "Abandoned Carts", file: "abandoned-carts", group: "Sales" },
      { label: "Quotations", file: "quotations", group: "Sales" },
    ],
  },
  {
    slug: "03-services",
    title: "Services",
    modules: [
      {
        label: "Repairs",
        file: "repairs",
        group: "Services",
        tabs: [
          { label: "Tickets", file: "repairs-tickets" },
          { label: "Calendar", file: "repairs-calendar" },
          { label: "Page Content", file: "repairs-page-content" },
        ],
      },
    ],
  },
  {
    slug: "04-stock",
    title: "Stock",
    modules: [
      { label: "Stock on Hand", file: "stock-on-hand", group: "Stock" },
      { label: "Stock Transfers", file: "stock-transfers", group: "Stock" },
      { label: "Stock Take", file: "stock-take", group: "Stock" },
      { label: "Stock Control", file: "stock-control", group: "Stock" },
      { label: "Serial Numbers", file: "serials", group: "Stock" },
      { label: "Purchase Orders", file: "purchase-orders", group: "Stock" },
      { label: "Suppliers", file: "suppliers", group: "Stock" },
    ],
  },
  {
    slug: "05-team",
    title: "Team",
    modules: [
      { label: "Users", file: "users", group: "Team" },
      { label: "Roles", file: "roles", group: "Team" },
      { label: "Clients", file: "clients", group: "Team" },
      { label: "Branches", file: "branches", group: "Team" },
    ],
  },
  {
    slug: "06-finance",
    title: "Finance",
    modules: [
      { label: "Invoices", file: "invoices", group: "Finance" },
      { label: "Credit Notes", file: "credit-notes", group: "Finance" },
      { label: "Providers", file: "providers", group: "Finance" },
    ],
  },
  {
    slug: "07-activity",
    title: "Activity",
    modules: [
      {
        label: "Reports",
        file: "reports",
        group: "Activity",
        tabs: [
          { label: "Sales Report", file: "reports-sales" },
          { label: "Employee Sales", file: "reports-employee-sales" },
          { label: "Technician Performance", file: "reports-technician-performance" },
          { label: "Purchases", file: "reports-purchases" },
          { label: "Stock Summary", file: "reports-stock-summary" },
          { label: "Visitors", file: "reports-visitors" },
        ],
      },
      { label: "Messages", file: "messages", group: "Activity" },
      { label: "Reviews", file: "reviews", group: "Activity" },
      { label: "Audit Log", file: "audit-log", group: "Activity" },
    ],
  },
  {
    slug: "08-settings",
    title: "Settings",
    modules: [
      { label: "Store Info", file: "store-info", group: "Settings" },
      { label: "Payments", file: "payments", group: "Settings" },
      { label: "Compliance", file: "compliance", group: "Settings" },
      { label: "Delivery Fees", file: "delivery-fees", group: "Settings" },
      { label: "Content", file: "content", group: "Settings" },
      { label: "System", file: "system", group: "Settings" },
      { label: "Storefront", file: "storefront", group: "Settings" },
      { label: "Layout Builder", file: "layout-builder", group: "Settings", via: { module: "Storefront", button: "+ Build a Custom Layout" } },
      { label: "Product Positioning", file: "product-positioning", group: "Settings" },
      { label: "Email", file: "email-settings", group: "Settings" },
      { label: "WhatsApp", file: "whatsapp-settings", group: "Settings" },
      { label: "About Us", file: "about-us", group: "Settings" },
      { label: "Subscription Plans", file: "subscription-plans", group: "Settings" },
      { label: "Spec Templates", file: "spec-templates", group: "Settings" },
      { label: "Subscription", file: "subscription", group: "Settings" },
    ],
  },
  {
    slug: "09-help",
    title: "Help",
    modules: [{ label: "Help & Reference", file: "help", group: "Help" }],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function readEnv(key) {
  try {
    const raw = readFileSync(path.join(REPO_ROOT, ".env"), "utf8");
    const m = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    if (!m) return undefined;
    return m.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const manifest = { baseUrl: BASE_URL, capturedAt: new Date().toISOString(), chapters: [] };

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});
const page = await context.newPage();

const captured = [];
const skipped = [];

async function login() {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await page.waitForSelector(".auth-form", { timeout: 60000 });
      await page.fill(".auth-form .field input", USERNAME);
      await page.fill('.auth-form input[type="password"]', PASSWORD);
      await page.click('.auth-form button[type="submit"]');
      await page.waitForSelector(".dash-nav", { timeout: 90000 });
      // Let feature flags + dashboard data settle before the first capture.
      await page.waitForTimeout(3000);
      return;
    } catch (e) {
      if (attempt === 4) throw e;
      console.log(`  login attempt ${attempt} failed (${e.message.split("\n")[0]}), retrying in 8s …`);
      await page.waitForTimeout(8000);
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }
}

async function openGroup(group) {
  if (!group) return true;
  const groupLabel = page.locator(".dash-nav-group-label", { hasText: group });
  if ((await groupLabel.count()) === 0) return false;
  const expanded = (await groupLabel.first().getAttribute("aria-expanded")) === "true";
  if (!expanded) {
    await groupLabel.first().click();
    await page.waitForTimeout(350);
  }
  return true;
}

async function clickModule(mod) {
  if (mod.home) {
    const home = page.locator(".dash-nav-home");
    if ((await home.count()) === 0) return false;
    await home.click();
    return true;
  }
  const item = page.locator(".dash-nav-item", {
    has: page.locator(".dash-nav-item-label", { hasText: new RegExp(`^${escapeRegExp(mod.label)}$`) }),
  });
  if ((await item.count()) === 0) return false;
  await item.first().click();
  return true;
}

async function shoot(chapterDir, file) {
  const section = page.locator(".dash-section.active").first();
  await section.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2200);
  const out = path.join(chapterDir, `${file}.png`);
  await section.screenshot({ path: out, animations: "disabled" });
  return out;
}

try {
  console.log(`Logging in to ${BASE_URL}/admin as ${USERNAME} …`);
  await login();
  console.log("Logged in.\n");

  for (const chapter of CHAPTERS) {
    const chapterDir = path.join(OUT_DIR, chapter.slug);
    mkdirSync(chapterDir, { recursive: true });
    const chapterManifest = { slug: chapter.slug, title: chapter.title, modules: [] };
    console.log(`== ${chapter.title} ==`);

    for (const mod of chapter.modules) {
      if (mod.group && !(await openGroup(mod.group))) {
        skipped.push(`${chapter.slug}/${mod.file} (group "${mod.group}" not found)`);
        console.log(`  SKIP ${mod.label} (group not found)`);
        continue;
      }

      if (mod.via) {
        const viaMod = { label: mod.via.module, group: mod.group };
        const viaOpened = await clickModule(viaMod);
        if (!viaOpened) {
          skipped.push(`${chapter.slug}/${mod.file} (via module "${mod.via.module}" not found)`);
          console.log(`  SKIP ${mod.label} (via module not found)`);
          continue;
        }
        await page.waitForTimeout(1800);
        const btn = page.locator(".dash-section.active button", { hasText: mod.via.button }).first();
        if ((await btn.count()) === 0) {
          skipped.push(`${chapter.slug}/${mod.file} (via button "${mod.via.button}" not found)`);
          console.log(`  SKIP ${mod.label} (via button not found)`);
          continue;
        }
        await btn.click();
      } else {
        const opened = await clickModule(mod);
        if (!opened) {
          skipped.push(`${chapter.slug}/${mod.file} (nav item not found — feature-gated or admin-only)`);
          console.log(`  SKIP ${mod.label} (nav item not found)`);
          continue;
        }
      }

      const shots = [];
      try {
        shots.push(await shoot(chapterDir, mod.file));
      } catch (e) {
        skipped.push(`${chapter.slug}/${mod.file} (capture failed: ${e.message})`);
        console.log(`  FAIL ${mod.label} (${e.message})`);
        continue;
      }

      if (Array.isArray(mod.tabs)) {
        for (const tab of mod.tabs) {
          try {
            const btn = page.locator(".dash-section.active button", { hasText: tab.label }).first();
            if ((await btn.count()) === 0) continue;
            await btn.click();
            await page.waitForTimeout(1800);
            shots.push(await shoot(chapterDir, tab.file));
          } catch {
            /* tab may be gated (e.g. Repairs Page Content for non-admin) */
          }
        }
      }

      captured.push(...shots);
      console.log(`  OK  ${mod.label} → ${shots.map((s) => path.basename(s)).join(", ")}`);
      chapterManifest.modules.push({ label: mod.label, shots: shots.map((s) => path.relative(OUT_DIR, s).replace(/\\/g, "/")) });
    }

    manifest.chapters.push(chapterManifest);
    console.log();
  }

  writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
} catch (err) {
  console.error("\nCapture failed:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

console.log(`Captured ${captured.length} screenshots.`);
if (skipped.length) {
  console.log(`Skipped/failed ${skipped.length}:`);
  for (const s of skipped) console.log(`  - ${s}`);
}
