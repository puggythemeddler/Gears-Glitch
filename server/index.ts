import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  initDb,
  getSettings,
  updateSettings,
  listProducts,
  getProduct,
  setProductImageUrl,
  createProduct,
  updateProduct,
  deleteProduct,
  generateProductId,
  findCustomerByEmail,
  findCustomerById,
  findStaffById,
  findStaffByEmail,
  listStaff,
  getCartItems,
  getCartCount,
  addToCart,
  setCartQuantity,
  removeFromCart,
  clearCart,
  createStaff,
  updateStaffRole,
  updateStaffDetails,
  changeStaffPassword,
  changeCustomerPassword,
  deleteStaff,
  getStockLevel,
  updateStockLevel,
  recordStockMovement,
  getStockMovements,
  getLowStockItems,
  listCategories,
  listPosCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  listSubcategories,
  getSubcategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getSubcategoriesForCategory,
  listSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  findProviderByEmail,
  findProviderById,
  listProviders,
  createProvider,
  verifyProviderPin,
  updateProvider,
  updateProviderStatus,
  getProviderSubscription,
  assignPlanToProvider,
  getProviderAssignmentHistory,
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
  updateOrderDetails,
  cancelOrderItem,
  updateOrderItemWarranty,
  recordProductView,
  getPopularProducts,
  getTotalViews,
  listInvoices,
  getInvoice,
  markInvoicePaid,
  generateProviderInvoice,
  getInvoiceRevenue,
  listOrderInvoices,
  markOrderInvoicePaid,
  createCreditNote,
  getCreditNote,
  listCreditNotes,
  submitCreditNoteToEtims,
  getProductImages,
  addProductImage,
  deleteProductImage,
  setProductImageOrder,
  setPrimaryImage,
  getMessagesForCustomer,
  getMessagesForProvider,
  sendMessage,
  markMessageRead,
  getUnreadMessageCount,
  getRepairImages,
  addRepairImage,
  deleteRepairImage,
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  updatePurchaseOrderStatus,
  addPurchaseOrderItem,
  receivePurchaseOrderItem,
  autoReorderLowStock,
  getPaymentMethods,
  getLoyaltyPoints,
  redeemLoyaltyPoints,
  getLoyaltyTransactions,
  listAllLoyaltyCustomers,
  getTechPerformanceReport,
  getSalesReport,
  getPurchaseReport,
  listAllCustomers,
  listActiveCustomers,
  deleteCustomer,
  updateCustomerStatus,
  getCustomerDetails,
  deactivateOldCustomers,
  createCustomer,
  listAllMessages,
  getSalesReportWithRange,
  getStockSummary,
  getEmployeeSalesPerformance,
  getTechnicianRepairStats,
  providerHasFeature,
  createStockTakeSession,
  getStockTakeSession,
  listStockTakeSessions,
  getStockTakeItems,
  recordStockCount,
  completeStockTakeSession,
  applyStockTakeAdjustments,
  getStockTakeVarianceReport,
  deleteStockTakeSession,
  createStockSnapshot,
  getStockSnapshot,
  listStockSnapshotDates,
  getCurrentStockLevels,
  logAudit,
  getAuditLog,
  getShopPlan,
  setShopPlan,
  getStoreSetting,
  setStoreSetting,
  createSubscriptionRequest,
  listSubscriptionRequests,
  reviewSubscriptionRequest,
  getSpecTemplateFields,
  getAllSpecTemplateFields,
  createSpecTemplateField,
  updateSpecTemplateField,
  deleteSpecTemplateField,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  createQuoteFromWishlist,
  createQuote,
  getQuote,
  updateQuote,
  deleteQuote,
  listQuotesForCustomer,
  listAllQuotes,
  updateQuoteStatus,
  convertQuoteToOrder,
  generateInvoiceNumber,
  recordAuditLog,
  listAllAuditLogs,
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  canCreateBranch,
  createStockTransfer,
  getStockTransfer,
  listStockTransfers,
  completeStockTransfer,
  rejectStockTransfer,
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  listClientBranches,
  getClientBranch,
  createClientBranch,
  updateClientBranch,
  deleteClientBranch,
  validateCoupon,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getPriceHistory,
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createReview,
  getProductReviews,
  getProductReviewCount,
  getProductRating,
  getProductRatingDistribution,
  hasCustomerReviewed,
  getReviewById,
  updateReview,
  deleteReview,
  getAllReviews,
  getAllReviewCount,
  listActiveSplashes,
  listAllSplashes,
  getSplash,
  createSplash,
  updateSplash,
  deleteSplash,
  storeImage,
  getImage,
  updateProductSortOrder,
  logEmail,
  listEmailLogs,
} from "./db";
import { query, queryOne, queryAll } from "./db-helpers";
import {
  adminAuthMiddleware,
  ownerAuthMiddleware,
  staffAuthMiddleware,
  customerAuthMiddleware,
  providerAuthMiddleware,
  posAuthMiddleware,
  loginStaff,
  loginCustomer,
  registerCustomer,
  loginProvider,
  googleLogin,
  signToken,
  verifyToken,
  getBearerToken,
} from "./auth";
import {
  getAllPermissions,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getUserRoles,
  getUserPermissions,
  getUserDirectPermissions,
  setUserDirectPermissions,
  hasPermission,
  assignRoleToUser,
  removeRoleFromUser,
} from "./permissions";
import {
  STATUS_LABELS,
  createRepairTicket,
  loadTicketDetails,
  listRepairsForCustomer,
  listRepairsForCustomerPaged,
  listRepairsForStaff,
  listCalendarRepairs,
  updateRepairTicket,
  addRepairUpdate,
  addRepairPart,
  removeRepairPart,
  getDashboardStats,
  listRepairTypes,
  calculateRepairCost,
  recalculateTicketCost,
  sendRepairQuote,
  respondToRepairQuote,
} from "./repairs";
import * as notifier from "./notify";
import { sendEmail, resetTransporter, messageNotificationEmail, quoteEmail, creditNoteEmail, orderStatusEmail } from "./email";
import { uploadProductImage, uploadGalleryImage, uploadRepairImage, uploadFavicon, imageUrlForProduct, getUploadedUrl, isCloudinaryConfigured, reconfigureCloudinary, deleteCloudinaryImage } from "./upload";
import { getCounties, getShippingFee } from "./shipping";
import { getMpesaConfig, updateMpesaConfig, stkPush, isMpesaConfigured } from "./mpesa";
import bcrypt from "bcryptjs";
import { htmlToPdf, closeBrowser } from "./pdf";

const PORT: number = Number(process.env.PORT) || 8020;
const ROOT: string = path.join(__dirname, "..");

// Start server after DB is ready
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "ws:"],
      frameSrc: ["https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : process.env.NODE_ENV === "production"
    ? [`https://${process.env.BASE_URL ? new URL(process.env.BASE_URL).host : "gears-glitch.onrender.com"}`]
    : ["http://localhost:3000"];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/customer/register", authLimiter);
app.use("/api/customer/login", authLimiter);
app.use("/api/provider/login", authLimiter);
app.use("/api/provider/register", authLimiter);
app.use("/api/auth/request-password-reset", authLimiter);
app.use("/api/auth/request-admin-password-reset", authLimiter);

app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(ROOT, "data", "uploads"), {
  maxAge: 0,
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
}));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// DB image backup helper — stores image as base64 in stored_images table
async function backupImageToDb(refId: string, imageUrl: string): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.backupImagesToDb) return;
    if (!imageUrl) return;
    let buffer: Buffer;
    let contentType: string;
    if (imageUrl.startsWith("http")) {
      const resp = await fetch(imageUrl);
      if (!resp.ok) return;
      contentType = resp.headers.get("content-type") || "image/jpeg";
      buffer = Buffer.from(await resp.arrayBuffer());
    } else {
      const localPath = path.join(__dirname, "..", "data", imageUrl.replace(/^\//, ""));
      if (!fs.existsSync(localPath)) return;
      buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      contentType = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" }[ext] || "image/jpeg";
    }
    await storeImage(refId, contentType, buffer.toString("base64"));
  } catch (err: any) {
    console.error("[Image Backup]", err?.message || err);
  }
}

// Cloudinary status check
app.get("/api/upload/status", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  const settings = await getSettings();
  res.json({ cloudinary: isCloudinaryConfigured(), cloudName: settings.cloudinaryCloudName || "(not set)", hasApiKey: !!settings.cloudinaryApiKey, hasApiSecret: !!settings.cloudinaryApiSecret });
});

// Serve DB-backed-up images
app.get("/api/images/:refId", async (req: Request, res: Response) => {
  const img = await getImage(String(req.params.refId));
  if (!img) { res.status(404).json({ error: "Image not found." }); return; }
  const buffer = Buffer.from(img.imageData, "base64");
  res.set("Content-Type", img.mimeType);
  res.set("Cache-Control", "public, max-age=31536000");
  res.send(buffer);
});

// Permission guard helper
function requirePermission(perm: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const uid = (req as any).user?.sub;
    if (!uid) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (!await hasPermission(uid, perm)) { res.status(403).json({ error: `Missing permission: ${perm}` }); return; }
    next();
  };
}

// Shipping
app.get("/api/shipping/counties", (_req: Request, res: Response) => {
  res.json({ counties: getCounties() });
});

// M-Pesa callback (called by Safaricom — body validated for expected structure)
app.post("/api/mpesa/callback", (req: Request, res: Response) => {
  const data = req.body;
  if (!data || typeof data !== "object") { return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid payload" }); }
  const checkoutId = data?.Body?.stkCallback?.CheckoutRequestID;
  if (!checkoutId || typeof checkoutId !== "string" || checkoutId.length > 200) {
    console.warn("[M-Pesa] Callback received without CheckoutRequestID — rejected");
    return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback" });
  }
  fs.appendFileSync(path.join(__dirname, "..", "data", "mpesa-callback.log"),
    `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`, "utf-8");
  res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// M-Pesa status query
app.get("/api/mpesa/config", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json(getMpesaConfig());
});

app.get("/api/settings", staffAuthMiddleware, requirePermission("settings:view"), async (_req: Request, res: Response) => {
  const settings = await getSettings() as any;
  settings.googleClientId = await getStoreSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "";
  settings.kraPin = (await queryOne("SELECT value FROM settings WHERE key = 'kra_pin'"))?.value || "";
  settings.etimsSerialPrefix = (await queryOne("SELECT value FROM settings WHERE key = 'etims_serial_prefix'"))?.value || "01";
  settings.etimsMode = (await queryOne("SELECT value FROM settings WHERE key = 'etims_mode'"))?.value || "off";
  settings.etimsBranchId = (await queryOne("SELECT value FROM settings WHERE key = 'etims_branch_id'"))?.value || "00";
  settings.etimsDeviceSerial = (await queryOne("SELECT value FROM settings WHERE key = 'etims_device_serial'"))?.value || "dvc001";
  settings.etimsVscuUrl = (await queryOne("SELECT value FROM settings WHERE key = 'etims_vscu_url'"))?.value || "http://localhost:8088";
  settings.etimsOscuApiUrl = (await queryOne("SELECT value FROM settings WHERE key = 'etims_oscu_api_url'"))?.value || "https://etims.kra.go.ke/api";
  settings.etimsOscuConsumerKey = (await queryOne("SELECT value FROM settings WHERE key = 'etims_oscu_consumer_key'"))?.value || "";
  settings.etimsOscuConsumerSecret = (await queryOne("SELECT value FROM settings WHERE key = 'etims_oscu_consumer_secret'"))?.value || "";
  settings.paymentMethods = await getPaymentMethods();
  res.json(settings);
});

app.get("/api/public-settings", async (_req: Request, res: Response) => {
  const { storeName, phone, email, currency, storeLogo, taxRate, storeFavicon } = await getSettings();
  const mpesaCfg = getMpesaConfig();
  const layout = await getStoreSetting("store_layout") || "original";
  let banners: any[] = [];
  try { banners = JSON.parse(await getStoreSetting("store_banners") || "[]"); } catch {}
  let aboutUs: any = {};
  try { aboutUs = JSON.parse(await getStoreSetting("about_us") || "{}"); } catch {}
  res.json({
    storeName,
    phone,
    email,
    currency,
    storeLogo,
    storeFavicon,
    taxRate,
    layout,
    banners,
    aboutUs,
    googleClientId: await getStoreSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "",
    mpesaTillNumber: mpesaCfg.tillNumber,
    mpesaConfigured: isMpesaConfigured(),
    springboardMenu: (await getStoreSetting("springboard_menu")) === "true",
  });
});

// ============ EXCHANGE RATES ============

let ratesCache: { rates: Record<string, number>; timestamp: number } | null = null;
const RATES_CACHE_TTL = 3600000; // 1 hour

app.get("/api/rates", async (_req: Request, res: Response) => {
  const manualRates = await getStoreSetting("exchange_rates");
  if (manualRates) {
    try {
      const parsed = JSON.parse(manualRates);
      res.json({ base: "KES", rates: parsed, source: "manual" });
      return;
    } catch {}
  }
  if (ratesCache && Date.now() - ratesCache.timestamp < RATES_CACHE_TTL) {
    res.json({ base: "KES", rates: ratesCache.rates, source: "auto" });
    return;
  }
  fetch("https://open.er-api.com/v6/latest/KES")
    .then((r) => r.json())
    .then((data) => {
      if (data?.rates) {
        ratesCache = { rates: data.rates, timestamp: Date.now() };
        res.json({ base: "KES", rates: data.rates, source: "auto" });
      } else {
        res.json({ base: "KES", rates: { KES: 1 }, source: "fallback" });
      }
    })
    .catch(() => {
      res.json({ base: "KES", rates: { KES: 1 }, source: "fallback" });
    });
});

app.put("/api/rates", adminAuthMiddleware, requirePermission("settings:update"), async (req: Request, res: Response) => {
  const { rates } = req.body || {};
  if (!rates || typeof rates !== "object") {
    res.status(400).json({ error: "Rates object required." });
    return;
  }
  await setStoreSetting("exchange_rates", JSON.stringify(rates));
  res.json({ base: "KES", rates, source: "manual" });
});

app.delete("/api/rates", adminAuthMiddleware, requirePermission("settings:update"), async (_req: Request, res: Response) => {
  await query("DELETE FROM settings WHERE key = 'exchange_rates'");
  res.json({ message: "Manual rates cleared, auto-fetch will resume." });
});

// ============ STOREFRONT LAYOUT ============

app.get("/api/storefront-config", async (_req: Request, res: Response) => {
  const layout = await getStoreSetting("store_layout") || "original";
  let banners: any[] = [];
  try { banners = JSON.parse(await getStoreSetting("store_banners") || "[]"); } catch {}
  let features: any[] = [];
  try { features = JSON.parse(await getStoreSetting("store_features") || "[]"); } catch {}
  res.json({ layout, banners, features });
});

app.get("/api/admin/storefront-layout", adminAuthMiddleware, async (_req: Request, res: Response) => {
  const layout = await getStoreSetting("store_layout") || "original";
  let banners: any[] = [];
  try { banners = JSON.parse(await getStoreSetting("store_banners") || "[]"); } catch {}
  let features: any[] = [];
  try { features = JSON.parse(await getStoreSetting("store_features") || "[]"); } catch {}
  res.json({ layout, banners, features });
});

app.put("/api/admin/storefront-layout", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { layout, banners, features } = req.body || {};
  if (layout) {
    const valid = ["original", "amazon", "jumia", "mobile"];
    if (!valid.includes(layout)) { res.status(400).json({ error: "Invalid layout. Valid: " + valid.join(", ") }); return; }
    await setStoreSetting("store_layout", layout);
  }
  if (banners !== undefined) await setStoreSetting("store_banners", JSON.stringify(banners));
  if (features !== undefined) await setStoreSetting("store_features", JSON.stringify(features));
  const currentLayout = await getStoreSetting("store_layout") || "amazon";
  let currentBanners: any[] = [];
  try { currentBanners = JSON.parse(await getStoreSetting("store_banners") || "[]"); } catch {}
  let currentFeatures: any[] = [];
  try { currentFeatures = JSON.parse(await getStoreSetting("store_features") || "[]"); } catch {}
  res.json({ layout: currentLayout, banners: currentBanners, features: currentFeatures });
});

// ============ ABOUT US ============

app.get("/api/admin/about-us", adminAuthMiddleware, async (_req: Request, res: Response) => {
  let aboutUs: any = {};
  try { aboutUs = JSON.parse(await getStoreSetting("about_us") || "{}"); } catch {}
  res.json(aboutUs);
});

app.put("/api/admin/about-us", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { title, content, mission, vision } = req.body || {};
  const data = { title: title || "", content: content || "", mission: mission || "", vision: vision || "" };
  await setStoreSetting("about_us", JSON.stringify(data));
  res.json(data);
});

app.put("/api/settings", adminAuthMiddleware, requirePermission("settings:update"), async (req: Request, res: Response) => {
  const { storeName, phone, email, currency, taxRate, mpesaConsumerKey, mpesaConsumerSecret, mpesaPasskey, mpesaShortcode, mpesaTillNumber, mpesaEnv, googleClientId, kraPin, etimsSerialPrefix, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, cloudinaryFolder } = req.body || {};
  if (storeName !== undefined && !String(storeName).trim()) {
    res.status(400).json({ error: "Store name is required." });
    return;
  }
  const settings = await updateSettings({ storeName, phone, email, currency, taxRate, paymentMethods: req.body.paymentMethods, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, cloudinaryFolder }) as any;
  if (googleClientId !== undefined) {
    await setStoreSetting("google_client_id", String(googleClientId).trim());
    settings.googleClientId = await getStoreSetting("google_client_id") || "";
  }
  if ((req.body as any).springboardMenu !== undefined) {
    await setStoreSetting("springboard_menu", (req.body as any).springboardMenu ? "true" : "false");
  }
  if (kraPin !== undefined) {
    await query("INSERT INTO settings (key, value) VALUES ('kra_pin', $1) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [String(kraPin).trim()]);
    settings.kraPin = String(kraPin).trim();
  }
  if (etimsSerialPrefix !== undefined) {
    await query("INSERT INTO settings (key, value) VALUES ('etims_serial_prefix', $1) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [String(etimsSerialPrefix).trim()]);
    settings.etimsSerialPrefix = String(etimsSerialPrefix).trim();
  }
  const etimsKeys: Record<string, string> = {
    etimsMode: "etims_mode", etimsBranchId: "etims_branch_id", etimsDeviceSerial: "etims_device_serial",
    etimsVscuUrl: "etims_vscu_url", etimsOscuApiUrl: "etims_oscu_api_url",
    etimsOscuConsumerKey: "etims_oscu_consumer_key", etimsOscuConsumerSecret: "etims_oscu_consumer_secret",
  };
  for (const [bodyKey, dbKey] of Object.entries(etimsKeys)) {
    if ((req.body as any)[bodyKey] !== undefined) {
      await query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [dbKey, String((req.body as any)[bodyKey]).trim()]);
      (settings as any)[bodyKey] = String((req.body as any)[bodyKey]).trim();
    }
  }
  const mpesaUpdates: any = {};
  if (mpesaConsumerKey !== undefined) mpesaUpdates.consumerKey = mpesaConsumerKey;
  if (mpesaConsumerSecret !== undefined) mpesaUpdates.consumerSecret = mpesaConsumerSecret;
  if (mpesaPasskey !== undefined) mpesaUpdates.passkey = mpesaPasskey;
  if (mpesaShortcode !== undefined) mpesaUpdates.shortcode = mpesaShortcode;
  if (mpesaTillNumber !== undefined) mpesaUpdates.tillNumber = mpesaTillNumber;
  if (mpesaEnv !== undefined) mpesaUpdates.env = mpesaEnv;
  if (Object.keys(mpesaUpdates).length) updateMpesaConfig(mpesaUpdates);
  reconfigureCloudinary(settings.cloudinaryCloudName, settings.cloudinaryApiKey, settings.cloudinaryApiSecret, settings.cloudinaryFolder);
  const { emailSender, emailSenderName, emailNotificationsEnabled } = req.body || {};
  const emailUpdates: any = {};
  if (emailSender !== undefined) emailUpdates.emailSender = String(emailSender).trim();
  if (emailSenderName !== undefined) emailUpdates.emailSenderName = String(emailSenderName).trim();
  if (emailNotificationsEnabled !== undefined) emailUpdates.emailNotificationsEnabled = String(emailNotificationsEnabled);
  if (Object.keys(emailUpdates).length) {
    const updatedSettings = await updateSettings(emailUpdates);
    settings.emailSender = updatedSettings.emailSender;
    settings.emailSenderName = updatedSettings.emailSenderName;
    settings.emailNotificationsEnabled = updatedSettings.emailNotificationsEnabled;
    resetTransporter();
  }
  const mpesaCfg = getMpesaConfig();
  res.json({ ...settings, paymentMethods: await getPaymentMethods(), mpesa: mpesaCfg, springboardMenu: (await getStoreSetting("springboard_menu")) === "true" });
});

app.post("/api/settings/logo", adminAuthMiddleware, (req: Request, res: Response) => {
  uploadProductImage(req, res, async (err: any) => {
    if (err) { res.status(400).json({ error: "Upload failed." }); return; }
    if (!req.file) { res.status(400).json({ error: "No image file provided." }); return; }
    const logoUrl = getUploadedUrl(req);
    await updateSettings({ storeLogo: logoUrl });
    backupImageToDb("logo", logoUrl);
    res.json({ logoUrl });
  });
});

app.get("/api/admin/email-logs", adminAuthMiddleware, async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const logs = await listEmailLogs(limit);
  res.json({ logs });
});

