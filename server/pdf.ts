import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browserInstance: any = null;
let browserLaunch: Promise<any> | null = null;

async function getBrowser(): Promise<any> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  // warmPdf() runs at boot and a user can request a PDF before it finishes.
  // Share the extraction/launch promise so @sparticuz/chromium never inflates
  // its executable concurrently into /tmp (which can make spawn fail ETXTBSY).
  if (!browserLaunch) {
    browserLaunch = (async () => {
      const cr = (chromium as any).default || chromium;
      const executablePath = await cr.executablePath();
      const browser = await puppeteer.launch({
        args: cr.args || ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: null,
        executablePath,
        headless: true,
      });
      browserInstance = browser;
      browser.once("disconnected", () => {
        if (browserInstance === browser) browserInstance = null;
      });
      return browser;
    })().finally(() => {
      browserLaunch = null;
    });
  }
  return browserLaunch;
}

// Warm the headless browser at boot so the first PDF request doesn't pay the
// (several-second) Chromium launch cost on Render's free tier.
export async function warmPdf(): Promise<void> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent("<!DOCTYPE html><html><body></body></html>", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.close();
  } catch (e: any) {
    console.warn("[pdf] Warm-up failed:", e?.message || e);
  }
}

export async function htmlToPdf(html: string, options?: { format?: string; landscape?: boolean }): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images).map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  let settled = false;
                  const timer = setTimeout(() => { settled = true; resolve(); }, 3000);
                  const done = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                })
        )
      )
    );
    const pdf = await page.pdf({
      format: (options?.format as any) || "A4",
      landscape: options?.landscape || false,
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserLaunch) await browserLaunch.catch(() => undefined);
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}
