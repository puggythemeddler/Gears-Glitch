import fs from "fs";
import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const UPLOAD_DIR: string = path.join(__dirname, "..", "data", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let cloudinaryFolder = process.env.CLOUDINARY_FOLDER || "gear-glitch";
let _cloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (_cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function reconfigureCloudinary(cloudName: string, apiKey: string, apiSecret: string, folder: string): void {
  cloudinaryFolder = folder || "gear-glitch";
  if (cloudName && apiKey && apiSecret) {
    _cloudinaryConfigured = true;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    console.log("[Upload] Cloudinary configured from admin settings");
  } else {
    _cloudinaryConfigured = false;
    console.log("[Upload] Cloudinary disabled — using local disk storage");
  }
}

function isCloudinaryConfigured(): boolean {
  return _cloudinaryConfigured;
}

// Dynamic storage wrapper — resolves to Cloudinary or local disk at upload time
class DynamicStorage implements multer.StorageEngine {
  private folder: string;
  private filenameFn: (req: any, file: Express.Multer.File) => string;

  constructor(folder: string, filenameFn: (req: any, file: Express.Multer.File) => string) {
    this.folder = folder;
    this.filenameFn = filenameFn;
  }

  _handleFile(req: any, file: Express.Multer.File, cb: (error?: Error | null, info?: Partial<Express.Multer.File>) => void): void {
    if (_cloudinaryConfigured) {
      const storage = makeCloudinaryStorage(this.folder, this.filenameFn);
      storage._handleFile(req, file, cb);
    } else {
      const storage = makeLocalDiskStorage(this.filenameFn);
      storage._handleFile(req, file, cb);
    }
  }

  _removeFile(req: any, file: Express.Multer.File, cb: (error: Error | null) => void): void {
    if (_cloudinaryConfigured) {
      const storage = makeCloudinaryStorage(this.folder, this.filenameFn);
      storage._removeFile(req, file, cb);
    } else {
      const storage = makeLocalDiskStorage(this.filenameFn);
      storage._removeFile(req, file, cb);
    }
  }
}

function makeCloudinaryStorage(folder: string, filenameFn?: (req: any, file: Express.Multer.File) => string) {
  return new CloudinaryStorage({
    cloudinary,
    params: (_req: any, file: Express.Multer.File) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico", ".svg"].includes(ext) ? ext : ".jpg";
      const base = filenameFn ? filenameFn(_req, file) : `file-${Date.now()}`;
      return {
        folder: `${cloudinaryFolder}/${folder}`,
        public_id: base.replace(/\.[^.]+$/, ""),
        format: safeExt.replace(".", ""),
        resource_type: "image",
      };
    },
  });
}

function makeLocalDiskStorage(filenameFn: (req: any, file: Express.Multer.File) => string) {
  return multer.diskStorage({
    destination: (_req: any, _file: any, cb) => cb(null, UPLOAD_DIR),
    filename: (req: any, file: Express.Multer.File, cb) => cb(null, filenameFn(req, file)),
  });
}

function imageFileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!file.mimetype.startsWith("image/") && file.mimetype !== "image/x-icon" && file.mimetype !== "image/vnd.microsoft.icon") {
    return cb(new Error("Only image files are allowed."));
  }
  cb(null, true);
}

function imageFileFilterLenient(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  cb(null, true);
}

const MULTER_OPTS = { limits: { fileSize: 5 * 1024 * 1024 } };

function safeExt(file: Express.Multer.File, fallback: string) {
  const ext = path.extname(file.originalname).toLowerCase() || fallback;
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico"].includes(ext) ? ext : fallback;
}

const uploadProductImage = multer({
  storage: new DynamicStorage("products", (req, file) => {
    const productId = req.params?.id || "unknown";
    if (_cloudinaryConfigured) return `${productId}${safeExt(file, ".jpg")}`;
    return `${productId}-${Date.now()}${safeExt(file, ".jpg")}`;
  }),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("image");

const uploadFavicon = multer({
  storage: new DynamicStorage("favicon", (_req, file) => `store-favicon-${Date.now()}${safeExt(file, ".png")}`),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("favicon");

const uploadLogo = multer({
  storage: new DynamicStorage("logo", (_req, file) => `store-logo-${Date.now()}${safeExt(file, ".jpg")}`),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("image");

const uploadGalleryImage = multer({
  storage: new DynamicStorage("gallery", (req, file) => {
    const productId = req.params?.id || "unknown";
    return `${productId}-gallery-${Date.now()}${safeExt(file, ".jpg")}`;
  }),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("image");

const uploadRepairImage = multer({
  storage: new DynamicStorage("repairs", (req, file) => {
    const ticketId = req.params?.id || "unknown";
    const type = req.body?.imageType || "before";
    return `repair-${ticketId}-${type}-${Date.now()}${safeExt(file, ".jpg")}`;
  }),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("image");

function imageUrlForProduct(productId: string): string {
  if (_cloudinaryConfigured) return "";
  const extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  let bestFile = "";
  let bestTime = 0;
  for (const ext of extensions) {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(productId) && f.endsWith(ext));
    for (const file of files) {
      const fp = path.join(UPLOAD_DIR, file);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs > bestTime) { bestTime = stat.mtimeMs; bestFile = file; }
    }
  }
  return bestFile ? `/uploads/${bestFile}` : "";
}

function deleteProductImages(productId: string): void {
  if (_cloudinaryConfigured) return;
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(productId));
    for (const file of files) {
      fs.unlinkSync(path.join(UPLOAD_DIR, file));
    }
  } catch {}
}

async function deleteProductCloudinaryImages(imageUrls: string[]): Promise<void> {
  for (const url of imageUrls) {
    await deleteCloudinaryImage(url);
  }
}

function getUploadedUrl(req: any): string {
  const file = req.file;
  if (!file) return "";
  if (_cloudinaryConfigured && file.path) return file.path;
  return `/uploads/${file.filename}`;
}

async function deleteCloudinaryImage(imageUrl: string): Promise<void> {
  if (!_cloudinaryConfigured || !imageUrl) return;
  try {
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
    if (!match) return;
    const publicId = match[1];
    await cloudinary.uploader.destroy(publicId);
    console.log("[Upload] Deleted Cloudinary image:", publicId);
  } catch (e: any) {
    console.warn("[Upload] Cloudinary delete failed:", e.message || e);
  }
}

export { UPLOAD_DIR, uploadProductImage, uploadGalleryImage, uploadRepairImage, uploadFavicon, uploadLogo, imageUrlForProduct, deleteProductImages, isCloudinaryConfigured, getUploadedUrl, reconfigureCloudinary, deleteCloudinaryImage };