app.post("/api/admin/email/test", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { to } = req.body || {};
  if (!to) { res.status(400).json({ error: "Email address required." }); return; }
  const settings = await getSettings();
  const ok = await sendEmail(to, "Test email from Gear&Glitch", `<!DOCTYPE html><html><body><p>This is a test email from <strong>${settings.storeName || "Gear&Glitch"}</strong>.</p><p>If you received this, email notifications are working correctly.</p></body></html>`, "test");
  res.json({ ok, message: ok ? "Test email sent." : "Email failed. Check SMTP configuration." });
});

app.post("/api/settings/favicon", adminAuthMiddleware, (req: Request, res: Response) => {
  uploadFavicon(req, res, async (err: any) => {
    if (err) { res.status(400).json({ error: "Upload failed." }); return; }
    if (!req.file) { res.status(400).json({ error: "No file provided." }); return; }
    const faviconUrl = getUploadedUrl(req);
    await updateSettings({ storeFavicon: faviconUrl });
    backupImageToDb("favicon", faviconUrl);
    res.json({ faviconUrl });
  });
});

// ============ PROVIDER / SUBSCRIPTION PLANS ============

app.post("/api/provider/register", async (req: Request, res: Response) => {
  const { companyName, contactName, email, password, phone } = req.body || {};
  if (!companyName || !contactName || !email || !password) {
    res.status(400).json({ error: "Company name, contact name, email, and password are required." }); return;
  }
  if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  if (await findProviderByEmail(email.toLowerCase())) { res.status(409).json({ error: "A provider with this email already exists." }); return; }
  const provider = await createProvider({ companyName, contactName, email: email.toLowerCase(), password, phone: phone || "" });
  if (!provider) { res.status(500).json({ error: "Failed to create provider account." }); return; }
  await assignPlanToProvider(provider.id, "starter");
  const token = signToken({ sub: provider.id, email: provider.email, name: provider.contactName, companyName: provider.companyName, role: "provider" });
  res.status(201).json({ token, name: provider.contactName, email: provider.email, companyName: provider.companyName });
});

app.post("/api/provider/login", async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) { res.status(400).json({ error: "Email and password are required." }); return; }
  const result = await loginProvider(email, password);
  if (!result.ok) { res.status(401).json({ error: result.error }); return; }
  res.json({ token: result.token, name: result.name, email: result.email });
});

app.get("/api/provider/me", providerAuthMiddleware, async (req: Request, res: Response) => {
  const provider = await findProviderById((req as any).provider.sub);
  if (!provider) { res.status(404).json({ error: "Provider not found." }); return; }
  res.json(provider);
});

app.put("/api/provider/me", providerAuthMiddleware, async (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  const { companyName, contactName, phone } = req.body || {};
  await updateProvider(providerId, { companyName, contactName, phone });
  res.json({ ok: true, provider: await findProviderById(providerId) });
});

app.get("/api/provider/sales", providerAuthMiddleware, async (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  const sub = await getProviderSubscription(providerId);
  const tier = sub ? ((await getSubscriptionPlan(sub.planId))?.tierLevel ?? 0) : 0;
  const from = String(req.query.from || "1970-01-01");
  const to = String(req.query.to || "2099-12-31");
  const orders = await queryAll(`
    SELECT o.*, c.name AS customer_name FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.created_at >= $1 AND o.created_at <= $2 AND o.status != 'cancelled'
    GROUP BY o.id, c.name ORDER BY o.created_at DESC
  `, [from, to]) as any[];
  const totalRevenue = orders.reduce((s: number, o: any) => s + (o.subtotal || 0) + (o.shipping_fee || 0), 0);
  res.json({ totalOrders: orders.length, totalRevenue, orders });
});

app.get("/api/provider/subscription", providerAuthMiddleware, async (req: Request, res: Response) => {
  const sub = await getProviderSubscription((req as any).provider.sub);
  if (!sub) {
    const plan = await getSubscriptionPlan("starter");
    const defaultSub = { planId: "starter", planName: plan?.name || "Starter", status: "trial", customPrice: null, startDate: new Date().toISOString().slice(0, 10), endDate: null, notes: "" };
    res.json({ subscription: defaultSub, plan });
    return;
  }
  const plan = await getSubscriptionPlan(sub.planId);
  res.json({ subscription: sub, plan });
});

app.get("/api/plans", async (_req: Request, res: Response) => {
  res.json({ plans: await listSubscriptionPlans() });
});

app.get("/api/admin/plans", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ plans: await listSubscriptionPlans() });
});

app.post("/api/admin/plans", adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, name, description, price, priceAnnual, tierLevel, maxProducts, features } = req.body || {};
    if (!id || !name) { res.status(400).json({ error: "Plan ID and name are required." }); return; }
    if (await getSubscriptionPlan(id)) { res.status(409).json({ error: "A plan with this ID already exists." }); return; }
    const plan = await createSubscriptionPlan({ id, name, description, price, priceAnnual, tierLevel, maxProducts, maxBranches: 1, features, isActive: true });
    if (!plan) { res.status(500).json({ error: "Failed to create plan." }); return; }
    try { await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "created", "plan", id, { name }, (req as any).user.role); } catch {}
    res.status(201).json({ plan });
  } catch (err: any) {
    console.error("[plan create]", err?.message || err);
    res.status(500).json({ error: "Failed to create plan." });
  }
});

app.put("/api/admin/plans/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const plan = await updateSubscriptionPlan(String(req.params.id), req.body || {});
    if (!plan) { res.status(404).json({ error: "Plan not found." }); return; }
    try { await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "updated", "plan", String(req.params.id), { changes: Object.keys(req.body || {}) }, (req as any).user.role); } catch {}
    res.json({ plan });
  } catch (err: any) {
    console.error("[plan update]", err?.message || err);
    res.status(500).json({ error: "Failed to update plan." });
  }
});

app.delete("/api/admin/plans/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    if (["starter", "basic", "pro", "enterprise"].includes(String(req.params.id))) {
      res.status(400).json({ error: "Cannot delete default plans." }); return;
    }
    const ok = await deleteSubscriptionPlan(String(req.params.id));
    if (!ok) { res.status(404).json({ error: "Plan not found." }); return; }
    try { await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "deleted", "plan", String(req.params.id), {}, (req as any).user.role); } catch {}
    res.status(204).end();
  } catch (err: any) {
    console.error("[plan delete]", err?.message || err);
    res.status(500).json({ error: "Failed to delete plan." });
  }
});

// ============ BRANCHES ============

app.get("/api/admin/branches", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const branches = await listBranches();
  res.json({ branches });
});

app.post("/api/admin/branches", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { name, address, phone, email, managerId } = req.body || {};
  if (!name || !name.trim()) { res.status(400).json({ error: "Branch name is required." }); return; }

  const allowed = await canCreateBranch();
  if (!allowed) {
    res.status(403).json({ error: "Branch limit reached. Upgrade your plan to add more branches." }); return;
  }

  const branch = await createBranch({ name: name.trim(), address, phone, email, managerId: managerId || null });
  if (!branch) { res.status(500).json({ error: "Failed to create branch." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "created", "branch", String(branch.id), { name }, (req as any).user.role);
  res.status(201).json({ branch });
});

app.put("/api/admin/branches/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid branch ID." }); return; }
  const { name, address, phone, email, managerId, isActive } = req.body || {};
  const branch = await updateBranch(id, { name, address, phone, email, managerId, isActive });
  if (!branch) { res.status(404).json({ error: "Branch not found." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "updated", "branch", String(id), { name }, (req as any).user.role);
  res.json({ branch });
});

app.delete("/api/admin/branches/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid branch ID." }); return; }
  const ok = await deleteBranch(id);
  if (!ok) { res.status(404).json({ error: "Branch not found." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "deleted", "branch", String(id), {}, (req as any).user.role);
  res.status(204).end();
});

// ============ CLIENTS (Multi-Tenant) ============

app.get("/api/admin/clients", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ clients: await listClients() });
});

app.get("/api/admin/clients/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const client = await getClient(id);
  if (!client) { res.status(404).json({ error: "Client not found." }); return; }
  res.json({ client });
});

app.post("/api/admin/clients", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { name, email, phone, address } = req.body || {};
  if (!name || !name.trim()) { res.status(400).json({ error: "Client name is required." }); return; }
  const client = await createClient({ name: name.trim(), email, phone, address });
  if (!client) { res.status(500).json({ error: "Failed to create client." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "created", "client", String(client.id), { name }, (req as any).user.role);
  res.status(201).json({ client });
});

app.put("/api/admin/clients/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const { name, email, phone, address, isActive, settings } = req.body || {};
  const client = await updateClient(id, { name, email, phone, address, isActive, settings });
  if (!client) { res.status(404).json({ error: "Client not found." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "updated", "client", String(id), { name }, (req as any).user.role);
  res.json({ client });
});

app.delete("/api/admin/clients/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const ok = await deleteClient(id);
  if (!ok) { res.status(404).json({ error: "Client not found." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "deleted", "client", String(id), {}, (req as any).user.role);
  res.status(204).end();
});

// Per-client branch management
app.get("/api/admin/clients/:id/branches", adminAuthMiddleware, async (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  try {
    const branches = await listClientBranches(clientId);
    res.json({ branches });
  } catch {
    res.status(500).json({ error: "Failed to list branches." });
  }
});

app.post("/api/admin/clients/:id/branches", adminAuthMiddleware, async (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const { name, address, phone, email, managerId } = req.body || {};
  if (!name || !name.trim()) { res.status(400).json({ error: "Branch name is required." }); return; }
  try {
    const branch = await createClientBranch(clientId, { name: name.trim(), address, phone, email });
    if (!branch) { res.status(500).json({ error: "Failed to create branch." }); return; }
    res.status(201).json({ branch });
  } catch {
    res.status(500).json({ error: "Failed to create branch." });
  }
});

app.put("/api/admin/clients/:id/branches/:branchId", adminAuthMiddleware, async (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  const branchId = parseInt(String(req.params.branchId), 10);
  if (isNaN(clientId) || isNaN(branchId)) { res.status(400).json({ error: "Invalid ID." }); return; }
  const { name, address, phone, email, managerId, isActive } = req.body || {};
  try {
    const branch = await updateClientBranch(clientId, branchId, { name, address, phone, email });
    if (!branch) { res.status(404).json({ error: "Branch not found." }); return; }
    res.json({ branch });
  } catch {
    res.status(500).json({ error: "Failed to update branch." });
  }
});

app.delete("/api/admin/clients/:id/branches/:branchId", adminAuthMiddleware, async (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  const branchId = parseInt(String(req.params.branchId), 10);
  if (isNaN(clientId) || isNaN(branchId)) { res.status(400).json({ error: "Invalid ID." }); return; }
  try {
    const ok = await deleteClientBranch(clientId, branchId);
    if (!ok) { res.status(404).json({ error: "Branch not found." }); return; }
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete branch." });
  }
});

app.get("/api/admin/providers", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  const providers = await listProviders();
  const enriched = await Promise.all(providers.map(async (p) => {
    const sub = await getProviderSubscription(p.id);
    return { ...p, subscription: sub || null };
  }));
  res.json({ providers: enriched });
});

app.get("/api/admin/providers/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const provider = await findProviderById(Number(req.params.id));
  if (!provider) { res.status(404).json({ error: "Provider not found." }); return; }
  const subscription = await getProviderSubscription(Number(req.params.id));
  const history = await getProviderAssignmentHistory(Number(req.params.id));
  res.json({ provider, subscription, history });
});

app.post("/api/admin/providers/:id/subscription", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { planId, customPrice, startDate, endDate, notes } = req.body || {};
  if (!planId) { res.status(400).json({ error: "Plan ID is required." }); return; }
  if (!(await getSubscriptionPlan(planId))) { res.status(404).json({ error: "Plan not found." }); return; }
  const ok = await assignPlanToProvider(Number(req.params.id), planId, customPrice);
  if (!ok) { res.status(500).json({ error: "Failed to assign plan." }); return; }
  res.json({ ok: true });
});

app.patch("/api/admin/providers/:id/status", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["active", "inactive", "trial"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }
  await updateProviderStatus(Number(req.params.id), status);
  res.json({ ok: true });
});

// ============ PROVIDER FEATURE ENFORCEMENT ============

function requireProviderFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const providerId = (req as any).provider?.sub;
    if (!providerId) { res.status(401).json({ error: "Provider login required." }); return; }
    if (!await providerHasFeature(providerId, feature)) {
      res.status(403).json({ error: `Your plan does not include "${feature}". Upgrade to access this feature.` });
      return;
    }
    next();
  };
}

// ============ PROVIDER PRODUCT ACCESS ============

app.get("/api/provider/products", providerAuthMiddleware, requireProviderFeature("Product listing"), async (req: Request, res: Response) => {
  const sub = await getProviderSubscription((req as any).provider.sub);
  const tier = sub ? ((await getSubscriptionPlan(sub.planId))?.tierLevel ?? 0) : 0;
  const products = await listProducts();
  const settings = await getSettings();
  res.json({ products, currency: settings.currency, tier });
});

// ============ ORDERS ============

app.get("/api/pos/payment-methods", async (_req: Request, res: Response) => {
  res.json({ methods: await getPaymentMethods() });
});

app.get("/api/pos/categories", async (_req: Request, res: Response) => {
  res.json({ categories: await listPosCategories() });
});

app.post("/api/pos/checkout", posAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerName, customerId: selectedCustomerId, paymentMethod, tenderedAmount, items, idempotencyKey } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "Items are required." }); return; }
    if (items.length > 100) { res.status(400).json({ error: "Too many items (max 100)." }); return; }
    if (idempotencyKey) {
      const existing = await queryOne("SELECT id FROM orders WHERE idempotency_key = $1", [idempotencyKey]) as any;
      if (existing) { const dup = await getOrder(existing.id); if (dup) { res.status(200).json({ order: dup }); return; } }
    }
    const paymentMethods = await getPaymentMethods();
    const pmt = paymentMethod || "cash";
    const pmtConfig = paymentMethods.find((m: any) => m.id === pmt);
    if (!pmtConfig) { res.status(400).json({ error: "Invalid payment method." }); return; }
    const staff = (req as any).user;
    const staffName = staff.username || staff.email || `Staff #${staff.sub}`;
    let customerId: number;
    if (selectedCustomerId && Number(selectedCustomerId) > 0) {
      const found = await findCustomerById(Number(selectedCustomerId));
      if (found) { customerId = found.id; } else { res.status(400).json({ error: "Customer not found." }); return; }
    } else {
      let walkIn = await queryOne("SELECT id FROM customers WHERE email = 'walkin@pos'") as any;
      if (!walkIn) {
        const r = await queryOne(
        "INSERT INTO customers (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id", ["Walk-in Customer", "walkin@pos", "", "0"]) as any;
        walkIn = { id: r!.id };
      }
      customerId = walkIn.id;
    }
    let subtotal = 0;
    const resolvedItems: any[] = [];
    for (const item of items) {
      const product = await getProduct(item.productId);
      if (!product) { res.status(400).json({ error: `Product ${item.productId} not found.` }); return; }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) { res.status(400).json({ error: `Invalid quantity for ${product.name}.` }); return; }
      // Check stock_on_hand on the product itself
      if (product.stockOnHand !== undefined && product.stockOnHand > 0 && product.stockOnHand < qty) {
        res.status(400).json({ error: `Insufficient stock for ${product.name} (available: ${product.stockOnHand}).` }); return;
      }
      const stock = await getStockLevel(item.productId);
      if (stock && stock.quantityInStock < qty) { res.status(400).json({ error: `Insufficient stock for ${product.name} (available: ${stock.quantityInStock}).` }); return; }
      const lineTotal = product.price * qty;
      subtotal += lineTotal;
      resolvedItems.push({ ...product, quantity: qty, lineTotal });
    }
    const notes = `POS sale | ${pmt.toUpperCase()} | by ${staffName}`;
    let orderId: number;
    try {
      if (idempotencyKey) {
        const r = await queryOne(
          "INSERT INTO orders (customer_id, status, shipping_name, shipping_address, shipping_county, shipping_fee, notes, subtotal, processed_by, idempotency_key) VALUES ($1, 'pending', $2, 'POS Sale', '1', 0, $3, $4, $5, $6) RETURNING id",
          [customerId, customerName || "POS Customer", notes, subtotal, staffName, idempotencyKey]
        ) as any;
        if (!r) { res.status(500).json({ error: "Failed to create order." }); return; }
        orderId = r.id;
      } else {
        const r = await queryOne(
          "INSERT INTO orders (customer_id, status, shipping_name, shipping_address, shipping_county, shipping_fee, notes, subtotal, processed_by) VALUES ($1, 'pending', $2, 'POS Sale', '1', 0, $3, $4, $5) RETURNING id",
          [customerId, customerName || "POS Customer", notes, subtotal, staffName]
        ) as any;
        if (!r) { res.status(500).json({ error: "Failed to create order." }); return; }
        orderId = r.id;
      }
    } catch (insertErr: any) {
      if (insertErr?.code === "23505") {
        // Duplicate primary key — fix sequence and retry once
        await query("SELECT setval('orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1))");
        const r2 = await queryOne(
          "INSERT INTO orders (customer_id, status, shipping_name, shipping_address, shipping_county, shipping_fee, notes, subtotal, processed_by) VALUES ($1, 'pending', $2, 'POS Sale', '1', 0, $3, $4, $5) RETURNING id",
          [customerId, customerName || "POS Customer", notes, subtotal, staffName]
        ) as any;
        if (!r2) { res.status(500).json({ error: "Failed to create order after retry." }); return; }
        orderId = r2.id;
      } else { throw insertErr; }
    }
    for (const item of resolvedItems) {
      const hw = item.hasWarranty ? 1 : 0;
      const wd = item.warrantyDuration || 0;
      const tx = (item.taxable !== false) ? 1 : 0;
      await query("INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total, has_warranty, warranty_duration, taxable) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [orderId, item.id, item.name, item.price, item.quantity, item.lineTotal, hw, wd, tx]);
    }
    // Deduct stock_on_hand for each product
    for (const item of resolvedItems) {
      try {
        await query(`UPDATE products SET stock_on_hand = GREATEST(stock_on_hand - $1, 0) WHERE id = $2`, [item.quantity, item.id]);
      } catch {}
    }
    await updateOrderStatus(orderId, "delivered");
    // Generate invoice number for the order
    const invNum = await generateInvoiceNumber();
    await query("UPDATE orders SET invoice_number = $1 WHERE id = $2", [invNum, orderId]);
    const updated = await getOrder(orderId);
    if (!updated) { res.status(500).json({ error: "Order created but could not be retrieved." }); return; }
    const change = pmt === "cash" && Number(tenderedAmount) > subtotal ? Number(tenderedAmount) - subtotal : 0;
    // Audit log
    await recordAuditLog(staff.sub, staffName, "pos_sale", "order", String(orderId), JSON.stringify({ invoiceNumber: invNum, total: subtotal, paymentMethod: pmt, items: resolvedItems.length }), staff.role || "staff");
    res.status(201).json({ order: { ...updated, invoiceNumber: invNum }, change });
  } catch (err: any) {
    console.error("[POS Checkout Error]", err);
    if (!res.headersSent) res.status(500).json({ error: "Checkout failed. Please try again." });
  }
});

