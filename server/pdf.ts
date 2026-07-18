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

export async function htmlToPdf(html: string, options?: { format?: string; landscape?: boolean }): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
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
