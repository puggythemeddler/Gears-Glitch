import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public", "ocr");
const coreDir = path.join(publicDir, "core");
const langDir = path.join(publicDir, "lang");
await Promise.all([mkdir(coreDir, { recursive: true }), mkdir(langDir, { recursive: true })]);

const assets = [
  ["node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "public/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "public/ocr/core/tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "public/ocr/core/tesseract-core-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "public/ocr/lang/eng.traineddata.gz"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "public/ocr/pdf.worker.min.mjs"],
];

for (const [source, target] of assets) {
  await cp(path.join(root, source), path.join(root, target));
}
console.log(`Prepared ${assets.length} local OCR/PDF worker assets.`);