app.get("/api/pos/receipt/:orderId", posAuthMiddleware, async (req: Request, res: Response) => {
  const order = await getOrder(Number(req.params.orderId));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  const format = (req.query.format as string) || "thermal";
  const settings = await getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const kraPin = (await queryOne("SELECT value FROM settings WHERE key = 'kra_pin'"))?.value || "P051234567Z";
  const etimsMode = (await queryOne("SELECT value FROM settings WHERE key = 'etims_mode'"))?.value || "off";
  const invoice = await queryOne("SELECT * FROM order_invoices WHERE order_id = $1", [order.id]);
  const etimsNumber = invoice?.etims_invoice_number || "";
  const controlCode = invoice?.control_code || "";
  const internalData = invoice?.internal_data || "";
  const signatureData = invoice?.signature_data || "";
  const receiptDate = invoice?.receipt_date || "";
  const taxType = invoice?.tax_type || "A";
  const vscuReceiptNo = invoice?.vscu_receipt_no || "";
  const taxRate = Number(settings.taxRate || 16);
  const total = order.subtotal + (order.shippingFee || 0);
  const modeLabel = etimsMode === "off" ? "OFF" : etimsMode === "vscu" ? "VSCU" : "OSCU";
  const hasEtims = !!(invoice?.etims_invoice_number);
  const thermalItemsHtml = order.items.map((i: any) => {
    const isTx = i.taxable !== false;
    const vat = isTx ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0;
    const tt = isTx ? taxType : "E";
    let warrantyLine = "";
    if (i.hasWarranty) {
      const expiry = new Date(order.createdAt);
      expiry.setMonth(expiry.getMonth() + (i.warrantyDuration || 0));
      warrantyLine = `<div style="font-size:0.65rem;color:#6b7280;">Warranty: ${i.warrantyDuration}mo (exp ${expiry.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })})</div>`;
    }
    return `<tr><td>${escapeHtml(i.name)}${warrantyLine ? "<br>" + warrantyLine : ""}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.lineTotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${isTx ? currency + " " + vat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}</td><td style="font-size:0.7rem;text-align:center">${tt}</td></tr>`;
  }).join("");
  const totalVat = order.items.reduce((s: number, i: any) => {
    return s + (i.taxable !== false ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0);
  }, 0);
  const qrData = JSON.stringify({ inv: etimsNumber, dc: controlCode, pin: kraPin, amt: total, dt: order.createdAt, ri: vscuReceiptNo });
  const qrUrl = hasEtims ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}` : "";
  const qrSmall = format === "thermal" && qrUrl ? qrUrl.replace("size=120x120", "size=100x100") : qrUrl;

  if (format === "a4") {
    const a4ItemsHtml = order.items.map((i: any) => {
      const isTx = i.taxable !== false;
      const vat = isTx ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0;
      const tt = isTx ? taxType : "E";
      let warranty = "\u2014";
      if (i.hasWarranty) {
        const expiry = new Date(order.createdAt);
        expiry.setMonth(expiry.getMonth() + (i.warrantyDuration || 0));
        warranty = `Yes (exp: ${expiry.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })})`;
      }
      return `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.lineTotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${isTx ? currency + " " + vat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Exempt"}</td><td style="font-size:0.75rem;text-align:center">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
    }).join("");
    const title = hasEtims ? "E-TIMS TAX INVOICE / RECEIPT" : "TAX INVOICE / RECEIPT";
    const subtitle = hasEtims ? `Invoice #${order.id} | ${escapeHtml(modeLabel)} Receipt #${escapeHtml(vscuReceiptNo)}` : `Invoice #${order.id}`;
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${store}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.6rem 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; white-space:nowrap; }
  .total-row { font-weight: 700; font-size: 1.1rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; font-size: 0.9rem; }
  .info-grid .label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  .print-btn { display: block; margin: 1.5rem auto 0; padding: 0.6rem 2rem; background: #1f2937; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .print-btn:hover { background: #374151; }
  .etims-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 0.75rem; margin: 1rem 0; font-size: 0.82rem; }
  .etims-box strong { color: #166534; }
  .vscu-data { font-size: 0.7rem; word-break: break-all; color: #6b7280; margin-top: 0.5rem; padding: 0.5rem; background: #f9fafb; border-radius: 6px; }
  @media print { body { margin: 0; } .invoice { border: none; } .print-btn { display: none; } }
</style></head><body>
<div class="invoice">
  <div class="header">
    <div>${renderStoreLogo(settings.storeLogo || "", settings.logoPosition || "top-left", store)}<h1>${title}</h1><p class="meta">${subtitle}</p></div>
    <div style="text-align:right;"><strong>${escapeHtml(store)}</strong><br><span class="meta">${escapeHtml(storeEmail)}</span></div>
  </div>
  ${etimsNumber ? `<div class="etims-box"><strong>eTIMS No:</strong> ${escapeHtml(etimsNumber)} | <strong>Control Code:</strong> ${escapeHtml(controlCode)} | <strong>KRA PIN:</strong> ${escapeHtml(kraPin)} | <strong>Mode:</strong> ${modeLabel}</div>` : ""}
  <div class="info-grid">
    <div>
      <div class="label">Bill to</div>
      <div><strong>${escapeHtml(order.shippingName || order.customerName)}</strong></div>
      <div>${escapeHtml(order.shippingAddress || "")}</div>
      <div>${escapeHtml(order.shippingCity || "")}${order.shippingCounty ? ", " + escapeHtml(order.shippingCounty) : ""}</div>
      ${order.shippingPhone ? `<div>${escapeHtml(order.shippingPhone)}</div>` : ""}
    </div>
    <div>
      <div class="label">Order details</div>
      <div>Date: ${receiptDate || new Date(order.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</div>
      <div>Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
      <div>Tax Type: ${taxType === "A" ? "VAT A (16%)" : "Not Subject (E)"}</div>
      ${hasEtims ? `<div>Mode: ${modeLabel}</div>` : ""}
    </div>
  </div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th><th style="text-align:right">VAT</th><th style="text-align:center">TT</th><th>Warranty</th></tr></thead><tbody>
    ${a4ItemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div>Subtotal: ${currency} ${order.subtotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
  ${internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  ${hasEtims ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — Payment via M-Pesa | ${escapeHtml(storeEmail)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>` : `
  <div style="text-align:center;margin-top:1.5rem;font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — ${escapeHtml(storeEmail)}</div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>`}
  <div style="text-align:center;font-size:0.7rem;color:#9ca3af;margin-top:0.5rem;">Provided by ${escapeHtml(store)}</div>
</div>
</body></html>`);
    return;
  }

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>POS Receipt #${order.id} — ${escapeHtml(store)}</title>
<style>
  body { font-family: monospace; max-width: 380px; margin: 0 auto; padding: 0.75rem; font-size: 0.9rem; color: #1f2937; line-height: 1.6; }
  h1 { font-size: 1.15rem; text-align: center; margin: 0.75rem 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
  th, td { padding: 0.35rem 0; text-align: left; }
  .total { font-weight: 700; font-size: 1.1rem; border-top: 1px dashed #000; padding-top: 0.6rem; }
  .center { text-align: center; }
  hr { border: none; border-top: 1px dashed #000; margin: 0.75rem 0; }
  .print-btn { display: block; margin: 1rem auto; padding: 0.5rem 1.5rem; background: #1f2937; color: #fff; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
  .footer-note { text-align: center; font-size: 0.7rem; color: #9ca3af; margin-top: 0.75rem; border-top: 1px solid #e5e7eb; padding-top: 0.5rem; }
  @media print { body { margin: 0; } .print-btn { display: none; } }
</style></head><body>
${renderStoreLogo(settings.storeLogo || "", settings.logoPosition || "top-left", store)}
<h1>${escapeHtml(store)}</h1>
<div class="center">${escapeHtml(storeEmail)}</div>
<hr>
<div class="center"><strong>${hasEtims ? "E-TIMS TAX RECEIPT" : "SALES RECEIPT"}</strong></div>
${hasEtims ? `
<div>eTIMS No: ${escapeHtml(etimsNumber)}</div>
<div>Control Code: ${escapeHtml(controlCode)}</div>
<div>Receipt No (${modeLabel}): ${vscuReceiptNo}</div>
${internalData ? `<div style="font-size:0.65rem;word-break:break-all">Int Data: ${escapeHtml(internalData.slice(0, 20))}...</div>` : ""}` : ""}
<div>Date: ${receiptDate || new Date(order.createdAt).toLocaleString("en-GB")}</div>
<div>Receipt #: ${order.id}</div>
${hasEtims ? `<div>KRA PIN: ${escapeHtml(kraPin)}</div>` : ""}
<div>Tax Type: ${taxType === "A" ? "VAT 16% (A)" : "Not Subject (E)"}</div>
${hasEtims ? `<div>Mode: ${modeLabel}</div>` : ""}
<hr>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th><th style="text-align:right">VAT</th><th style="text-align:center">T</th></tr></thead><tbody>${thermalItemsHtml}</tbody></table>
<hr>
<div class="total">Total: ${currency} ${total.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
<div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
<hr>
${hasEtims ? `<div class="center">${qrUrl ? `<img src="${qrSmall}" alt="eTIMS QR" style="width:80px;height:80px;" /><br>` : ""}Verify at https://itax.kra.go.ke</div>` : ""}
<button class="print-btn" onclick="window.print()">${hasEtims ? "Print Receipt" : "Print / Save PDF"}</button>
<div class="footer-note">Provided by ${escapeHtml(store)}</div>
</body></html>`);
});

app.get("/api/pos/customers", posAuthMiddleware, async (req: Request, res: Response) => {
  const q = (req.query.q as string || "").trim();
  if (q.length < 2) { res.json({ customers: [] }); return; }
  const like = `%${q}%`;
  const rows = await queryAll("SELECT id, name, email, phone FROM customers WHERE name LIKE $1 OR email LIKE $2 OR phone LIKE $3 LIMIT 20", [like, like, like]) as any[];
  res.json({ customers: rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone || "" })) });
});

app.post("/api/orders", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { shippingName, shippingAddress, shippingCounty, shippingPhone, notes, mpesaPhone, couponCode, redeemPoints } = req.body || {};
    if (!shippingName || !shippingAddress || !shippingCounty) {
      res.status(400).json({ error: "Shipping name, address, and county are required." }); return;
    }
    const shippingF = getShippingFee(shippingCounty);
    const customerId = (req as any).customer.sub;
    const customerDetails = await findCustomerById(customerId);
    const cartItems = await getCartItems(customerId);
    if (cartItems.length === 0) { res.status(400).json({ error: "Cart is empty." }); return; }
    const order = await createOrder({
      customerId,
      customerName: shippingName,
      customerEmail: customerDetails?.email || "",
      shippingName,
      shippingAddress,
      shippingCity: "",
      shippingCounty,
      shippingPostcode: shippingPhone || "",
      shippingPhone: shippingPhone || "",
      shippingFee: shippingF,
      notes: notes || "",
      items: cartItems.map((ci) => ({ productId: ci.productId, name: ci.name, price: ci.price, quantity: ci.quantity, hasWarranty: ci.hasWarranty, warrantyDuration: ci.warrantyDuration })),
      processedBy: `Customer #${customerId}`,
    });
    await clearCart(customerId);
    let mpesaRequested = false;
    if (mpesaPhone) {
      try {
        const callbackUrl = `${req.protocol}://${req.get("host")}/api/mpesa/callback`;
        const accountRef = `ORD${order.id}`;
        await stkPush(mpesaPhone, order.subtotal + shippingF, accountRef, callbackUrl);
        mpesaRequested = true;
      } catch (err: any) {
        console.error("M-Pesa STK push failed:", err.message);
      }
    }
    res.status(201).json({ ...order, mpesaRequested, mpesaPhone: mpesaRequested ? mpesaPhone : undefined });
  } catch (err: any) {
    console.error("[order create]", err?.message || err);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.get("/api/orders", customerAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ orders: await listOrders((req as any).customer.sub) });
});

app.get("/api/orders/:id", customerAuthMiddleware, async (req: Request, res: Response) => {
  const order = await getOrder(Number(req.params.id));
  if (!order || order.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Order not found." }); return; }
  res.json(order);
});

app.post("/api/orders/create-pending", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer.sub;
    const customerDetails = await findCustomerById(customerId);
    const cartItems = await getCartItems(customerId);
    if (cartItems.length === 0) { res.status(400).json({ error: "Cart is empty." }); return; }
    const order = await createOrder({
      customerId,
      customerName: customerDetails?.name || "",
      customerEmail: customerDetails?.email || "",
      shippingName: "",
      shippingAddress: "",
      shippingCity: "",
      shippingCounty: "",
      shippingPostcode: "",
      shippingPhone: "",
      shippingFee: 0,
      notes: "",
      items: cartItems.map((ci) => ({ productId: ci.productId, name: ci.name, price: ci.price, quantity: ci.quantity, hasWarranty: ci.hasWarranty, warrantyDuration: ci.warrantyDuration })),
      processedBy: `Customer #${customerId}`,
    });
    await clearCart(customerId);
    res.status(201).json(order);
  } catch (err: any) {
    console.error("[order create-pending]", err?.message || err);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.patch("/api/orders/:id", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const customerId = (req as any).customer.sub;
    const order = await getOrder(orderId);
    if (!order || order.customerId !== customerId) { res.status(404).json({ error: "Order not found." }); return; }
    if (order.status !== "pending") { res.status(400).json({ error: "Can only edit a pending order." }); return; }
    const { shippingName, shippingAddress, shippingCounty, shippingPhone, notes, paymentMethod } = req.body || {};
    const shippingF = shippingCounty ? getShippingFee(shippingCounty) : undefined;
    await updateOrderDetails(orderId, {
      ...(shippingName !== undefined && { shippingName }),
      ...(shippingAddress !== undefined && { shippingAddress }),
      ...(shippingCounty !== undefined && { shippingCounty }),
      ...(shippingPhone !== undefined && { shippingPhone }),
      ...(notes !== undefined && { notes }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(shippingF !== undefined && { shippingFee: shippingF }),
    });
    const updated = await getOrder(orderId);
    res.json(updated);
  } catch (err: any) {
    console.error("[order update]", err?.message || err);
    res.status(500).json({ error: "Failed to update order." });
  }
});

app.get("/api/provider/orders", providerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await listOrders();
    const providerId = (req as any).provider?.sub;
    const filtered = orders.filter((o: any) => o.items?.some((i: any) => i.providerId === providerId));
    res.json({ orders: filtered });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load orders." });
  }
});

app.get("/api/provider/orders/:id", providerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await getOrder(Number(req.params.id));
    if (!order) { res.status(404).json({ error: "Order not found." }); return; }
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load order." });
  }
});

app.patch("/api/provider/orders/:id/items/:itemId/cancel", providerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const ok = await cancelOrderItem(Number(req.params.itemId));
    if (!ok) { res.status(404).json({ error: "Item not found." }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to cancel item." });
  }
});

app.patch("/api/provider/orders/:id/status", providerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body || {};
    if (!["confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
      res.status(400).json({ error: "Invalid status." }); return;
    }
    const ok = await updateOrderStatus(Number(req.params.id), status);
    if (!ok) { res.status(404).json({ error: "Order not found." }); return; }
    const updatedOrder = await getOrder(Number(req.params.id));
    if (updatedOrder && updatedOrder.customerEmail) {
      const { subject: emailSub, html } = orderStatusEmail(updatedOrder.customerName || "Customer", `#${updatedOrder.id}`, status, `${process.env.BASE_URL || "http://localhost:3000"}/order?id=${updatedOrder.id}`);
      sendEmail(updatedOrder.customerEmail, emailSub, html, "order_status");
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update order status." });
  }
});

app.get("/api/admin/orders", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ orders: await listOrders() });
});

app.get("/api/admin/orders/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await getOrder(Number(req.params.id));
    if (!order) { res.status(404).json({ error: "Order not found." }); return; }
    res.json(order);
  } catch (err: any) {
    console.error("[order detail]", err?.message || err);
    res.status(500).json({ error: "Failed to load order." });
  }
});

app.patch("/api/admin/orders/:id/status", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
    res.status(400).json({ error: "Invalid status." }); return;
  }
  const ok = await updateOrderStatus(Number(req.params.id), status);
  if (!ok) { res.status(404).json({ error: "Order not found." }); return; }
  res.json({ ok: true });
  const order = await getOrder(Number(req.params.id));
  if (order && order.customerEmail) {
    const { subject: emailSub, html } = orderStatusEmail(order.customerName || "Customer", `#${order.id}`, status, `${process.env.BASE_URL || "http://localhost:3000"}/order?id=${order.id}`);
    sendEmail(order.customerEmail, emailSub, html, "order_status");
  }
});

app.patch("/api/admin/order-items/:id/warranty", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { hasWarranty, warrantyDuration } = req.body || {};
  await updateOrderItemWarranty(0, Number(req.params.id), Boolean(hasWarranty), Number(warrantyDuration) || 0);
  res.json({ ok: true });
});

app.post("/api/admin/invoice-token/:orderId", staffAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await getOrder(Number(req.params.orderId));
    if (!order) { res.status(404).json({ error: "Order not found." }); return; }
    const token = signToken({ sub: (req as any).user.sub, role: (req as any).user.role, orderId: Number(req.params.orderId), purpose: "invoice" }, "5m");
    res.json({ token });
  } catch (err: any) {
    console.error("[invoice-token] error:", err?.message || err);
    res.status(500).json({ error: "Failed to generate invoice token." });
  }
});

