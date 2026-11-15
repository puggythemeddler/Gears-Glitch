export type SupplierInvoiceLine = {
  id: string;
  sku: string;
  description: string;
  quantity: string;
  unitCost: string;
  lineTotal: string;
  rawLine: string;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 8;
const MAX_PAGE_PIXELS = 4_000_000;
const MAX_IMAGE_PIXELS = 60_000_000;

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => bytes[i] === byte);
}

function canvasFor(width: number, height: number) {
  const pixels = width * height;
  if (!Number.isFinite(pixels) || pixels <= 0 || pixels > MAX_PAGE_PIXELS) {
    throw new Error("This page is too large to process safely. Try a lower-resolution scan or split the document.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: false });
  if (!context) throw new Error("Your browser could not prepare the document page for scanning.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

async function recognizeCanvas(canvas: HTMLCanvasElement, progress?: (value: number) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    gzip: true,
    logger: (event: { status?: string; progress?: number }) => {
      if (event.status === "recognizing text" && Number.isFinite(event.progress)) progress?.(event.progress || 0);
    },
  });
  try {
    const result = await worker.recognize(canvas);
    return result.data.text || "";
  } finally {
    await worker.terminate();
  }
}

async function readPdf(bytes: Uint8Array, progress?: (value: number) => void) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({
    data: bytes,
    enableXfa: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    maxImageSize: MAX_PAGE_PIXELS,
    stopAtErrors: true,
  });
  const pdf = await task.promise;
  try {
    // Invoice OCR needs page text and pixels only. Reject embedded files and
    // document JavaScript rather than carrying those features into processing.
    const [attachments, javaScriptActions] = await Promise.all([
      pdf.getAttachments(),
      pdf.getJSActions(),
    ]);
    if (attachments && attachments.size > 0) {
      throw new Error("This PDF contains embedded files. Remove them and scan a clean invoice PDF.");
    }
    if (javaScriptActions && javaScriptActions.size > 0) {
      throw new Error("This PDF contains JavaScript actions. It cannot be used for invoice scanning.");
    }
    if (!pdf.numPages || pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`Use a PDF with 1 to ${MAX_PDF_PAGES} pages for this scan.`);
    }

    const textPages: string[] = [];
    const pages: Array<{ page: Awaited<ReturnType<typeof pdf.getPage>>; width: number; height: number }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      const rows = new Map<number, Array<{ x: number; text: string }>>();
      for (const item of content.items) {
        if (!("str" in item) || typeof item.str !== "string" || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 2) * 2;
        const row = rows.get(y) || [];
        row.push({ x: item.transform[4], text: item.str });
        rows.set(y, row);
      }
      const lines = [...rows.entries()]
        .sort(([a], [b]) => b - a)
        .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "));
      textPages.push(lines.join("\n"));
      const viewport = page.getViewport({ scale: 1 });
      pages.push({ page, width: viewport.width, height: viewport.height });
      progress?.(pageNumber / pdf.numPages);
    }

    const text = textPages.join("\n\n").trim();
    if (text.replace(/\s/g, "").length >= 30) return text;
    const ocrPages: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const { page, width, height } = pages[i];
      const scale = Math.min(1.7, Math.sqrt(MAX_PAGE_PIXELS / (width * height)));
      const viewport = page.getViewport({ scale });
      const { canvas, context } = canvasFor(Math.floor(viewport.width), Math.floor(viewport.height));
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      ocrPages.push(await recognizeCanvas(canvas, (p) => progress?.((i + p) / pages.length)));
      page.cleanup();
    }
    return ocrPages.join("\n\n").trim();
  } finally {
    await task.destroy();
  }
}

async function readImage(file: File, progress?: (value: number) => void) {
  const bitmap = await createImageBitmap(file);
  try {
    const pixels = bitmap.width * bitmap.height;
    if (!Number.isFinite(pixels) || pixels <= 0 || pixels > MAX_IMAGE_PIXELS) {
      throw new Error("This image exceeds the safe 60-megapixel processing limit.");
    }
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const { canvas, context } = canvasFor(width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return await recognizeCanvas(canvas, progress);
  } finally {
    bitmap.close();
  }
}

export async function extractSupplierInvoiceText(file: File, progress?: (value: number) => void) {
  if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error("Choose a non-empty PDF, JPEG, or PNG of 15 MB or less.");
  const extension = file.name.toLowerCase().split(".").pop();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = file.type === "application/pdf" && extension === "pdf" && isPdf(bytes);
  const jpeg = file.type === "image/jpeg" && (extension === "jpg" || extension === "jpeg") && isJpeg(bytes);
  const png = file.type === "image/png" && extension === "png" && isPng(bytes);
  if (!pdf && !jpeg && !png) throw new Error("The file extension, MIME type, and file signature must match a PDF, JPEG, or PNG.");
  return pdf ? readPdf(bytes, progress) : readImage(file, progress);
}

export function parseSupplierInvoiceLines(text: string): SupplierInvoiceLine[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const headerIndex = lines.findIndex((line) => /\b(sku|item\s*code|product\s*code|part\s*(?:no|number))\b/i.test(line) && /\b(qty|quantity)\b/i.test(line));
  if (headerIndex < 0) return [];

  const output: SupplierInvoiceLine[] = [];
  for (const [lineIndex, rawLine] of lines.entries()) {
    if (lineIndex <= headerIndex || /\b(subtotal|tax|vat|total due|amount due|balance)\b/i.test(rawLine)) continue;
    const skuMatch = rawLine.match(/\b(?=[A-Z0-9._/-]{4,}\b)(?=[A-Z0-9._/-]*[0-9])(?=[A-Z0-9._/-]*[A-Z])[A-Z0-9][A-Z0-9._/-]*\b/i);
    if (!skuMatch) continue;
    const sku = skuMatch[0].replace(/[.,;:]$/, "");
    const remainder = rawLine.replace(skuMatch[0], " ");
    const numericValues = [...remainder.matchAll(/(?:\bKES\b|\bKSh\b)?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)/gi)]
      .map((match) => Number(match[1].replace(/,/g, "")))
      .filter(Number.isFinite);
    const quantityValue = numericValues.find((value) => Number.isInteger(value) && value >= 1);
    const unitCostValue = numericValues.length >= 3 ? numericValues[numericValues.length - 2] : numericValues[numericValues.length - 1];
    const totalValue = numericValues.length >= 3 ? numericValues[numericValues.length - 1] : undefined;
    const description = remainder
      .replace(/\bKES\b|\bKSh\b/gi, " ")
      .replace(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g, " ")
      .replace(/[|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    output.push({
      id: `${lineIndex}-${sku}`,
      sku,
      description,
      quantity: quantityValue === undefined ? "" : String(quantityValue),
      unitCost: unitCostValue === undefined ? "" : String(unitCostValue),
      lineTotal: totalValue === undefined ? "" : String(totalValue),
      rawLine,
    });
  }
  return output;
}
