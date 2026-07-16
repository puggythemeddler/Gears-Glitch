import fs from "fs";
import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const UPLOAD_DIR: string = path.join(__dirname, "..", "data", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "gear-glitch";

const cloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function makeCloudinaryStorage(folder: string, filenameFn?: (req: any, file: Express.Multer.File) => string) {
  return new CloudinaryStorage({
    cloudinary,
    params: (_req: any, file: Express.Multer.File) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico", ".svg"].includes(ext) ? ext : ".jpg";
      const base = filenameFn ? filenameFn(_req, file) : `file-${Date.now()}`;
      return {
        folder: `${CLOUDINARY_FOLDER}/${folder}`,
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

function resolveStorage(folder: string, filenameFn: (req: any, file: Express.Multer.File) => string) {
  if (cloudinaryConfigured) return makeCloudinaryStorage(folder, filenameFn);
  return makeLocalDiskStorage(filenameFn);
}

function safeExt(file: Express.Multer.File, fallback: string) {
  const ext = path.extname(file.originalname).toLowerCase() || fallback;
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".ico", ".svg"].includes(ext) ? ext : fallback;
}

const uploadProductImage = multer({
  storage: resolveStorage("products", (req, file) => {
    const productId = req.params?.id || "unknown";
    return `${productId}${safeExt(file, ".jpg")}`;
  }),
  ...MULTER_OPTS,
  fileFilter: imageFileFilterLenient,
}).single("image");

const uploadFavicon = multer({
  storage: resolveStorage("favicon", (_req, file) => `store-favicon${safeExt(file, ".png")}`),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("favicon");

const uploadGalleryImage = multer({
  storage: resolveStorage("gallery", (req, file) => {
    const productId = req.params?.id || "unknown";
    return `${productId}-gallery-${Date.now()}${safeExt(file, ".jpg")}`;
  }),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("image");

const uploadRepairImage = multer({
  storage: resolveStorage("repairs", (req, file) => {
    const ticketId = req.params?.id || "unknown";
    const type = req.body?.imageType || "before";
    return `repair-${ticketId}-${type}-${Date.now()}${safeExt(file, ".jpg")}`;
  }),
  ...MULTER_OPTS,
  fileFilter: imageFileFilter,
}).single("image");

function imageUrlForProduct(productId: string): string {
  if (cloudinaryConfigured) return "";
  const extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  for (const ext of extensions) {
    const filePath = path.join(UPLOAD_DIR, `${productId}${ext}`);
    if (fs.existsSync(filePath)) {
      return `/uploads/${productId}${ext}`;
    }
  }
  return "";
}

function deleteProductImages(productId: string): void {
  if (cloudinaryConfigured) return;
  const extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  for (const ext of extensions) {
    const filePath = path.join(UPLOAD_DIR, `${productId}${ext}`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function getUploadedUrl(req: any): string {
  const file = req.file;
  if (!file) return "";
  if (cloudinaryConfigured && file.path) return file.path;
  return `/uploads/${file.filename}`;
}

export { UPLOAD_DIR, uploadProductImage, uploadGalleryImage, uploadRepairImage, uploadFavicon, imageUrlForProduct, deleteProductImages, cloudinaryConfigured, getUploadedUrl };