app.get("/api/admin/orders/:id/invoice", async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  if (!token) { res.status(401).json({ error: "Login required." }); return; }
  try {
    const payload = verifyToken(token) as any;
    if (payload.role !== "admin" && payload.role !== "owner") {
      if (payload.purpose !== "invoice" || payload.orderId !== Number(req.params.id)) { res.status(403).json({ error: "Access denied." }); return; }
    }
    (req as any).user = payload;
  } catch { res.status(401).json({ error: "Session expired." }); return; }
  try {
  const order = await getOrder(Number(req.params.id));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  const settings = await getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const kraPin = (await queryOne("SELECT value FROM settings WHERE key = 'kra_pin'"))?.value || "P051234567Z";
  const etimsMode = (await queryOne("SELECT value FROM settings WHERE key = 'etims_mode'"))?.value || "off";
  const invoice = await queryOne("SELECT * FROM order_invoices WHERE order_id = $1", [order.id]);
  const etimsNumber = invoice?.etims_invoice_number || "";
  const controlCode = invoice?.control_code || "";
  const internalData = invoice?.internal_data || "";
  const signatureData = invoice?.signature_data || "";
  const receiptDate = invoice?.receipt_date || "";
  const taxType = invoice?.tax_type || "A";
  const vscuReceiptNo = invoice?.vscu_receipt_no || "";
  const taxRate = Number(settings.taxRate || 16);
  const hasEtims = !!(invoice?.etims_invoice_number);
  const itemsHtml = order.items.map((i: any) => {
    let warranty = "\u2014";
    if (i.hasWarranty) {
      const expiry = new Date(order.createdAt);
      expiry.setMonth(expiry.getMonth() + (i.warrantyDuration || 0));
      warranty = `Yes (exp: ${expiry.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })})`;
    }
    const isTx = i.taxable !== false;
    const vat = isTx ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0;
    const tt = isTx ? taxType : "E";
    return `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.lineTotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${isTx ? currency + " " + vat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Exempt"}</td><td style="font-size:0.75rem;text-align:center">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
  }).join("");
  const total = order.subtotal + (order.shippingFee || 0);
  const totalVat = order.items.reduce((s: number, i: any) => {
    return s + (i.taxable !== false ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0);
  }, 0);
  const qrData = JSON.stringify({ inv: etimsNumber, dc: controlCode, pin: kraPin, amt: total, dt: order.createdAt, ri: vscuReceiptNo });
  const qrUrl = hasEtims ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}` : "";
  const modeLabel = etimsMode === "off" ? "OFF" : etimsMode === "vscu" ? "VSCU" : "OSCU";
  const invoiceTitle = hasEtims ? "E-TIMS TAX INVOICE / RECEIPT" : "TAX INVOICE / RECEIPT";
  const invoiceSubtitle = hasEtims ? `Invoice #${order.id} | ${escapeHtml(modeLabel)} Receipt #${escapeHtml(vscuReceiptNo)}` : `Invoice #${order.id}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${store}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.6rem 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; white-space:nowrap; }
  .total-row { font-weight: 700; font-size: 1.1rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; font-size: 0.9rem; }
  .info-grid .label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  .print-btn { display: block; margin: 1.5rem auto 0; padding: 0.6rem 2rem; background: #1f2937; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .print-btn:hover { background: #374151; }
  .etims-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 0.75rem; margin: 1rem 0; font-size: 0.82rem; }
  .etims-box strong { color: #166534; }
  .vscu-data { font-size: 0.7rem; word-break: break-all; color: #6b7280; margin-top: 0.5rem; padding: 0.5rem; background: #f9fafb; border-radius: 6px; }
  @media print { body { margin: 0; } .invoice { border: none; } .print-btn { display: none; } }
</style></head><body>
<div class="invoice">
  <div class="header">
    <div>${renderStoreLogo(settings.storeLogo || "", settings.logoPosition || "top-left", store)}<h1>${invoiceTitle}</h1><p class="meta">${invoiceSubtitle}</p></div>
    <div style="text-align:right;"><strong>${escapeHtml(store)}</strong><br><span class="meta">${escapeHtml(storeEmail)}</span></div>
  </div>
  ${etimsNumber ? `<div class="etims-box"><strong>eTIMS No:</strong> ${escapeHtml(etimsNumber)} | <strong>Control Code:</strong> ${escapeHtml(controlCode)} | <strong>KRA PIN:</strong> ${escapeHtml(kraPin)} | <strong>Mode:</strong> ${modeLabel}</div>` : ""}
  <div class="info-grid">
    <div>
      <div class="label">Bill to</div>
      <div><strong>${escapeHtml(order.shippingName || order.customerName)}</strong></div>
      <div>${escapeHtml(order.shippingAddress || "")}</div>
      <div>${escapeHtml(order.shippingCity || "")}${order.shippingCounty ? ", " + escapeHtml(order.shippingCounty) : ""}</div>
      ${order.shippingPhone ? `<div>${escapeHtml(order.shippingPhone)}</div>` : ""}
    </div>
    <div>
      <div class="label">Order details</div>
      <div>Date: ${receiptDate || new Date(order.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</div>
      <div>Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
      <div>Tax Type: ${taxType === "A" ? "VAT A (16%)" : "Not Subject (E)"}</div>
      ${hasEtims ? `<div>Mode: ${modeLabel}</div>` : ""}
    </div>
  </div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th><th style="text-align:right">VAT</th><th style="text-align:center">TT</th><th>Warranty</th></tr></thead><tbody>
    ${itemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div>Subtotal: ${currency} ${order.subtotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
  ${internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  ${hasEtims ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — Payment via M-Pesa | ${escapeHtml(storeEmail)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>` : `
  <div style="text-align:center;margin-top:1.5rem;font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — ${escapeHtml(storeEmail)}</div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>`}
  <div style="text-align:center;font-size:0.7rem;color:#9ca3af;margin-top:0.5rem;">Provided by ${escapeHtml(store)}</div>
</div>
</body></html>`;
  if (req.query.format === "pdf") {
    try {
      const pdf = await htmlToPdf(html);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.id}.pdf"`);
      res.send(pdf);
    } catch (pdfErr: any) {
      console.error("[invoice] PDF generation error:", pdfErr?.message || pdfErr);
      res.send(html);
    }
  } else {
    res.send(html);
  }
  } catch (err: any) {
    console.error("[invoice] admin invoice error:", err?.message || err);
    res.status(500).send("<h1>Failed to generate invoice</h1><p>Please try again.</p>");
  }
});

app.post("/api/orders/invoice-token/:orderId", customerAuthMiddleware, async (req: Request, res: Response) => {
  const order = await getOrder(Number(req.params.orderId));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  if (order.customerId !== (req as any).customer.sub) { res.status(403).json({ error: "Access denied." }); return; }
  const token = signToken({ sub: (req as any).customer.sub, role: "customer", orderId: Number(req.params.orderId), purpose: "invoice" }, "5m");
  res.json({ token });
});

app.get("/api/orders/:id/invoice", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
  const order = await getOrder(Number(req.params.id));
  if (!order || order.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Order not found." }); return; }
  if (order.status !== "shipped" && order.status !== "delivered") { res.status(400).json({ error: "Invoice is only available for shipped or delivered orders." }); return; }
  const settings = await getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const kraPin = (await queryOne("SELECT value FROM settings WHERE key = 'kra_pin'"))?.value || "P051234567Z";
  const etimsMode = (await queryOne("SELECT value FROM settings WHERE key = 'etims_mode'"))?.value || "off";
  const invoice = await queryOne("SELECT * FROM order_invoices WHERE order_id = $1", [order.id]);
  const etimsNumber = invoice?.etims_invoice_number || "";
  const controlCode = invoice?.control_code || "";
  const internalData = invoice?.internal_data || "";
  const signatureData = invoice?.signature_data || "";
  const receiptDate = invoice?.receipt_date || "";
  const taxType = invoice?.tax_type || "A";
  const vscuReceiptNo = invoice?.vscu_receipt_no || "";
  const taxRate = Number(settings.taxRate || 16);
  const hasEtims = !!(invoice?.etims_invoice_number);
  const itemsHtml = order.items.map((i: any) => {
    let warranty = "\u2014";
    if (i.hasWarranty) {
      const expiry = new Date(order.createdAt);
      expiry.setMonth(expiry.getMonth() + (i.warrantyDuration || 0));
      warranty = `Yes (exp: ${expiry.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })})`;
    }
    const isTx = i.taxable !== false;
    const vat = isTx ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0;
    const tt = isTx ? taxType : "E";
    return `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.lineTotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${isTx ? currency + " " + vat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Exempt"}</td><td style="font-size:0.75rem;text-align:center">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
  }).join("");
  const total = order.subtotal + (order.shippingFee || 0);
  const totalVat = order.items.reduce((s: number, i: any) => {
    return s + (i.taxable !== false ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0);
  }, 0);
  const qrData = JSON.stringify({ inv: etimsNumber, dc: controlCode, pin: kraPin, amt: total, dt: order.createdAt, ri: vscuReceiptNo });
  const qrUrl = hasEtims ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}` : "";
  const modeLabel = etimsMode === "off" ? "OFF" : etimsMode === "vscu" ? "VSCU" : "OSCU";
  const invoiceTitle = hasEtims ? "E-TIMS TAX INVOICE / RECEIPT" : "TAX INVOICE / RECEIPT";
  const invoiceSubtitle = hasEtims ? `Invoice #${order.id} | ${escapeHtml(modeLabel)} Receipt #${escapeHtml(vscuReceiptNo)}` : `Invoice #${order.id}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${store}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.6rem 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; white-space:nowrap; }
  .total-row { font-weight: 700; font-size: 1.1rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; font-size: 0.9rem; }
  .info-grid .label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  .print-btn { display: block; margin: 1.5rem auto 0; padding: 0.6rem 2rem; background: #1f2937; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .print-btn:hover { background: #374151; }
  .etims-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 0.75rem; margin: 1rem 0; font-size: 0.82rem; }
  .etims-box strong { color: #166534; }
  .vscu-data { font-size: 0.7rem; word-break: break-all; color: #6b7280; margin-top: 0.5rem; padding: 0.5rem; background: #f9fafb; border-radius: 6px; }
  @media print { body { margin: 0; } .invoice { border: none; } .print-btn { display: none; } }
</style></head><body>
<div class="invoice">
  <div class="header">
    <div>${renderStoreLogo(settings.storeLogo || "", settings.logoPosition || "top-left", store)}<h1>${invoiceTitle}</h1><p class="meta">${invoiceSubtitle}</p></div>
    <div style="text-align:right;"><strong>${escapeHtml(store)}</strong><br><span class="meta">${escapeHtml(storeEmail)}</span></div>
  </div>
  ${etimsNumber ? `<div class="etims-box"><strong>eTIMS No:</strong> ${escapeHtml(etimsNumber)} | <strong>Control Code:</strong> ${escapeHtml(controlCode)} | <strong>KRA PIN:</strong> ${escapeHtml(kraPin)} | <strong>Mode:</strong> ${modeLabel}</div>` : ""}
  <div class="info-grid">
    <div>
      <div class="label">Bill to</div>
      <div><strong>${escapeHtml(order.shippingName || order.customerName)}</strong></div>
      <div>${escapeHtml(order.shippingAddress || "")}</div>
      <div>${escapeHtml(order.shippingCity || "")}${order.shippingCounty ? ", " + escapeHtml(order.shippingCounty) : ""}</div>
      ${order.shippingPhone ? `<div>${escapeHtml(order.shippingPhone)}</div>` : ""}
    </div>
    <div>
      <div class="label">Order details</div>
      <div>Date: ${receiptDate || new Date(order.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</div>
      <div>Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
      <div>Tax Type: ${taxType === "A" ? "VAT A (16%)" : "Not Subject (E)"}</div>
      ${hasEtims ? `<div>Mode: ${modeLabel}</div>` : ""}
    </div>
  </div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th><th style="text-align:right">VAT</th><th style="text-align:center">TT</th><th>Warranty</th></tr></thead><tbody>
    ${itemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div>Subtotal: ${currency} ${order.subtotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
  ${internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  ${hasEtims ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — Payment via M-Pesa | ${escapeHtml(storeEmail)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>` : `
  <div style="text-align:center;margin-top:1.5rem;font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — ${escapeHtml(storeEmail)}</div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>`}
  <div style="text-align:center;font-size:0.7rem;color:#9ca3af;margin-top:0.5rem;">Provided by ${escapeHtml(store)}</div>
</div>
</body></html>`;
  if (req.query.format === "pdf") {
    try {
      const pdf = await htmlToPdf(html);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.id}.pdf"`);
      res.send(pdf);
    } catch (pdfErr: any) {
      console.error("[invoice] customer PDF generation error:", pdfErr?.message || pdfErr);
      res.send(html);
    }
  } else {
    res.send(html);
  }
  } catch (err: any) {
    console.error("[invoice] customer invoice error:", err?.message || err);
    res.status(500).send("<h1>Failed to generate invoice</h1><p>Please try again.</p>");
  }
});

function escapeHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderStoreLogo(logoUrl: string, position: string, storeName: string): string {
  if (!logoUrl) return "";
  const pos = position || "top-left";
  if (pos === "top-left") return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)} Logo" style="max-height:64px;max-width:200px;margin-bottom:0.5rem;" />`;
  if (pos === "top-middle") return `<div style="text-align:center;margin-bottom:0.5rem;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)} Logo" style="max-height:64px;max-width:200px;" /></div>`;
  if (pos === "top-right") return `<div style="text-align:right;margin-bottom:0.5rem;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)} Logo" style="max-height:64px;max-width:200px;" /></div>`;
  return "";
}

// ============ PRODUCT ANALYTICS ============

app.post("/api/products/:id/view", async (req: Request, res: Response) => {
  await recordProductView(String(req.params.id), req.body?.viewerType || "anonymous");
  res.json({ ok: true });
});

app.get("/api/admin/stats/popular", adminAuthMiddleware, async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  res.json({ products: await getPopularProducts(limit), totalViews: await getTotalViews() });
});

// ============ INVOICES ============

app.get("/api/provider/invoices", providerAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ invoices: await listInvoices((req as any).provider.sub) });
});

app.get("/api/admin/invoices", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ invoices: await listInvoices(), revenue: await getInvoiceRevenue() });
});

app.post("/api/admin/invoices/generate", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { providerId, planId } = req.body || {};
  if (!providerId) { res.status(400).json({ error: "Provider ID is required." }); return; }
  const invoice = await generateProviderInvoice(Number(providerId), planId || "starter");
  if (!invoice) { res.status(400).json({ error: "Could not generate invoice. Provider may have no active plan or plan is free." }); return; }
  res.status(201).json(invoice);
});

app.post("/api/admin/invoices/:id/pay", adminAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await markInvoicePaid(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Invoice not found." }); return; }
  res.json({ ok: true });
});

// ============ ORDER INVOICES ============

app.get("/api/admin/order-invoices", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ invoices: await listOrderInvoices() });
});

app.post("/api/admin/order-invoices/:id/pay", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await markOrderInvoicePaid(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Invoice not found." }); return; }
  res.json({ ok: true });
});

// ============ CREDIT NOTES ============

app.get("/api/admin/credit-notes", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ creditNotes: await listCreditNotes() });
});

app.get("/api/admin/credit-notes/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const cn = await getCreditNote(Number(req.params.id));
  if (!cn) { res.status(404).json({ error: "Credit note not found." }); return; }
  res.json(cn);
});

app.post("/api/admin/credit-notes", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { orderId, reason, reasonCode } = req.body || {};
  if (!orderId) { res.status(400).json({ error: "orderId is required." }); return; }
  const user = (req as any).user;
  const resolvedReasonCode = typeof reasonCode === "string" && reasonCode.trim() ? reasonCode : "13";
  const existingNotes = await listCreditNotes(Number(orderId));
  if (existingNotes.length > 0) { res.status(400).json({ error: "A credit note has already been created for this order." }); return; }
  const order = await getOrder(Number(orderId));
  if (!order) { res.status(400).json({ error: "Order not found or credit note creation failed." }); return; }
  const orderItems = (order.items || []).map((i: any) => ({
    orderItemId: i.id, productId: i.productId, name: i.name, price: i.price, quantity: i.quantity
  }));
  const cn = await createCreditNote({ orderId: Number(orderId), reason: reason || "", createdBy: user.sub, reasonCode: resolvedReasonCode, items: orderItems });
  if (!cn) { res.status(400).json({ error: "Order not found or credit note creation failed." }); return; }

  const etimsData = {
    cnNumber: `CN-${cn.id}`,
    controlCode: "",
    serialNumber: cn.id,
    internalData: "",
    signatureData: "",
  };
  await submitCreditNoteToEtims(cn.id, etimsData);
  const finalCn = await getCreditNote(cn.id);
  res.status(201).json(finalCn || cn);
  if (order.customerEmail) {
    const settings = await getSettings();
    const { subject: emailSub, html } = creditNoteEmail(order.customerName || "Customer", cn.id, reason || "", String(cn.totalAmount || order.subtotal || 0), settings.currency, `${process.env.BASE_URL || "http://localhost:3000"}/order?id=${order.id}`);
    sendEmail(order.customerEmail, emailSub, html, "credit_note");
  }
});

app.get("/api/admin/credit-notes/order-status", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { orderIds } = req.query;
  if (!orderIds) { res.status(400).json({ error: "orderIds query param required." }); return; }
  const ids = String(orderIds).split(",").map(Number).filter(Boolean);
  const result: Record<number, boolean> = {};
  for (const orderId of ids) {
    const notes = await listCreditNotes(orderId);
    result[orderId] = notes.length > 0;
  }
  res.json({ credited: result });
});

app.get("/api/admin/credit-notes/:id/view", staffAuthMiddleware, async (req: Request, res: Response) => {
  try {
  const cn = await getCreditNote(Number(req.params.id));
  if (!cn) { res.status(404).send("Credit note not found."); return; }
  const order = await getOrder(cn.orderId);
  if (!order) { res.status(404).send("Order not found."); return; }
  const settings = await getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "";
  const currency = settings.currency || "KES";
  const etimsNumber = cn.etimsCnNumber || "";
  const controlCode = cn.etimsControlCode || "";
  const etimsSerialNumber = cn.etimsSerialNumber ? String(cn.etimsSerialNumber) : "";
  const submissionStatus = cn.status === "submitted" ? "Submitted to eTIMS" : "Pending eTIMS submission";
  const submittedAt = cn.etimsSubmittedAt || "";
  const internalData = cn.etimsInternalData || "";
  const signatureData = cn.etimsSignatureData || "";

  const itemsHtml = cn.items.map((i: any) =>
    `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td style="text-align:right;white-space:nowrap">${currency} ${i.lineTotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Credit Note #${cn.id} — ${store}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .cn { border: 2px solid #dc2626; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #dc2626; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; color: #dc2626; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.6rem 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; white-space:nowrap; }
  .total-row { font-weight: 700; font-size: 1.1rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; font-size: 0.9rem; }
  .info-grid .label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  .print-btn { display: block; margin: 1.5rem auto 0; padding: 0.6rem 2rem; background: #dc2626; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .print-btn:hover { background: #b91c1c; }
  .badge { display: inline-block; background: #fee2e2; color: #dc2626; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
  .etims-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 0.75rem; margin: 1rem 0; font-size: 0.82rem; }
  .etims-box .label { color: #166534; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.25rem; }
  @media print { body { margin: 0; } .cn { border: none; } .print-btn { display: none; } }
</style></head><body>
<div class="cn">
  <div class="header">
    <div>${renderStoreLogo(settings.storeLogo || "", settings.logoPosition || "top-left", store)}<h1>CREDIT NOTE</h1><p class="meta">Credit Note #${cn.id} | Original Order #${cn.orderId}${etimsNumber ? " | eTIMS Invoice: " + escapeHtml(etimsNumber) : ""}</p></div>
    <div style="text-align:right;"><strong>${escapeHtml(store)}</strong><br><span class="meta">${escapeHtml(storeEmail)}</span></div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
    <span class="badge">${cn.status.toUpperCase()}</span>
    <span style="font-size:0.9rem;color:#6b7280;">Issued: ${new Date(cn.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
  </div>
  ${cn.reason ? `<p style="background:#fef2f2;padding:0.75rem;border-radius:8px;font-size:0.9rem;"><strong>Reason:</strong> ${escapeHtml(cn.reason)}</p>` : ""}
  <div class="info-grid">
    <div>
      <div class="label">Original Order</div>
      <div><strong>Order #${cn.orderId}</strong></div>
      <div>Customer: ${escapeHtml(order.shippingName || order.customerName || "—")}</div>
      <div>Date: ${new Date(order.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</div>
    </div>
    <div>
      <div class="label">eTIMS Credit Note</div>
      <div><strong>${escapeHtml(submissionStatus)}</strong></div>
      <div>Credit Note No: ${etimsNumber ? escapeHtml(etimsNumber) : "Pending"}</div>
      <div>Control Code: ${controlCode ? escapeHtml(controlCode) : "Pending"}</div>
      ${etimsSerialNumber ? `<div>Serial No: ${escapeHtml(etimsSerialNumber)}</div>` : ""}
      ${submittedAt ? `<div>Submitted: ${escapeHtml(submittedAt)}</div>` : ""}
    </div>
  </div>
  ${(internalData || signatureData) ? `<div class="etims-box">
    <div class="label">eTIMS Audit Data</div>
    ${internalData ? `<div><strong>Internal Data:</strong> ${escapeHtml(internalData)}</div>` : ""}
    ${signatureData ? `<div><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  </div>` : ""}
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead><tbody>
    ${itemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div class="total-row">Total Credit: ${currency} ${cn.totalAmount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  <div style="text-align:center;font-size:0.7rem;color:#9ca3af;margin-top:0.5rem;">Provided by ${escapeHtml(store)}</div>
</div>
</body></html>`;
  if (req.query.format === "pdf") {
    try {
      const pdf = await htmlToPdf(html);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="credit-note-${cn.id}.pdf"`);
      res.send(pdf);
    } catch (pdfErr: any) {
      console.error("[credit-notes] PDF generation error:", pdfErr?.message || pdfErr);
      res.send(html);
    }
  } else {
    res.send(html);
  }
  } catch (err: any) {
    console.error("[credit-notes] view error:", err?.message || err);
    res.status(500).send("<html><body><h1>Error loading credit note</h1><p>An error occurred. Please try again.</p></body></html>");
  }
});

// ============ EXAMPLE INVOICE ============

