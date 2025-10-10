import fs from "fs";
import path from "path";
import multer from "multer";

const UPLOAD_DIR: string = path.join(__dirname, "..", "data", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const productId: string | undefined = req.params?.id;
    const ext: string = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeExt: string = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    cb(null, productId ? `${productId}${safeExt}` : `store-logo${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

function imageUrlForProduct(productId: string): string {
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
  const extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  for (const ext of extensions) {
    const filePath = path.join(UPLOAD_DIR, `${productId}${ext}`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

const uploadProductImage = upload.single("image");
const uploadGalleryImage = multer({
  storage: multer.diskStorage({
    destination: (_req: any, _file: any, cb) => cb(null, UPLOAD_DIR),
    filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const productId: string | undefined = req.params?.id;
      const ext: string = path.extname(file.originalname).toLowerCase() || ".jpg";
      const safeExt: string = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      cb(null, `${productId}-gallery-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed."));
    cb(null, true);
  },
}).single("image");

const uploadRepairImage = multer({
  storage: multer.diskStorage({
    destination: (_req: any, _file: any, cb) => cb(null, UPLOAD_DIR),
    filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ticketId: string | undefined = req.params?.id;
      const type: string = req.body?.imageType || "before";
      const ext: string = path.extname(file.originalname).toLowerCase() || ".jpg";
      const safeExt: string = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      cb(null, `repair-${ticketId}-${type}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed."));
    cb(null, true);
  },
}).single("image");

export { UPLOAD_DIR, uploadProductImage, uploadGalleryImage, uploadRepairImage, imageUrlForProduct, deleteProductImages };
