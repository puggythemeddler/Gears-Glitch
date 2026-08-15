import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browserInstance: any = null;

async function getBrowser(): Promise<any> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  const cr = (chromium as any).default || chromium;
  browserInstance = await puppeteer.launch({
    args: cr.args || ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: null,
    executablePath: await cr.executablePath(),
    headless: true,
  });
  return browserInstance;
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
                  const timer = setTimeout(() => { settled = true; resolve(); }, 10000);
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
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}