app.get("/api/invoices/example/:id", (req: Request, res: Response) => {
  const invId = Number(req.params.id);
  const examples = [
    { id: 1, providerName: "TechNest Solutions", planName: "Basic", amount: 4500, status: "paid", period: "1 Jun 2026 – 30 Jun 2026", paidAt: "2026-06-01T10:30:00Z", items: [{ desc: "Basic Plan Subscription (Jun 2026)", qty: 1, price: 4500 }] },
    { id: 2, providerName: "TechNest Solutions", planName: "Pro", amount: 15000, status: "pending", period: "1 Jul 2026 – 31 Jul 2026", paidAt: null, items: [{ desc: "Pro Plan Subscription (Jul 2026)", qty: 1, price: 15000 }] },
    { id: 3, providerName: "Digital Hub Ltd", planName: "Enterprise", amount: 45000, status: "overdue", period: "15 May 2026 – 14 Jun 2026", paidAt: null, items: [{ desc: "Enterprise Plan Subscription (May–Jun 2026)", qty: 1, price: 45000 }] },
  ];
  const inv = examples.find(e => e.id === invId);
  if (!inv) { res.status(404).json({ error: "Example invoice not found" }); return; }
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${inv.id} — Example</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 700px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.8rem; text-transform: uppercase; color: #6b7280; }
  .total { text-align: right; font-size: 1.25rem; font-weight: 700; margin-top: 1rem; }
  .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }
  .status.paid { background: #d1fae5; color: #065f46; }
  .status.pending { background: #fef3c7; color: #92400e; }
  .status.overdue { background: #fee2e2; color: #991b1b; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  @media print { body { margin: 0; } .invoice { border: none; } }
</style></head><body>
<div class="invoice">
  <div class="header">
    <div><h1>INVOICE</h1><p class="meta">Invoice #${inv.id}</p></div>
    <div style="text-align:right;"><strong>Gear&Glitch</strong><br><span class="meta">Nairobi, Kenya</span></div>
  </div>
  <p><strong>Bill to:</strong> ${inv.providerName}</p>
  <p><strong>Plan:</strong> ${inv.planName}</p>
  <p><strong>Period:</strong> ${inv.period}</p>
  <table><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
    ${inv.items.map(i => `<tr><td>${i.desc}</td><td>${i.qty}</td><td>KES ${i.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>KES ${(i.price * i.qty).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join("")}
  </tbody></table>
  <div class="total">Total: KES ${inv.amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  <p><span class="status ${inv.status}">${inv.status.toUpperCase()}</span> ${inv.paidAt ? "Paid on " + new Date(inv.paidAt).toLocaleDateString("en-GB") : ""}</p>
  <div class="footer">Gear&Glitch — M-Pesa Till: 123456 | payments@gearandglitch.com</div>
</div>
<script>window.print();</script></body></html>`);
});

app.get("/api/invoices/examples", (req: Request, res: Response) => {
  res.json({ examples: [
    { id: 1, providerName: "TechNest Solutions", planName: "Basic", amount: 4500, status: "paid", period: "1 Jun 2026 – 30 Jun 2026" },
    { id: 2, providerName: "TechNest Solutions", planName: "Pro", amount: 15000, status: "pending", period: "1 Jul 2026 – 31 Jul 2026" },
    { id: 3, providerName: "Digital Hub Ltd", planName: "Enterprise", amount: 45000, status: "overdue", period: "15 May 2026 – 14 Jun 2026" },
  ]});
});

// ============ MESSAGES ============

app.get("/api/messages", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer.sub;
    res.json({ messages: await getMessagesForCustomer(customerId) });
  } catch (err: any) {
    console.error("[messages get]", err?.message || err);
    res.status(500).json({ error: "Failed to load messages." });
  }
});

app.get("/api/provider/messages", providerAuthMiddleware, requireProviderFeature("Customer management"), async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).provider.sub;
    res.json({ messages: await getMessagesForProvider(providerId), unreadCount: await getUnreadMessageCount(0, providerId, "provider") });
  } catch (err: any) {
    console.error("[provider messages get]", err?.message || err);
    res.status(500).json({ error: "Failed to load messages." });
  }
});

app.post("/api/messages", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer.sub;
    const { providerId, productId, subject, body } = req.body || {};
    if (!providerId || !body) { res.status(400).json({ error: "Provider ID and message body are required." }); return; }
    const msg = await sendMessage(customerId, Number(providerId), subject || "", body, "customer", productId);
    res.status(201).json(msg);
    const customer = await findCustomerById(customerId);
    const provider = await findProviderById(Number(providerId));
    if (customer && provider) {
      const { subject: emailSub, html } = messageNotificationEmail(customer.name || customer.email || "Customer", "customer", subject || "", body.substring(0, 300), `${process.env.BASE_URL || "http://localhost:3000"}/dashboard`);
      sendEmail(provider.email, emailSub, html, "message");
      const settings = await getSettings();
      if (settings.emailSender) sendEmail(settings.emailSender, emailSub, html, "message_cc");
    }
  } catch (err: any) {
    console.error("[customer message send]", err?.message || err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

app.post("/api/provider/messages", providerAuthMiddleware, requireProviderFeature("Customer management"), async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).provider.sub;
    const { customerId, productId, subject, body } = req.body || {};
    if (!customerId || !body) { res.status(400).json({ error: "Customer ID and message body are required." }); return; }
    const msg = await sendMessage(Number(customerId), providerId, subject || "", body, "provider", productId);
    res.status(201).json(msg);
    const customer = await findCustomerById(Number(customerId));
    const provider = await findProviderById(providerId);
    if (customer && provider) {
      const { subject: emailSub, html } = messageNotificationEmail(provider.companyName || provider.contactName || "Provider", "provider", subject || "", body.substring(0, 300), `${process.env.BASE_URL || "http://localhost:3000"}/dashboard`);
      if (customer.email) sendEmail(customer.email, emailSub, html, "message");
      const settings = await getSettings();
      if (settings.emailSender) sendEmail(settings.emailSender, emailSub, html, "message_cc");
    }
  } catch (err: any) {
    console.error("[provider message send]", err?.message || err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

app.patch("/api/messages/:id/read", async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (!token) { res.status(401).json({ error: "Login required." }); return; }
    try { verifyToken(token); } catch { res.status(401).json({ error: "Session expired." }); return; }
    await markMessageRead(Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[message read]", err?.message || err);
    res.status(500).json({ error: "Failed to mark message as read." });
  }
});

app.get("/api/messages/providers", customerAuthMiddleware, async (_req: Request, res: Response) => {
  const providers = await queryAll("SELECT id, company_name, contact_name, email FROM providers WHERE status != 'disabled'");
  res.json({ providers });
});

app.get("/api/provider/messages/customers", providerAuthMiddleware, requireProviderFeature("Customer management"), async (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  const customers = await queryAll(`
    SELECT DISTINCT c.id, c.name, c.email FROM customers c
    JOIN messages m ON m.customer_id = c.id
    WHERE m.provider_id = $1
  `, [providerId]);
  res.json({ customers });
});

app.get("/api/customers/search", adminAuthMiddleware, async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (!q) { res.json({ customers: [] }); return; }
  const escaped = q.replace(/[%_]/g, "\\$&");
  const customers = await queryAll(
    "SELECT id, name, email FROM customers WHERE name LIKE $1 OR email LIKE $2 LIMIT 20",
    [`%${escaped}%`, `%${escaped}%`]
  );
  res.json({ customers });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  const categories = await listCategories();
  const subcategories = await listSubcategories();
  res.json({ categories, subcategories });
});

app.post("/api/categories", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { id, label, group, showOnPos } = req.body || {};
  if (!id || !label) {
    res.status(400).json({ error: "Category id and label are required." });
    return;
  }
  if (await getCategory(id)) {
    res.status(409).json({ error: "Category already exists." });
    return;
  }
  const category = await createCategory({
    id: String(id).trim(),
    label: String(label).trim(),
    group: String(group || "").trim(),
    showOnPos: showOnPos !== false,
  });
  res.status(201).json({ category });
});

app.put("/api/categories/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { label, group, showOnPos } = req.body || {};
  const category = await updateCategory(String(req.params.id), {
    label: String(label || "").trim(),
    group: String(group || "").trim(),
    showOnPos: showOnPos !== undefined ? (showOnPos ? 1 : 0) : undefined,
  });
  if (!category) { res.status(404).json({ error: "Category not found." }); return; }
  res.json({ category });
});

app.delete("/api/categories/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const removed = await deleteCategory(String(req.params.id));
  if (!removed) { res.status(404).json({ error: "Category not found." }); return; }
  res.status(204).end();
});

// ============ SUBCATEGORIES ============

app.get("/api/subcategories", async (_req: Request, res: Response) => {
  res.json({ subcategories: await listSubcategories() });
});

app.get("/api/categories/:id/subcategories", async (req: Request, res: Response) => {
  res.json({ subcategories: await getSubcategoriesForCategory(String(req.params.id)) });
});

app.post("/api/subcategories", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { id, name, category_ids } = req.body || {};
  if (!id || !name) {
    res.status(400).json({ error: "Subcategory id and name are required." });
    return;
  }
  if (await getSubcategory(id)) {
    res.status(409).json({ error: "Subcategory already exists." });
    return;
  }
  const sub = await createSubcategory({
    id: String(id).trim(),
    name: String(name).trim(),
    category_ids: category_ids || [],
  });
  res.status(201).json({ subcategory: sub });
});

app.put("/api/subcategories/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { name, category_ids } = req.body || {};
  const sub = await updateSubcategory(String(req.params.id), {
    name: name !== undefined ? String(name).trim() : undefined,
    category_ids: category_ids !== undefined ? category_ids : undefined,
  });
  if (!sub) { res.status(404).json({ error: "Subcategory not found." }); return; }
  res.json({ subcategory: sub });
});

app.delete("/api/subcategories/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const removed = await deleteSubcategory(String(req.params.id));
  if (!removed) { res.status(404).json({ error: "Subcategory not found." }); return; }
  res.status(204).end();
});

function normalizeSpecs(specs: any): any[] {
  if (!specs) return [];
  if (Array.isArray(specs)) {
    return specs.map((s: any) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object" && s.f) return s;
      return String(s);
    });
  }
  return String(specs)
    .split(/[\r\n]+/)
    .map((s: string) => s.trim())
    .filter(Boolean);
}

app.get("/api/products", async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const products = await listProducts(category);
  res.json({ products, currency: (await getSettings()).currency });
});

app.get("/api/products/:id", async (req: Request, res: Response) => {
  try {
    const product = await getProduct(String(req.params.id));
    if (!product) { res.status(404).json({ error: "Product not found." }); return; }
    try { await recordProductView(String(req.params.id), "anonymous"); } catch {}
    res.json(product);
  } catch (err: any) {
    console.error("GET /api/products/:id error:", err?.message || err);
    res.status(500).json({ error: "Failed to load product." });
  }
});

app.post("/api/products", ownerAuthMiddleware, requirePermission("product:create"), async (req: Request, res: Response) => {
  const body = req.body || {};
  const category = body.category;
  if (category && !(await getCategory(category))) {
    res.status(400).json({ error: "Choose a valid category." });
    return;
  }
  const name = String(body.name || "").trim();
  if (!name) { res.status(400).json({ error: "Product name cannot be empty." }); return; }

  const product = await createProduct({
    id: await generateProductId(name),
    name,
    category: body.category || "",
    price: Number(body.price) || 0,
    specs: normalizeSpecs(body.specs),
    inStock: Boolean(body.inStock),
    isNonStock: Boolean(body.isNonStock),
    imageAlt: String(body.imageAlt || "").trim(),
  });
  res.status(201).json(product);
});

app.post("/api/products/import", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { products } = req.body || {};
  if (!Array.isArray(products) || products.length === 0) {
    res.status(400).json({ error: "Request body must contain a non-empty products array." });
    return;
  }
  const required = ["name", "price", "category"];
  let imported = 0;
  const errors: string[] = [];
  for (let i = 0; i < products.length; i++) {
    const row = products[i];
    const missing = required.filter(r => !row[r]);
    if (missing.length > 0) { errors.push(`Row ${i + 1}: missing ${missing.join(", ")}`); continue; }
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) { errors.push(`Row ${i + 1}: invalid price "${row.price}"`); continue; }
    try {
      await createProduct({
        id: await generateProductId(row.name),
        name: String(row.name).trim(),
        category: String(row.category).trim(),
        price,
        specs: [],
        inStock: String(row.inStock).toUpperCase() === "TRUE",
        isNonStock: String(row.isNonStock).toUpperCase() === "TRUE",
        subcategory: String(row.subcategory || "").trim(),
        hasWarranty: String(row.hasWarranty).toUpperCase() === "TRUE",
        warrantyDuration: Number(row.warrantyDuration) || 0,
        taxable: String(row.taxable).toUpperCase() !== "FALSE",
      });
      imported++;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message || "Unknown error"}`);
    }
  }
  if (imported === 0) {
    res.status(400).json({ error: "No products were imported", details: errors.slice(0, 20) });
    return;
  }
  res.json({ imported, errors: errors.length > 0 ? errors.slice(0, 20) : undefined });
});

app.post("/api/admin/products/bulk-edit", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { productIds, updates } = req.body || {};
  if (!Array.isArray(productIds) || productIds.length === 0 || !updates) {
    res.status(400).json({ error: "productIds array and updates object are required." }); return;
  }
  const updated: string[] = [];
  const notFound: string[] = [];
  for (const id of productIds) {
    const p = await getProduct(id);
    if (!p) { notFound.push(id); continue; }
    const change: any = {};
    if (updates.price !== undefined) change.price = Number(updates.price);
    if (updates.inStock !== undefined) change.inStock = Boolean(updates.inStock);
    if (updates.category !== undefined) change.category = String(updates.category).trim();
    if (updates.isNonStock !== undefined) change.isNonStock = Boolean(updates.isNonStock);
    if (updates.taxable !== undefined) change.taxable = Boolean(updates.taxable);
    await updateProduct(id, change);
    updated.push(id);
  }
  res.json({ updated: updated.length, notFound });
});

app.get("/api/admin/products/:id/price-history", ownerAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ history: await getPriceHistory(String(req.params.id)) });
});

app.get("/api/admin/backup", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const { query: q } = require("./db-helpers");
    const tables = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
    const backup: Record<string, unknown[]> = {};
    for (const row of tables.rows) {
      if (!/^[a-z_][a-z0-9_]*$/.test(row.table_name)) continue;
      const result = await q(`SELECT * FROM "${row.table_name}"`);
      backup[row.table_name] = result.rows;
    }
    const json = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="db-backup-${date}.json"`);
    res.send(json);
  } catch (err: any) {
    res.status(500).json({ error: "Backup failed. Use your PostgreSQL provider's backup tools for full database backups." });
  }
});

app.put("/api/products/:id", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  const existing = await getProduct(String(req.params.id));
  if (!existing) { res.status(404).json({ error: "Product not found." }); return; }

  const body = req.body || {};
  if (body.category !== undefined && body.category && !(await getCategory(body.category))) {
    res.status(400).json({ error: "Choose a valid category." });
    return;
  }
  if (body.name !== undefined && !String(body.name).trim()) {
    res.status(400).json({ error: "Product name cannot be empty." });
    return;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ error: "Price must be a positive number." });
      return;
    }
  }

  const updates: any = {};
  if (body.category !== undefined) updates.category = body.category;
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.price !== undefined) updates.price = Number(body.price);
  if (body.salePrice !== undefined) updates.salePrice = body.salePrice === null || body.salePrice === "" ? null : Number(body.salePrice);
  if (body.specs !== undefined) updates.specs = normalizeSpecs(body.specs);
  if (body.inStock !== undefined) updates.inStock = Boolean(body.inStock);
  if (body.isNonStock !== undefined) updates.isNonStock = Boolean(body.isNonStock);
  if (body.subcategory !== undefined) updates.subcategory = String(body.subcategory).trim();
  if (body.hasWarranty !== undefined) updates.hasWarranty = Boolean(body.hasWarranty);
  if (body.warrantyDuration !== undefined) updates.warrantyDuration = Number(body.warrantyDuration);
  if (body.taxable !== undefined) updates.taxable = Boolean(body.taxable);
  if (body.imageAlt !== undefined) updates.imageAlt = String(body.imageAlt).trim();

  const product = await updateProduct(String(req.params.id), updates);
  res.json(product);
});

app.post("/api/products/:id/image", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  const product = await getProduct(String(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }

  uploadProductImage(req, res, async (err: any) => {
    if (err) { console.error("[Upload primary]", err.message || err); res.status(400).json({ error: "Upload failed: " + (err.message || "Unknown error") }); return; }
    if (!req.file) { res.status(400).json({ error: "No image file provided." }); return; }

    try {
      const imageUrl = getUploadedUrl(req) || imageUrlForProduct(String(req.params.id));
      console.log("[Upload primary] imageUrl:", imageUrl, "cloudinary:", isCloudinaryConfigured());
      if (!imageUrl) { res.status(500).json({ error: "Image upload failed. Please try again." }); return; }
      await setProductImageUrl(String(req.params.id), imageUrl);
      backupImageToDb(`product:${req.params.id}`, imageUrl);
      // Also save to product_images gallery
      const existing = await getProductImages(String(req.params.id));
      if (!existing.find(i => i.imageUrl === imageUrl)) {
        await addProductImage(String(req.params.id), imageUrl, -1);
      }
      const updated = await getProduct(String(req.params.id));
      res.json(updated);
    } catch (e: any) {
      console.error("[Upload primary] save error:", e.message || e);
      res.status(500).json({ error: "Image uploaded but failed to save. Please try again." });
    }
  });
});

app.delete("/api/products/:id/image", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  const product = await getProduct(String(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  const imageUrl = product.imageUrl;
  await setProductImageUrl(String(req.params.id), "");
  if (imageUrl) deleteCloudinaryImage(imageUrl);
  res.json({ ok: true });
});

// Gallery images
app.get("/api/products/:id/images", async (req: Request, res: Response) => {
  try {
    const product = await getProduct(String(req.params.id));
    if (!product) { res.status(404).json({ error: "Product not found." }); return; }
    const images = await getProductImages(String(req.params.id));
    const normalizeUrl = (u: string) => u.split("?")[0].replace(/\/+$/, "");
    const primaryNorm = product.imageUrl ? normalizeUrl(product.imageUrl) : "";
    const combined: any[] = [];
    if (primaryNorm) {
      const primaryExists = images.some((img: any) => normalizeUrl(img.imageUrl) === primaryNorm);
      if (!primaryExists) {
        combined.push({ id: 0, productId: product.id, imageUrl: product.imageUrl, sortOrder: -1, isPrimary: 1 });
      }
    }
    for (const img of images) {
      const imgNorm = normalizeUrl(img.imageUrl);
      if (!combined.some((c: any) => normalizeUrl(c.imageUrl) === imgNorm)) {
        combined.push(img);
      }
    }
    if (combined.length === 0 && product.imageUrl) {
      combined.push({ id: 0, productId: product.id, imageUrl: product.imageUrl, sortOrder: -1, isPrimary: 1 });
    }
    res.json({ images: combined });
  } catch (err: any) {
    console.error("[product images]", err?.message || err);
    res.status(500).json({ error: "Failed to load images." });
  }
});

// ============ PRODUCT REVIEWS ============

app.get("/api/products/:id/reviews", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const perPage = 10;
    const offset = (page - 1) * perPage;
    const [reviews, total, rating, distribution] = await Promise.all([
      getProductReviews(String(req.params.id), perPage, offset),
      getProductReviewCount(String(req.params.id)),
      getProductRating(String(req.params.id)),
      getProductRatingDistribution(String(req.params.id)),
    ]);
    res.json({ reviews, rating, distribution, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (err: any) {
    console.error("[reviews]", err?.message || err);
    res.status(500).json({ error: "Failed to load reviews." });
  }
});

app.get("/api/products/:id/reviews/check", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const hasReviewed = await hasCustomerReviewed(String(req.params.id), (req as any).customer.sub);
    const review = hasReviewed ? await queryOne("SELECT * FROM product_reviews WHERE product_id = $1 AND customer_id = $2", [String(req.params.id), (req as any).customer.sub]) : null;
    res.json({ hasReviewed, review });
  } catch (err: any) {
    res.json({ hasReviewed: false, review: null });
  }
});

app.post("/api/products/:id/reviews", customerAuthMiddleware, async (req: Request, res: Response) => {
  const productId = String(req.params.id);
  const customerId = (req as any).customer.sub;
  try {
    if (await hasCustomerReviewed(productId, customerId)) { res.status(400).json({ error: "You have already reviewed this product." }); return; }
    const { rating, title, comment } = req.body || {};
    if (!rating || Number(rating) < 1 || Number(rating) > 5) { res.status(400).json({ error: "Rating must be between 1 and 5." }); return; }
    const review = await createReview(productId, customerId, Number(rating), String(title || "").trim().slice(0, 200), String(comment || "").trim().slice(0, 2000));
    res.status(201).json(review);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(400).json({ error: "You have already reviewed this product." }); return; }
    console.error("[review create]", err?.message || err);
    res.status(500).json({ error: "Failed to submit review." });
  }
});

app.put("/api/products/:id/reviews/:reviewId", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const customerId = (req as any).customer.sub;
    const existing = await getReviewById(reviewId);
    if (!existing) { res.status(404).json({ error: "Review not found." }); return; }
    if (existing.customer_id !== customerId) { res.status(403).json({ error: "You can only edit your own reviews." }); return; }
    const { rating, title, comment } = req.body || {};
    if (!rating || Number(rating) < 1 || Number(rating) > 5) { res.status(400).json({ error: "Rating must be between 1 and 5." }); return; }
    const updated = await updateReview(reviewId, customerId, Number(rating), String(title || "").trim().slice(0, 200), String(comment || "").trim().slice(0, 2000));
    if (!updated) { res.status(404).json({ error: "Review not found." }); return; }
    res.json({ ...updated, customer_name: existing.customer_name });
  } catch (err: any) {
    console.error("[review update]", err?.message || err);
    res.status(500).json({ error: "Failed to update review." });
  }
});

app.delete("/api/products/:id/reviews/:reviewId", customerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const customerId = (req as any).customer.sub;
    const existing = await getReviewById(reviewId);
    if (!existing) { res.status(404).json({ error: "Review not found." }); return; }
    if (existing.customer_id !== customerId) { res.status(403).json({ error: "You can only delete your own reviews." }); return; }
    await deleteReview(reviewId);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[review delete]", err?.message || err);
    res.status(500).json({ error: "Failed to delete review." });
  }
});

app.delete("/api/admin/products/:id/reviews/:reviewId", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  try {
    const ok = await deleteReview(Number(req.params.reviewId));
    if (!ok) { res.status(404).json({ error: "Review not found." }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[admin review delete]", err?.message || err);
    res.status(500).json({ error: "Failed to delete review." });
  }
});

app.get("/api/admin/reviews", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;
    const [reviews, total] = await Promise.all([getAllReviews(perPage, offset), getAllReviewCount()]);
    res.json({ reviews, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (err: any) {
    console.error("[admin reviews]", err?.message || err);
    res.status(500).json({ error: "Failed to load reviews." });
  }
});

app.post("/api/products/:id/images", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  const product = await getProduct(String(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  uploadGalleryImage(req, res, async (err: any) => {
    if (err) { console.error("[Upload gallery]", err.message || err); res.status(400).json({ error: "Upload failed: " + (err.message || "Unknown error") }); return; }
    if (!req.file) { res.status(400).json({ error: "No image file provided." }); return; }
    try {
      const imageUrl = getUploadedUrl(req);
      console.log("[Upload gallery] imageUrl:", imageUrl, "cloudinary:", isCloudinaryConfigured());
      if (!imageUrl) { res.status(500).json({ error: "Image upload failed. Please try again." }); return; }
      const img = await addProductImage(String(req.params.id), imageUrl);
      backupImageToDb(`product:${req.params.id}:gallery:${img.id}`, imageUrl);
      res.json(img);
    } catch (e: any) {
      console.error("[Upload gallery] save error:", e.message || e);
      res.status(500).json({ error: "Image uploaded but failed to save. Please try again." });
    }
  });
});

app.delete("/api/products/:id/images/:imageId", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  const images = await getProductImages(String(req.params.id));
  const img = images.find(i => i.id === Number(req.params.imageId));
  const ok = await deleteProductImage(Number(req.params.imageId));
  if (!ok) { res.status(404).json({ error: "Image not found." }); return; }
  if (img?.imageUrl) deleteCloudinaryImage(img.imageUrl);
  res.json({ ok: true });
});

app.put("/api/products/:id/images/reorder", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds)) { res.status(400).json({ error: "orderedIds array required." }); return; }
  await setProductImageOrder(String(req.params.id), orderedIds);
  res.json({ ok: true });
});

app.put("/api/products/:id/images/:imageId/primary", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  await setPrimaryImage(String(req.params.id), Number(req.params.imageId));
  const images = await getProductImages(String(req.params.id));
  const img = images.find(i => i.id === Number(req.params.imageId));
  if (img) await setProductImageUrl(String(req.params.id), img.imageUrl);
  res.json({ ok: true });
});

app.patch("/api/products/:id/price", adminAuthMiddleware, async (req: Request, res: Response) => {
  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "Price must be a positive number." });
    return;
  }
  const product = await updateProduct(String(req.params.id), { price });
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  res.json(product);
});

app.put("/api/admin/products/reorder", ownerAuthMiddleware, requirePermission("product:update"), async (req: Request, res: Response) => {
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) { res.status(400).json({ error: "orderedIds array required." }); return; }
  await updateProductSortOrder(orderedIds);
  res.json({ ok: true });
});

app.patch("/api/products/:id/subcategory", adminAuthMiddleware, async (req: Request, res: Response) => {
  const subcategory = String(req.body?.subcategory || "").trim();
  const product = await updateProduct(String(req.params.id), { subcategory });
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  res.json(product);
});

app.delete("/api/products/:id", ownerAuthMiddleware, requirePermission("product:delete"), async (req: Request, res: Response) => {
  const productId = String(req.params.id);
  const product = await getProduct(productId);
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  const allImages = await getProductImages(productId);
  const urls = [product.imageUrl, ...allImages.map(i => i.imageUrl)].filter(Boolean);
  const removed = await deleteProduct(productId);
  if (!removed) { res.status(404).json({ error: "Product not found." }); return; }
  for (const url of urls) deleteCloudinaryImage(url);
  res.status(204).end();
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const login = String(req.body?.username || req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  if (!login || !password) { res.status(400).json({ error: "Email/username and password are required." }); return; }
  let result = await loginStaff(login, password);
  if (!result.ok) {
    const provResult = await loginProvider(login, password);
    if (provResult.ok) {
      res.json({ token: provResult.token, username: provResult.name, email: provResult.email, role: "provider" });
      return;
    }
    res.status(401).json({ error: result.error });
    return;
  }
  res.json({ token: result.token, username: result.username, email: result.email, role: result.role });
});

app.post("/api/customer/register", async (req: Request, res: Response) => {
  const body = req.body || {};
  const result = await registerCustomer({ name: body.name, email: body.email, password: body.password });
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.json({ token: result.token, name: result.name, email: result.email });
});

app.post("/api/customer/login", async (req: Request, res: Response) => {
  const body = req.body || {};
  const result = await loginCustomer(body.email, body.password);
  if (!result.ok) { res.status(401).json({ error: result.error }); return; }
  res.json({ token: result.token, name: result.name, email: result.email });
});

app.post("/api/customer/google-login", async (req: Request, res: Response) => {
  const googleToken = req.body?.credential;
  if (!googleToken) { res.status(400).json({ error: "Google credential is required." }); return; }
  const result = await googleLogin(googleToken);
  if (!result.ok) { res.status(401).json({ error: result.error }); return; }
  res.json({ token: result.token, name: result.name, email: result.email });
});

app.get("/api/customer/me", customerAuthMiddleware, async (req: Request, res: Response) => {
  const customer = await findCustomerById((req as any).customer.sub);
  if (!customer) { res.status(404).json({ error: "Customer not found." }); return; }
  res.json(customer);
});

app.put("/api/customer/me", customerAuthMiddleware, async (req: Request, res: Response) => {
  const customerId = (req as any).customer.sub;
  const { name, phone } = req.body || {};
  await queryOne("UPDATE customers SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3 RETURNING *", [name || null, phone || null, customerId]);
  res.json({ ok: true, customer: await findCustomerById(customerId) });
});

app.post("/api/customer/change-password", customerAuthMiddleware, async (req: Request, res: Response) => {
  const customerId = (req as any).customer.sub;
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "Current and new passwords are required." }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  const row = await queryOne("SELECT password_hash FROM customers WHERE id = $1", [customerId]) as any;
  if (!row) { res.status(404).json({ error: "Customer not found." }); return; }
  const match = await bcrypt.compare(currentPassword, row.password_hash);
  if (!match) { res.status(403).json({ error: "Current password is incorrect." }); return; }
  const success = changeCustomerPassword(customerId, newPassword);
  if (!success) { res.status(500).json({ error: "Failed to change password." }); return; }
  res.json({ ok: true });
});

// ============ LOYALTY POINTS ============

app.get("/api/loyalty/points", customerAuthMiddleware, async (req: Request, res: Response) => {
  res.json(await getLoyaltyPoints((req as any).customer.sub));
});

app.get("/api/loyalty/transactions", customerAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ transactions: await getLoyaltyTransactions((req as any).customer.sub) });
});

app.post("/api/loyalty/redeem", customerAuthMiddleware, async (req: Request, res: Response) => {
  const { points } = req.body || {};
  if (!points || points < 1) { res.status(400).json({ error: "Points must be at least 1." }); return; }
  const discount = await redeemLoyaltyPoints((req as any).customer.sub, points, 0);
  if (!discount) { res.status(400).json({ error: "Not enough points or invalid request." }); return; }
  res.json({ discount, pointsRedeemed: points });
});

app.get("/api/admin/loyalty/customers", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ customers: await listAllLoyaltyCustomers() });
});

app.post("/api/auth/magic-request", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) { res.status(400).json({ error: "Email is required." }); return; }
  const customer = await findCustomerByEmail(email);
  if (!customer) { res.json({ ok: true }); return; }
  const token = signToken({ sub: customer.id, email: customer.email, name: customer.name, role: "customer", purpose: "magic" }, "1h");
  const link = `${process.env.BASE_URL || ""}/account.html?magic=${token}`;
  try {
    await notifier.sendMagicLinkEmail(customer, link);
  } catch (_e) { /* ignore */ }
  res.json({ ok: true });
});

app.post("/api/auth/magic-login", async (req: Request, res: Response) => {
  const token = String(req.body?.token || "");
  if (!token) { res.status(400).json({ error: "Token is required." }); return; }
  try {
    const payload = verifyToken(token);
    if (payload.purpose !== "magic" || payload.role !== "customer") { res.status(400).json({ error: "Invalid token." }); return; }
    const sessionToken = signToken({ sub: payload.sub, email: payload.email, name: payload.name, role: "customer" });
    res.json({ token: sessionToken, name: payload.name });
  } catch (_err) {
    res.status(400).json({ error: "Invalid or expired token." });
  }
});

app.post("/api/auth/request-admin-password-reset", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) { res.status(400).json({ error: "Email is required." }); return; }
  const staff = await findStaffByEmail(email);
  if (staff) {
    const token = signToken({ sub: staff.id, email: staff.email, name: staff.username, role: "admin", purpose: "reset" }, "2h");
    const link = `${process.env.BASE_URL || ""}/admin-password-reset?token=${token}`;
    try {
      await notifier.sendPasswordResetEmail({ email: staff.email, name: staff.username }, link);
    } catch (_e) { /* ignore */ }
  }
  res.json({ ok: true });
});

app.post("/api/auth/admin-password-reset", async (req: Request, res: Response) => {
  const token = String(req.body?.token || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!token || !newPassword) { res.status(400).json({ error: "Token and newPassword are required." }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  try {
    const payload = verifyToken(token);
    if (payload.purpose !== "reset" || !["admin", "owner"].includes(payload.role)) {
      res.status(400).json({ error: "Invalid token." }); return;
    }
    const staff = await findStaffById(payload.sub);
    if (!staff) { res.status(404).json({ error: "User not found." }); return; }
    await changeStaffPassword(payload.sub, newPassword);
    res.json({ ok: true });
  } catch (_err) {
    res.status(400).json({ error: "Invalid or expired token." });
  }
});

app.post("/api/auth/google-admin-login", async (req: Request, res: Response) => {
  const googleToken = String(req.body?.credential || "");
  if (!googleToken) { res.status(400).json({ error: "Google credential is required." }); return; }
  try {
    const clientId = await getStoreSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "";
    if (!clientId) { res.status(400).json({ error: "Google login is not configured." }); return; }
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: googleToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) { res.status(400).json({ error: "Google login failed." }); return; }
    const email = payload.email.toLowerCase();
    const staff = await findStaffByEmail(email);
    if (!staff) { res.status(403).json({ error: "Login failed." }); return; }
    const token = signToken({ sub: staff.id, email: staff.email, name: staff.username, role: staff.role });
    res.json({ token, username: staff.username, email: staff.email, role: staff.role });
  } catch (_err) {
    res.status(400).json({ error: "Google login failed." });
  }
});

app.post("/api/auth/request-password-reset", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) { res.status(400).json({ error: "Email is required." }); return; }
  const customer = await findCustomerByEmail(email);
  if (!customer) { res.json({ ok: true }); return; }
  const token = signToken({ sub: customer.id, email: customer.email, name: customer.name, role: "customer", purpose: "reset" }, "2h");
  const link = `${process.env.BASE_URL || ""}/account.html?reset=${token}`;
  try {
    await notifier.sendPasswordResetEmail(customer, link);
  } catch (_e) { /* ignore */ }
  res.json({ ok: true });
});

app.post("/api/auth/password-reset", async (req: Request, res: Response) => {
  const token = String(req.body?.token || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!token || !newPassword) { res.status(400).json({ error: "Token and newPassword are required." }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  try {
    const payload = verifyToken(token);
    if (payload.purpose !== "reset" || payload.role !== "customer") { res.status(400).json({ error: "Invalid token." }); return; }
    const success = changeCustomerPassword(payload.sub, newPassword);
    if (!success) { res.status(404).json({ error: "User not found." }); return; }
    res.json({ ok: true });
  } catch (_err) {
    res.status(400).json({ error: "Invalid or expired token." });
  }
});

app.get("/api/auth/me", staffAuthMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ username: user.username, role: user.role });
});

app.post("/api/auth/change-password", staffAuthMiddleware, async (req: Request, res: Response) => {
  const currentPassword = req.body?.currentPassword || "";
  const newPassword = req.body?.newPassword || "";
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "Current and new passwords are required." }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }

  const user = findStaffById((req as any).user.sub);
  if (!user) { res.status(404).json({ error: "User not found." }); return; }

  const userWithHash = await queryOne("SELECT password_hash FROM users WHERE id = $1", [(req as any).user.sub]) as any;
  const match = await bcrypt.compare(currentPassword, userWithHash.password_hash);
  if (!match) { res.status(401).json({ error: "Current password is incorrect." }); return; }

  changeStaffPassword((req as any).user.sub, newPassword);
  res.json({ ok: true, message: "Password changed successfully." });
});

app.get("/api/staff", adminAuthMiddleware, requirePermission("staff:list"), async (_req: Request, res: Response) => {
  res.json({ staff: await listStaff() });
});

app.post("/api/staff", adminAuthMiddleware, requirePermission("staff:create"), async (req: Request, res: Response) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    const role = req.body?.role || "technician";

    if (!username) { res.status(400).json({ error: "Username is required." }); return; }
    if (!password || password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
    if (!["admin", "owner", "technician", "manager", "staff", "provider", "customer"].includes(role)) { res.status(400).json({ error: "Invalid role." }); return; }

    if (role === "technician") {
      try {
        const plan = await getShopPlan();
        const features: string[] = plan?.features || [];
        if (features.length > 0 && !features.some((f) => f.toLowerCase().includes("technician"))) {
          res.status(403).json({ error: "Technician accounts require a plan that includes the 'Technician accounts' feature. Please upgrade your subscription." }); return;
        }
      } catch { /* plan check failed — allow creation */ }
    }

    const staff = await createStaff({ username, email: email || undefined, password, role });
    const user = (req as any).user;
    try { await recordAuditLog(user.sub, user.username || "", "staff_created", "staff", String(staff.id), JSON.stringify({ username, role }), user.role); } catch {}
    res.status(201).json(staff);
  } catch (err: any) {
    console.error("[staff create]", err?.message || err);
    res.status(500).json({ error: "Failed to create staff account." });
  }
});

app.patch("/api/staff/:id", adminAuthMiddleware, requirePermission("staff:update"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { username, email } = req.body || {};
  if (username !== undefined && (!username || !String(username).trim())) {
    res.status(400).json({ error: "Username cannot be empty." }); return;
  }
  const staff = await updateStaffDetails(id, { username: username?.trim(), email });
  if (!staff) { res.status(404).json({ error: "Staff member not found." }); return; }
  res.json(staff);
});

app.patch("/api/staff/:id/role", adminAuthMiddleware, requirePermission("staff:update"), async (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  const newRole = req.body?.role;
  if (!["admin", "owner", "technician"].includes(newRole)) { res.status(400).json({ error: "Invalid role." }); return; }
  if (targetId === (req as any).user.sub && newRole !== "admin") {
    res.status(400).json({ error: "Cannot downgrade your own admin role." });
    return;
  }
  await updateStaffRole(targetId, newRole);
  res.json({ ok: true });
});

app.post("/api/staff/:id/reset-password", adminAuthMiddleware, async (req: Request, res: Response) => {
  const newPassword = String(req.body?.password || "");
  if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  await changeStaffPassword(Number(req.params.id), newPassword);
  res.json({ ok: true, message: "Password reset successfully." });
});

app.delete("/api/staff/:id", adminAuthMiddleware, requirePermission("staff:delete"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (id === (req as any).user.sub) { res.status(400).json({ error: "Cannot delete your own account." }); return; }
  const success = await deleteStaff(id);
  if (!success) { res.status(404).json({ error: "Staff member not found." }); return; }
  res.status(204).end();
});

// ============ PERMISSIONS & ROLES ============

app.get("/api/permissions", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ permissions: getAllPermissions() });
});

app.get("/api/roles", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ roles: await listRoles() });
});

app.get("/api/roles/:roleId", adminAuthMiddleware, async (req: Request, res: Response) => {
  const role = await getRole(String(req.params.roleId));
  if (!role) { res.status(404).json({ error: "Role not found." }); return; }
  res.json({ role });
});

app.post("/api/roles", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { roleId, name, description, permissions } = req.body || {};
  if (!roleId || !name) {
    res.status(400).json({ error: "Role ID and name are required." });
    return;
  }
  const role = await createRole(roleId, name, description, permissions);
  res.status(201).json({ role });
});

app.put("/api/roles/:roleId", adminAuthMiddleware, async (req: Request, res: Response) => {
  const roleId = String(req.params.roleId);
  if (roleId === "admin" && req.body?.permissions && !req.body.permissions.includes("admin:access")) {
    res.status(400).json({ error: "Cannot remove admin:access from the admin role." });
    return;
  }
  const role = await updateRole(roleId, req.body || {});
  if (!role) { res.status(404).json({ error: "Role not found or cannot be modified." }); return; }
  res.json({ role });
});

app.delete("/api/roles/:roleId", adminAuthMiddleware, async (req: Request, res: Response) => {
  if (["admin", "technician", "manager"].includes(String(req.params.roleId))) {
    res.status(400).json({ error: "Cannot delete default roles." });
    return;
  }
  const success = await deleteRole(String(req.params.roleId));
  if (!success) { res.status(404).json({ error: "Role not found." }); return; }
  res.status(204).end();
});

app.get("/api/staff/:id/roles", adminAuthMiddleware, async (req: Request, res: Response) => {
  const roles = await getUserRoles(Number(req.params.id));
  res.json({ roles });
});

app.post("/api/staff/:id/roles/:roleId", adminAuthMiddleware, async (req: Request, res: Response) => {
  const success = await assignRoleToUser(Number(req.params.id), String(req.params.roleId));
  if (!success) { res.status(400).json({ error: "Failed to assign role." }); return; }
  res.json({ ok: true });
});

app.delete("/api/staff/:id/roles/:roleId", adminAuthMiddleware, async (req: Request, res: Response) => {
  const success = await removeRoleFromUser(Number(req.params.id), String(req.params.roleId));
  if (!success) { res.status(404).json({ error: "Role not assigned to user." }); return; }
  res.status(204).end();
});

app.get("/api/staff/:id/permissions", adminAuthMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const effective = await getUserPermissions(id);
  const direct = await getUserDirectPermissions(id);
  res.json({ effective, direct });
});

app.put("/api/staff/:id/permissions", adminAuthMiddleware, async (req: Request, res: Response) => {
  const perms: string[] = req.body?.permissions || [];
  await setUserDirectPermissions(Number(req.params.id), perms);
  const effective = await getUserPermissions(Number(req.params.id));
  res.json({ ok: true, effective, direct: perms });
});

// ============ STOCK ============

app.get("/api/stock/low-items", ownerAuthMiddleware, requirePermission("stock:view_low"), async (req: Request, res: Response) => {
  const items = await getLowStockItems();
  res.json({ items });
});

app.get("/api/stock", ownerAuthMiddleware, requirePermission("stock:list"), async (_req: Request, res: Response) => {
  const products = await listProducts();
  const stock = await Promise.all(products.map((p) => getStockLevel(p.id)));
  res.json({ stock });
});

app.get("/api/stock/:productId", ownerAuthMiddleware, requirePermission("stock:list"), async (req: Request, res: Response) => {
  const stock = await getStockLevel(String(req.params.productId));
  res.json(stock);
});

app.put("/api/stock/:productId", ownerAuthMiddleware, requirePermission("stock:update"), async (req: Request, res: Response) => {
  const updates: any = {};
  if (req.body.quantityInStock !== undefined) updates.quantityInStock = Number(req.body.quantityInStock);
  if (req.body.lowStockThreshold !== undefined) updates.lowStockThreshold = Number(req.body.lowStockThreshold);
  await updateStockLevel(String(req.params.productId), updates.quantityInStock ?? 0);
  const stock = await getStockLevel(String(req.params.productId));
  res.json(stock);
});

app.get("/api/stock/:productId/movements", adminAuthMiddleware, async (req: Request, res: Response) => {
  const movements = await getStockMovements(String(req.params.productId));
  res.json({ movements });
});

// ============ STOCK TRANSFERS ============

app.get("/api/stock-transfers", adminAuthMiddleware, requirePermission("stock:transfer"), async (_req: Request, res: Response) => {
  res.json({ transfers: await listStockTransfers() });
});

app.post("/api/stock-transfers", adminAuthMiddleware, requirePermission("stock:transfer"), async (req: Request, res: Response) => {
  const { fromBranchId, toBranchId, productId, quantity, notes } = req.body || {};
  if (!fromBranchId || !toBranchId || !productId || !quantity) {
    res.status(400).json({ error: "From branch, to branch, product ID, and quantity are required." }); return;
  }
  if (fromBranchId === toBranchId) {
    res.status(400).json({ error: "Source and destination branches must be different." }); return;
  }
  const transfer = await createStockTransfer({ fromBranchId, toBranchId, productId, quantity, notes, createdBy: (req as any).user?.sub });
  res.status(201).json({ transfer });
});

app.post("/api/stock-transfers/:id/complete", adminAuthMiddleware, requirePermission("stock:transfer"), async (req: Request, res: Response) => {
  const ok = await completeStockTransfer(Number(req.params.id));
  if (!ok) { res.status(400).json({ error: "Transfer not found or already completed." }); return; }
  res.json({ ok: true });
});

app.post("/api/stock-transfers/:id/reject", adminAuthMiddleware, requirePermission("stock:transfer"), async (req: Request, res: Response) => {
  const ok = await rejectStockTransfer(Number(req.params.id));
  if (!ok) { res.status(400).json({ error: "Transfer not found or already completed." }); return; }
  res.json({ ok: true });
});

// ============ CART ============

app.get("/api/cart", customerAuthMiddleware, async (req: Request, res: Response) => {
  const items = await getCartItems((req as any).customer.sub);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const currency = (await getSettings()).currency;
  res.json({ items, subtotal, currency });
});

app.post("/api/cart", customerAuthMiddleware, async (req: Request, res: Response) => {
  const { productId, quantity } = req.body || {};
  if (!productId) { res.status(400).json({ error: "Product ID is required." }); return; }
  try {
    await addToCart((req as any).customer.sub, productId, Number(quantity) || 1);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to add to cart." });
  }
});

app.get("/api/cart/count", customerAuthMiddleware, async (req: Request, res: Response) => {
  const count = await getCartCount((req as any).customer.sub);
  res.json({ count });
});

app.patch("/api/cart/:productId", customerAuthMiddleware, async (req: Request, res: Response) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: "Quantity must be a positive integer." });
    return;
  }
  await setCartQuantity((req as any).customer.sub, String(req.params.productId), quantity);
  res.json({ ok: true });
});

app.delete("/api/cart/:productId", customerAuthMiddleware, async (req: Request, res: Response) => {
  await removeFromCart((req as any).customer.sub, String(req.params.productId));
  res.json({ ok: true });
});

app.delete("/api/cart", customerAuthMiddleware, async (req: Request, res: Response) => {
  await clearCart((req as any).customer.sub);
  res.json({ ok: true });
});

// ============ REPAIRS ============

app.get("/api/staff/technicians", staffAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ staff: await listStaff() });
});

app.get("/api/backoffice/stats", staffAuthMiddleware, async (_req: Request, res: Response) => {
  res.json(await getDashboardStats());
});

app.get("/api/repairs/types", async (_req: Request, res: Response) => {
  res.json({ types: await listRepairTypes() });
});

app.get("/api/repairs/statuses", (_req: Request, res: Response) => {
  res.json({ statuses: STATUS_LABELS });
});

app.post("/api/repairs", customerAuthMiddleware, async (req: Request, res: Response) => {
  const result = await createRepairTicket((req as any).customer.sub, req.body || {});
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  try { notifier.sendNewRepairEmail(result.ticket!).catch(() => {}); } catch (_e) { /* ignore */ }
  res.status(201).json(result.ticket);
});

app.get("/api/repairs/mine", customerAuthMiddleware, async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
  const status = req.query.status as string | undefined;

  if (page || pageSize || status) {
    const p = await listRepairsForCustomerPaged((req as any).customer.sub, { status, page: page || 1, pageSize: pageSize || 10 });
    res.json(p);
    return;
  }

  res.json({ tickets: await listRepairsForCustomer((req as any).customer.sub) });
});

app.get("/api/repairs/mine/:id", customerAuthMiddleware, async (req: Request, res: Response) => {
  const ticket = await loadTicketDetails(String(req.params.id));
  if (!ticket || ticket.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Ticket not found." }); return; }
  const visibleUpdates = ticket.updates.filter((u) => u.customerVisible);
  res.json({ ...ticket, updates: visibleUpdates, workNotes: undefined });
});

app.post("/api/repairs/mine/:id/message", customerAuthMiddleware, async (req: Request, res: Response) => {
  const ticket = await loadTicketDetails(String(req.params.id));
  if (!ticket || ticket.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Ticket not found." }); return; }
  const { message } = req.body || {};
  if (!message || !String(message).trim()) { res.status(400).json({ error: "Message is required." }); return; }
  await addRepairUpdate(String(req.params.id), null, "customer_note", String(message).trim(), true);
  res.status(201).json({ ok: true });
});

app.get("/api/repairs", staffAuthMiddleware, async (req: Request, res: Response) => {
  const tickets = await listRepairsForStaff({
    status: req.query.status as string || undefined,
    assignedTo: req.query.assignedTo ? Number(req.query.assignedTo) : undefined,
  });
  res.json({ tickets });
});

app.get("/api/repairs/calendar", staffAuthMiddleware, async (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = req.query.to as string;
  if (!to) { res.status(400).json({ error: "Query param 'to' is required (ISO date)." }); return; }
  const cal = await listCalendarRepairs(from, to);
  res.json({ tickets: cal });
});

app.get("/api/repairs/:id", staffAuthMiddleware, async (req: Request, res: Response) => {
  const ticket = await loadTicketDetails(String(req.params.id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found." }); return; }
  res.json(ticket);
});

app.patch("/api/repairs/:id", staffAuthMiddleware, async (req: Request, res: Response) => {
  const result = await updateRepairTicket(String(req.params.id), req.body || {}, (req as any).user.sub);
  if (!result) { res.status(404).json({ error: "Ticket not found." }); return; }
  if ((result as any).error) { res.status(400).json({ error: (result as any).error }); return; }
  res.json(result);
});

app.post("/api/repairs/:id/parts", staffAuthMiddleware, async (req: Request, res: Response) => {
  const result = await addRepairPart(String(req.params.id), req.body || {});
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.status(201).json(result.part);
});

app.delete("/api/repairs/:id/parts/:partId", staffAuthMiddleware, async (req: Request, res: Response) => {
  const removed = await removeRepairPart(String(req.params.id), Number(req.params.partId));
  if (!removed) { res.status(404).json({ error: "Part not found." }); return; }
  res.status(204).end();
});

app.post("/api/repairs/:id/updates", staffAuthMiddleware, async (req: Request, res: Response) => {
  const { message, customerVisible } = req.body || {};
  if (!message || !String(message).trim()) {
    res.status(400).json({ error: "Message is required." });
    return;
  }
  await addRepairUpdate(String(req.params.id), (req as any).user.sub, "note", String(message).trim(), Boolean(customerVisible));
  res.status(201).json({ ok: true });
});

// ============ REPAIR IMAGES ============
app.get("/api/repairs/:id/images", staffAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ images: await getRepairImages(String(req.params.id)) });
});

app.post("/api/repairs/:id/images", staffAuthMiddleware, (req: Request, res: Response) => {
  uploadRepairImage(req, res, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    if (!req.file) { res.status(400).json({ error: "No image uploaded." }); return; }
    const imageType = String(req.body.imageType || "before").toLowerCase();
    if (!["before", "after"].includes(imageType)) { res.status(400).json({ error: "imageType must be 'before' or 'after'." }); return; }
    const imageUrl = getUploadedUrl(req);
    const image = await addRepairImage(String(req.params.id), imageUrl, imageType as "before" | "after", (req as any).user.sub);
    backupImageToDb(`repair:${req.params.id}:${imageType}:${image.id}`, imageUrl);
    res.status(201).json(image);
  });
});

app.delete("/api/repairs/:id/images/:imageId", staffAuthMiddleware, async (req: Request, res: Response) => {
  const removed = await deleteRepairImage(Number(req.params.imageId));
  if (!removed) { res.status(404).json({ error: "Image not found." }); return; }
  res.status(204).end();
});

app.post("/api/repairs/:id/send-quote", staffAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await sendRepairQuote(String(req.params.id));
  if (!ok) { res.status(404).json({ error: "Ticket not found." }); return; }
  res.json({ ok: true });
});

app.post("/api/repairs/:id/quote-response", customerAuthMiddleware, async (req: Request, res: Response) => {
  const { response } = req.body || {};
  if (response !== "accepted" && response !== "declined") {
    res.status(400).json({ error: "Response must be 'accepted' or 'declined'." }); return;
  }
  const ticket = await loadTicketDetails(String(req.params.id));
  if (!ticket || ticket.customerId !== (req as any).customer.sub) {
    res.status(404).json({ error: "Ticket not found." }); return;
  }
  const ok = await respondToRepairQuote(String(req.params.id), response);
  if (!ok) { res.status(400).json({ error: "No quote to respond to." }); return; }
  res.json({ ok: true });
});

// ============ PURCHASE ORDERS ============
app.get("/api/purchases", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ orders: await listPurchaseOrders() });
});

app.post("/api/purchases", adminAuthMiddleware, async (req: Request, res: Response) => {
  const po = await createPurchaseOrder({ ...req.body, createdBy: (req as any).user.sub });
  res.status(201).json(po);
});

app.get("/api/purchases/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const po = await getPurchaseOrder(Number(req.params.id));
  if (!po) { res.status(404).json({ error: "Purchase order not found." }); return; }
  res.json(po);
});

app.patch("/api/purchases/:id/status", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["pending", "ordered", "received", "cancelled"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }
  await updatePurchaseOrderStatus(Number(req.params.id), status);
  res.json({ ok: true });
});

app.post("/api/purchases/:id/items", adminAuthMiddleware, async (req: Request, res: Response) => {
  const item = await addPurchaseOrderItem(Number(req.params.id), req.body);
  res.status(201).json(item);
});

app.post("/api/admin/auto-reorder", adminAuthMiddleware, async (_req: Request, res: Response) => {
  const result = await autoReorderLowStock();
  res.json(result);
});

app.post("/api/purchases/items/:itemId/receive", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { quantityReceived } = req.body || {};
  if (!quantityReceived || quantityReceived < 1) { res.status(400).json({ error: "quantityReceived is required." }); return; }
  await receivePurchaseOrderItem(Number(req.params.itemId), Number(quantityReceived));
  res.json({ ok: true });
});

// ============ REPORTS ============
app.get("/api/reports/tech-performance", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ technicians: await getTechPerformanceReport() });
});

app.get("/api/reports/purchases", adminAuthMiddleware, async (_req: Request, res: Response) => {
  res.json(await getPurchaseReport());
});

// ============ ADMIN CREATE PROVIDER ============
app.post("/api/admin/providers", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { companyName, contactName, email, password, phone, pin } = req.body || {};
  if (!companyName || !contactName || !email || !password) { res.status(400).json({ error: "companyName, contactName, email, password are required." }); return; }
  if (pin && (pin.length < 6 || !/^\d+$/.test(pin))) { res.status(400).json({ error: "PIN must be at least 6 digits." }); return; }
  const existing = await findProviderByEmail(email);
  if (existing) { res.status(400).json({ error: "Provider with this email already exists." }); return; }
  const provider = await createProvider({ companyName, contactName, email, password, phone: phone || "" });
  if (!provider) { res.status(400).json({ error: "Could not create provider." }); return; }
  const starter = await getSubscriptionPlan("starter");
  if (starter) await assignPlanToProvider(provider.id, starter.id);
  res.status(201).json(provider);
});

app.put("/api/admin/providers/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = await findProviderById(id);
  if (!existing) { res.status(404).json({ error: "Provider not found." }); return; }
  const { companyName, contactName, email, phone, pin, password } = req.body || {};
  if (email && email !== existing.email) {
    const dup = await findProviderByEmail(email);
    if (dup) { res.status(400).json({ error: "Email already in use." }); return; }
  }
  if (pin !== undefined && pin !== "" && (pin.length < 6 || !/^\d+$/.test(pin))) { res.status(400).json({ error: "PIN must be at least 6 digits." }); return; }
  await updateProvider(id, {
    companyName,
    contactName,
    email,
    phone,
    pin: pin === "" ? "" : pin,
    password,
  });
  res.json(await findProviderById(id));
});

app.post("/api/provider/verify-pin", providerAuthMiddleware, async (req: Request, res: Response) => {
  const { pin } = req.body || {};
  if (!pin) { res.status(400).json({ error: "PIN is required." }); return; }
  const providerId = (req as any).provider.sub;
  if (await verifyProviderPin(providerId, pin)) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Wrong PIN." });
  }
});

// ============ WISHLIST ============
app.get("/api/wishlist", customerAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ items: await getWishlist((req as any).customer.sub) });
});

app.post("/api/wishlist", customerAuthMiddleware, async (req: Request, res: Response) => {
  const { productId, notes } = req.body || {};
  if (!productId) { res.status(400).json({ error: "productId is required." }); return; }
  await addToWishlist((req as any).customer.sub, productId, notes);
  res.status(201).json({ ok: true });
});

app.delete("/api/wishlist/:productId", customerAuthMiddleware, async (req: Request, res: Response) => {
  await removeFromWishlist((req as any).customer.sub, String(req.params.productId));
  res.status(204).end();
});

app.get("/api/wishlist/check/:productId", customerAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ inWishlist: await isInWishlist((req as any).customer.sub, String(req.params.productId)) });
});

// ============ QUOTES ============
app.get("/api/quotes", customerAuthMiddleware, async (req: Request, res: Response) => {
  res.json({ quotes: await listQuotesForCustomer((req as any).customer.sub) });
});

app.post("/api/quotes/from-wishlist", customerAuthMiddleware, async (req: Request, res: Response) => {
  const wishlistIds = req.body?.wishlistIds;
  if (!wishlistIds || !Array.isArray(wishlistIds) || wishlistIds.length === 0) {
    res.status(400).json({ error: "wishlistIds array is required." }); return;
  }
  const quote = await createQuoteFromWishlist((req as any).customer.sub, wishlistIds.map(Number));
  res.status(201).json(quote);
});

app.patch("/api/quotes/:id/status", customerAuthMiddleware, async (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["pending", "waiting_for_approval", "cancelled", "approved"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }
  await updateQuoteStatus(Number(req.params.id), status);
  res.json({ ok: true });
});

// ============ ADMIN QUOTES ============
app.get("/api/admin/quotes", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const quotes = await listAllQuotes();
  const stats = { pending: 0, waiting_for_approval: 0, cancelled: 0, approved: 0, total: quotes.length };
  for (const q of quotes) {
    if (stats[q.status as keyof typeof stats] !== undefined) stats[q.status as keyof typeof stats]++;
  }
  res.json({ quotes, stats });
});

app.get("/api/admin/quotes/:id", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const quote = await getQuote(Number(req.params.id));
  if (!quote) { res.status(404).json({ error: "Quote not found." }); return; }
  res.json({ quote });
});

app.post("/api/admin/quotes", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, customerId: cid, notes, items, discountType, discountValue } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required." }); return;
    }
    let customerId = Number(cid) || 0;
    if (!customerId && customerName) {
      let walkIn = await queryOne("SELECT id FROM customers WHERE email = 'walkin@pos'") as any;
      if (!walkIn) {
        const r = await queryOne("INSERT INTO customers (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id", [customerName, "walkin@pos", "", customerPhone || ""]) as any;
        if (r && r.id) walkIn = { id: r.id };
      }
      if (walkIn) customerId = walkIn.id;
    }
    if (!customerId) { res.status(400).json({ error: "customerId or customerName is required." }); return; }
    const quote = await createQuote({ customerId, customerName: customerName || "", customerPhone: customerPhone || "", items, notes: notes || "", discountType: discountType || "", discountValue: discountValue || 0 });
    await recordAuditLog((req as any).user.sub, (req as any).user.username || "", "quote_created", "quote", String(quote.id), JSON.stringify({ quoteNumber: quote.quoteNumber, total: quote.total }), (req as any).user.role);
    res.status(201).json(quote);
    const cust = await findCustomerById(customerId);
    if (cust && cust.email && cust.email !== "walkin@pos") {
      const settings = await getSettings();
      const { subject: emailSub, html } = quoteEmail(cust.name || customerName || "Customer", quote.quoteNumber, String(quote.total), settings.currency, notes || "", `${process.env.BASE_URL || "http://localhost:3000"}/dashboard`);
      sendEmail(cust.email, emailSub, html, "quote");
    }
  } catch (err: any) {
    console.error("[quotes] create error:", err?.message || err);
    res.status(500).json({ error: "Failed to create quote." });
  }
});

app.put("/api/admin/quotes/:id", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await getQuote(id);
    if (!existing) { res.status(404).json({ error: "Quote not found." }); return; }
    const updated = await updateQuote(id, req.body || {});
    res.json({ quote: updated });
  } catch (err: any) {
    console.error("[quotes] update error:", err?.message || err);
    res.status(500).json({ error: "Failed to update quote." });
  }
});

app.delete("/api/admin/quotes/:id", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await getQuote(id);
    if (!existing) { res.status(404).json({ error: "Quote not found." }); return; }
    await deleteQuote(id);
    await recordAuditLog((req as any).user.sub, (req as any).user.username || "", "quote_deleted", "quote", String(id), JSON.stringify({ quoteNumber: existing.quoteNumber }), (req as any).user.role);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[quotes] delete error:", err?.message || err);
    res.status(500).json({ error: "Failed to delete quote." });
  }
});

app.post("/api/admin/quotes/:id/approve", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = await getQuote(id);
  if (!existing) { res.status(404).json({ error: "Quote not found." }); return; }
  const result = await convertQuoteToOrder(id, (req as any).user.username || "Staff");
  if (!result) { res.status(500).json({ error: "Failed to convert quote." }); return; }
  await recordAuditLog((req as any).user.sub, (req as any).user.username || "", "quote_approved", "quote", String(id), JSON.stringify({ quoteNumber: existing.quoteNumber, orderInvoice: result.invoiceNumber, total: existing.total }), (req as any).user.role);
  res.json({ order: result.order, invoiceNumber: result.invoiceNumber });
});

app.post("/api/admin/quotes/:id/cancel", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = await getQuote(id);
  if (!existing) { res.status(404).json({ error: "Quote not found." }); return; }
  await updateQuoteStatus(id, "cancelled");
  await recordAuditLog((req as any).user.sub, (req as any).user.username || "", "quote_cancelled", "quote", String(id), JSON.stringify({ quoteNumber: existing.quoteNumber }), (req as any).user.role);
  res.json({ ok: true });
});

app.get("/api/admin/quotes/:id/pdf", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const quote = await getQuote(Number(req.params.id));
  if (!quote) { res.status(404).json({ error: "Quote not found." }); return; }
  const settings = await getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const linesHtml = quote.items.map((i: any) => {
    const hasDiscount = i.discountType && i.discountValue > 0;
    const discountLabel = hasDiscount ? (i.discountType === "percentage" ? `${i.discountValue}% off` : `${currency} ${i.discountValue.toLocaleString()} off`) : "";
    return `<tr><td>${escapeHtml(i.productName)}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right;white-space:nowrap">${currency} ${Number(i.unitPrice).toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td style="text-align:center">${discountLabel || "—"}</td><td style="text-align:right;white-space:nowrap">${currency} ${Number(i.lineTotal).toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`;
  }).join("");
  const hasQuoteDiscount = quote.discountType && quote.discountValue > 0;
  const quoteDiscountLabel = hasQuoteDiscount ? (quote.discountType === "percentage" ? `${quote.discountValue}% off` : `${currency} ${quote.discountValue.toLocaleString()} off`) : "";
  const total = quote.total;
  const statusColors: Record<string, string> = { pending: "#f59e0b", waiting_for_approval: "#3b82f6", cancelled: "#ef4444", approved: "#10b981" };
  const statusColor = statusColors[quote.status] || "#6b7280";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quote #${quote.quoteNumber}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 0 auto; padding: 1rem; color: #1f2937; font-size: 13px; }
  .quote { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .status-badge { display:inline-block;padding:4px 12px;border-radius:999px;font-size:0.75rem;font-weight:600;color:#fff;background:${statusColor}; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; }
  .total-row { font-weight: 700; font-size: 1.1rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; font-size: 0.9rem; }
  .info-grid .label { color: #6b7280; font-size: 0.75rem; text-transform: uppercase; }
  .footer { margin-top: 2rem; font-size: 0.8rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
  .print-btn { display: block; margin: 1.5rem auto 0; padding: 0.6rem 2rem; background: #1f2937; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  @media print { body { margin: 0; } .quote { border: none; } .print-btn { display: none; } }
</style></head><body>
<div class="quote">
  <div class="header">
    <div>${renderStoreLogo(settings.storeLogo || "", settings.logoPosition || "top-left", store)}<h1>PRICE QUOTATION</h1><p style="font-size:0.9rem;color:#6b7280">Quote #${escapeHtml(quote.quoteNumber)} <span class="status-badge">${quote.status.replace(/_/g," ").toUpperCase()}</span></p></div>
    <div style="text-align:right;"><strong>${escapeHtml(store)}</strong><br><span style="font-size:0.85rem;color:#6b7280">${escapeHtml(storeEmail)}</span></div>
  </div>
  <div class="info-grid">
    <div><div class="label">Bill to</div><div><strong>${escapeHtml(quote.customerName || "—")}</strong></div>${quote.customerPhone ? `<div>${escapeHtml(quote.customerPhone)}</div>` : ""}</div>
    <div><div class="label">Quote details</div><div>Date: ${quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("en-GB",{year:"numeric",month:"long",day:"numeric"}) : "—"}</div><div>Status: ${quote.status.replace(/_/g," ")}</div></div>
  </div>
  <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:center">Discount</th><th style="text-align:right">Total</th></tr></thead><tbody>${linesHtml}</tbody></table>
  ${hasQuoteDiscount ? `<div style="text-align:right;margin:0.5rem 0;"><span style="color:#6b7280;">Quote Discount (${quoteDiscountLabel}):</span> &minus;${currency} ${(quote.discountType==="percentage" ? quote.total * quote.discountValue / (100 - quote.discountValue) : quote.discountValue).toFixed(2)}</div>` : ""}
  <div style="text-align:right;"><div class="total-row">Total: ${currency} ${total.toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
  ${quote.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(quote.notes)}</p>` : ""}
  <div class="footer">${escapeHtml(store)} &mdash; ${escapeHtml(storeEmail)}</div>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
</div>
</body></html>`;
  if (req.query.format === "pdf") {
    try {
      const pdf = await htmlToPdf(html);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="quote-${quote.quoteNumber}.pdf"`);
      res.send(pdf);
    } catch (pdfErr: any) {
      console.error("[quotes] PDF generation error:", pdfErr?.message || pdfErr);
      res.send(html);
    }
  } else {
    res.send(html);
  }
});

// ============ SPLASHES / PROMOTIONS ============

app.get("/api/splashes", async (_req: Request, res: Response) => {
  const splashes = await listActiveSplashes();
  res.json({ splashes });
});

app.get("/api/admin/splashes", staffAuthMiddleware, requirePermission("reports:view"), async (_req: Request, res: Response) => {
  const splashes = await listAllSplashes();
  res.json({ splashes });
});

app.post("/api/admin/splashes", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const { title, text, bgColor, textColor, isMarquee, isActive, startDate, endDate } = req.body || {};
  if (!text) { res.status(400).json({ error: "text is required." }); return; }
  const splash = await createSplash({ title, text, bgColor, textColor, isMarquee, isActive, startDate, endDate });
  res.status(201).json(splash);
});

app.put("/api/admin/splashes/:id", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const splash = await updateSplash(Number(req.params.id), req.body || {});
  if (!splash) { res.status(404).json({ error: "Splash not found." }); return; }
  res.json(splash);
});

app.delete("/api/admin/splashes/:id", staffAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const ok = await deleteSplash(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Splash not found." }); return; }
  res.json({ ok: true });
});

// ============ SHOP SUBSCRIPTION ============

app.get("/api/shop/subscription", staffAuthMiddleware, async (_req: Request, res: Response) => {
  const plan = await getShopPlan();
  res.json({ plan });
});

app.put("/api/shop/subscription", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { planId } = req.body || {};
  if (!planId) { res.status(400).json({ error: "planId is required." }); return; }
  const current = await getShopPlan();
  const ok = await setShopPlan(planId);
  if (!ok) { res.status(400).json({ error: "Invalid plan." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "plan_changed", "shop_subscription", planId, { from: current?.id || "none", to: planId }, (req as any).user.role);
  res.json({ ok: true });
});

app.post("/api/shop/subscription/request", staffAuthMiddleware, async (req: Request, res: Response) => {
  const { planId, notes } = req.body || {};
  if (!planId) { res.status(400).json({ error: "planId is required." }); return; }
  const ok = await createSubscriptionRequest(planId, (req as any).user.sub, notes || "");
  if (!ok) { res.status(400).json({ error: "Invalid plan." }); return; }
  res.status(201).json({ ok: true });
});

app.get("/api/shop/subscription/requests", adminAuthMiddleware, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  res.json({ requests: await listSubscriptionRequests(status) });
});

app.put("/api/shop/subscription/requests/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["approved", "rejected"].includes(status)) { res.status(400).json({ error: "Status must be approved or rejected." }); return; }
  const ok = await reviewSubscriptionRequest(Number(req.params.id), status, (req as any).user.sub);
  if (!ok) { res.status(400).json({ error: "Request not found or already reviewed." }); return; }
  await logAudit((req as any).user.sub, (req as any).user.username || "Admin", "request_" + status, "subscription_request", String(req.params.id), {}, (req as any).user.role);
  res.json({ ok: true });
});

app.get("/api/shop/features", async (_req: Request, res: Response) => {
  const plan = await getShopPlan();
  res.json({ features: plan?.features || [] });
});

app.get("/api/audit-log", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 200;
  const entityType = req.query.entityType as string | undefined;
  const isOwner = (req as any).user.role === "owner";
  res.json({ entries: await getAuditLog(limit, entityType, isOwner ? "admin" : undefined) });
});

// ============ OWNER DASHBOARD ============

// ============ COUPONS (Admin) ============

app.get("/api/admin/coupons", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ coupons: await listCoupons() });
});

app.post("/api/admin/coupons", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const coupon = await createCoupon(req.body || {});
    res.status(201).json(coupon);
  } catch (err: any) {
    console.error("[coupon create]", err?.message || err);
    res.status(400).json({ error: "Failed to create coupon." });
  }
});

app.put("/api/admin/coupons/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const coupon = await updateCoupon(Number(req.params.id), req.body || {});
    res.json(coupon);
  } catch (err: any) {
    console.error("[coupon update]", err?.message || err);
    res.status(400).json({ error: "Failed to update coupon." });
  }
});

app.delete("/api/admin/coupons/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await deleteCoupon(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Coupon not found." }); return; }
  res.json({ ok: true });
});

// ============ COUPONS (Public validate) ============

app.post("/api/coupons/validate", customerAuthMiddleware, async (req: Request, res: Response) => {
  const { code, subtotal } = req.body || {};
  if (!code) { res.status(400).json({ error: "Coupon code is required." }); return; }
  const result = await validateCoupon(String(code).trim(), Number(subtotal) || 0);
  if (!result.valid) { res.status(400).json({ error: "Invalid coupon." }); return; }
  res.json({ discount: result.discount });
});

// ============ SUPPLIERS (Admin) ============

app.get("/api/admin/suppliers", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  res.json({ suppliers: await listSuppliers() });
});

app.post("/api/admin/suppliers", ownerAuthMiddleware, async (req: Request, res: Response) => {
  res.status(201).json(await createSupplier(req.body || {}));
});

app.put("/api/admin/suppliers/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const supplier = await updateSupplier(Number(req.params.id), req.body || {});
  res.json(supplier);
});

app.delete("/api/admin/suppliers/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await deleteSupplier(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Supplier not found." }); return; }
  res.json({ ok: true });
});

app.get("/api/admin/customers", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  await deactivateOldCustomers();
  const includeInactive = String(_req.query.includeInactive || "") === "true";
  const customers = includeInactive ? await listAllCustomers() : await listActiveCustomers();
  res.json({ customers });
});

app.post("/api/admin/customers", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) { res.status(400).json({ error: "Name, email, and password required." }); return; }
  try {
    const existing = await findCustomerByEmail(email);
    if (existing) { res.status(409).json({ error: "Email already registered." }); return; }
    const customer = await createCustomer({ name, email, password, phone: phone || "" });
    if (!customer) { res.status(500).json({ error: "Failed to create customer." }); return; }
    res.json({ customer });
  } catch (err: any) { res.status(500).json({ error: "Failed to create customer." }); }
});

app.delete("/api/admin/customers/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await deleteCustomer(Number(req.params.id));
  res.json({ success: ok });
});

app.get("/api/admin/customers/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const customer = await getCustomerDetails(Number(req.params.id));
  if (!customer) { res.status(404).json({ error: "Customer not found." }); return; }
  res.json(customer);
});

app.patch("/api/admin/customers/:id/status", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const { isActive } = req.body || {};
  if (isActive === undefined) { res.status(400).json({ error: "isActive required." }); return; }
  await updateCustomerStatus(Number(req.params.id), Boolean(isActive));
  res.json({ success: true });
});

app.get("/api/admin/messages", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json({ messages: await listAllMessages() });
  } catch (err: any) {
    console.error("[admin messages]", err?.message || err);
    res.status(500).json({ error: "Failed to load messages." });
  }
});

app.post("/api/admin/messages", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId, providerId, subject, body } = req.body || {};
    if (!customerId || !providerId || !body) { res.status(400).json({ error: "customerId, providerId, and body are required." }); return; }
    const msg = await sendMessage(Number(customerId), Number(providerId), subject || "", body, "admin");
    res.status(201).json(msg);
    const customer = await findCustomerById(Number(customerId));
    const provider = await findProviderById(Number(providerId));
    if (customer && provider) {
      const senderName = (req as any).user.username || "Admin";
      const { subject: emailSub, html } = messageNotificationEmail(senderName, "admin", subject || "", body.substring(0, 300), `${process.env.BASE_URL || "http://localhost:3000"}/dashboard`);
      if (customer.email) sendEmail(customer.email, emailSub, html, "message");
      if (provider.email) sendEmail(provider.email, emailSub, html, "message");
      const settings = await getSettings();
      if (settings.emailSender) sendEmail(settings.emailSender, emailSub, html, "message_cc");
    }
  } catch (err: any) {
    console.error("[admin message send]", err?.message || err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

app.patch("/api/admin/messages/:id/read", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    await markMessageRead(Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[admin message read]", err?.message || err);
    res.status(500).json({ error: "Failed to mark message as read." });
  }
});

app.get("/api/reports/sales/trends", ownerAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const from = String(req.query.from || "").slice(0, 10);
  const to = String(req.query.to || "").slice(0, 10);
  const branchId = req.query.branch_id ? Number(req.query.branch_id) : undefined;
  if (!from || !to) { res.status(400).json({ error: "from and to dates required." }); return; }
  let sql = `SELECT DATE(created_at) as day, COUNT(*) as orders, SUM(subtotal + shipping_fee - COALESCE(discount_amount, 0)) as revenue FROM orders WHERE status != 'cancelled' AND created_at >= $1 AND created_at < ($2::date + interval '1 day')`;
  const params: any[] = [from, to];
  if (branchId) { sql += ` AND branch_id = $${params.length + 1}`; params.push(branchId); }
  sql += " GROUP BY day ORDER BY day";
  const rows = await queryAll(sql, params);
  res.json({ trends: rows });
});

app.get("/api/reports/sales", ownerAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  const from = String(req.query.from || "1970-01-01");
  const to = String(req.query.to || "2099-12-31");
  res.json(await getSalesReportWithRange(from, to));
});

app.get("/api/reports/stock-summary", ownerAuthMiddleware, requirePermission("reports:view"), async (_req: Request, res: Response) => {
  res.json({ items: await getStockSummary() });
});

app.get("/api/reports/employee-sales", ownerAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  res.json({ employees: await getEmployeeSalesPerformance() });
});

app.get("/api/reports/technician-repairs", ownerAuthMiddleware, requirePermission("reports:view"), async (req: Request, res: Response) => {
  res.json({ technicians: await getTechnicianRepairStats() });
});

// ============ STOCK TAKE ============

app.get("/api/stock-take", ownerAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json({ sessions: await listStockTakeSessions() });
  } catch (err: any) {
    console.error("[stock-take list]", err?.message || err);
    res.status(500).json({ error: "Failed to load sessions." });
  }
});

app.post("/api/stock-take/start", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await createStockTakeSession(req.body?.notes || "", (req as any).user.sub);
    if (!session) { res.status(500).json({ error: "Failed to create stock take session." }); return; }
    const items = await getStockTakeItems(session.id);
    res.status(201).json({ session, items });
  } catch (err: any) {
    console.error("[stock-take start]", err?.message || err);
    res.status(500).json({ error: "Failed to start stock take." });
  }
});

app.get("/api/stock-take/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await getStockTakeSession(Number(req.params.id));
    if (!session) { res.status(404).json({ error: "Session not found." }); return; }
    const items = await getStockTakeItems(Number(req.params.id));
    res.json({ session, items });
  } catch (err: any) {
    console.error("[stock-take get]", err?.message || err);
    res.status(500).json({ error: "Failed to load session." });
  }
});

app.post("/api/stock-take/:id/count", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { productId, countedQuantity, notes } = req.body || {};
    if (!productId || countedQuantity === undefined) { res.status(400).json({ error: "productId and countedQuantity are required." }); return; }
    await recordStockCount(Number(req.params.id), String(productId), Number(countedQuantity), notes || "");
    const items = await getStockTakeItems(Number(req.params.id));
    res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[stock-take count]", err?.message || err);
    res.status(500).json({ error: "Failed to record count." });
  }
});

app.post("/api/stock-take/:id/complete", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const ok = await completeStockTakeSession(Number(req.params.id));
    if (!ok) { res.status(400).json({ error: "Cannot complete session." }); return; }
    const adjusted = await applyStockTakeAdjustments(Number(req.params.id));
    const report = await getStockTakeVarianceReport(Number(req.params.id));
    (report as any).adjusted = adjusted;
    const session = await getStockTakeSession(Number(req.params.id));
    res.json({ ok: true, report, session });
  } catch (err: any) {
    console.error("[stock-take complete]", err?.message || err);
    res.status(500).json({ error: "Failed to complete stock take." });
  }
});

app.post("/api/stock-take/:id/apply", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const adjusted = await applyStockTakeAdjustments(Number(req.params.id));
    res.json({ ok: true, adjusted });
  } catch (err: any) {
    console.error("[stock-take apply]", err?.message || err);
    res.status(500).json({ error: "Failed to apply adjustments." });
  }
});

app.get("/api/stock-take/:id/report", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    res.json(await getStockTakeVarianceReport(Number(req.params.id)));
  } catch (err: any) {
    console.error("[stock-take report]", err?.message || err);
    res.status(500).json({ error: "Failed to load report." });
  }
});

app.delete("/api/stock-take/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await deleteStockTakeSession(Number(req.params.id));
    if (!result.ok) { res.status(400).json({ error: result.error }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[stock-take delete]", err?.message || err);
    res.status(500).json({ error: "Failed to delete session." });
  }
});

// ============ STOCK ON HAND / SNAPSHOTS ============

app.get("/api/stock-on-hand/current", adminAuthMiddleware, requirePermission("stock:on_hand"), async (_req: Request, res: Response) => {
  res.json({ items: await getCurrentStockLevels(), date: new Date().toISOString().slice(0, 10) });
});

app.get("/api/stock-on-hand/history", adminAuthMiddleware, requirePermission("stock:on_hand"), async (_req: Request, res: Response) => {
  res.json({ dates: await listStockSnapshotDates() });
});

app.get("/api/stock-on-hand/:date", adminAuthMiddleware, requirePermission("stock:on_hand"), async (req: Request, res: Response) => {
  const snapshot = await getStockSnapshot(String(req.params.date));
  if (snapshot.items.length === 0) { res.status(404).json({ error: "No snapshot for this date." }); return; }
  res.json(snapshot);
});

app.post("/api/stock-on-hand/snapshot", adminAuthMiddleware, requirePermission("stock:on_hand"), async (req: Request, res: Response) => {
  const date = req.body?.date || new Date().toISOString().slice(0, 10);
  await createStockSnapshot(date);
  res.json({ ok: true, date });
});

// ============ SPEC TEMPLATES ============

app.get("/api/spec-templates", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  if (category) res.json({ fields: await getSpecTemplateFields(category) });
  else res.json({ fields: await getAllSpecTemplateFields() });
});

app.post("/api/spec-templates", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const field = await createSpecTemplateField(req.body);
  if (!field) { res.status(400).json({ error: "Failed to create spec field." }); return; }
  res.status(201).json(field);
});

app.put("/api/spec-templates/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await updateSpecTemplateField(Number(req.params.id), req.body);
  if (!ok) { res.status(404).json({ error: "Spec field not found." }); return; }
  res.json({ ok: true });
});

app.delete("/api/spec-templates/:id", ownerAuthMiddleware, async (req: Request, res: Response) => {
  const ok = await deleteSpecTemplateField(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Spec field not found." }); return; }
  res.json({ ok: true });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Error]", err?.message || err);
  res.status(err?.status || 500).json({ error: "Internal server error." });
});

// Start server
(async () => {
  await initDb();
  const startupSettings = await getSettings();
  reconfigureCloudinary(startupSettings.cloudinaryCloudName, startupSettings.cloudinaryApiKey, startupSettings.cloudinaryApiSecret, startupSettings.cloudinaryFolder);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  process.on("SIGTERM", async () => { await closeBrowser(); process.exit(0); });
  process.on("SIGINT", async () => { await closeBrowser(); process.exit(0); });
})();
