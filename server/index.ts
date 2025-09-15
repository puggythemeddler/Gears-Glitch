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
  getDb,
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
  updateCustomer,
  deleteStaff,
  getStockLevel,
  updateStockLevel,
  recordStockMovement,
  getStockMovements,
  getLowStockItems,
  listCategories,
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
  updateProvider,
  updateProviderStatus,
  getProviderSubscription,
  assignPlanToProvider,
  getProviderAssignmentHistory,
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
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
  listQuotesForCustomer,
  listAllQuotes,
  updateQuoteStatus,
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
  getProductRating,
  hasCustomerReviewed,
} from "./db";
import {
  adminAuthMiddleware,
  ownerAuthMiddleware,
  staffAuthMiddleware,
  customerAuthMiddleware,
  providerAuthMiddleware,
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
import { uploadProductImage, uploadGalleryImage, uploadRepairImage, imageUrlForProduct } from "./upload";
import { getCounties, getShippingFee } from "./shipping";
import { getMpesaConfig, updateMpesaConfig, stkPush, isMpesaConfigured } from "./mpesa";
import bcrypt from "bcryptjs";

const PORT: number = Number(process.env.PORT) || 8020;
const ROOT: string = path.join(__dirname, "..");

initDb();

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
    ? [`http://localhost:3000`, `https://${process.env.BASE_URL ? new URL(process.env.BASE_URL).host : "localhost"}`]
    : true;
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

// Permission guard helper
function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const uid = (req as any).user?.sub;
    if (!uid) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (!hasPermission(getDb(), uid, perm)) { res.status(403).json({ error: `Missing permission: ${perm}` }); return; }
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
  const checkoutId = data?.Body?.stkCallback?.CheckoutRequestID;
  if (!checkoutId) {
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

app.get("/api/settings", staffAuthMiddleware, requirePermission("settings:view"), (_req: Request, res: Response) => {
  const settings = getSettings() as any;
  settings.googleClientId = getStoreSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "";
  settings.kraPin = (getDb().prepare("SELECT value FROM settings WHERE key = 'kra_pin'").get() as any)?.value || "";
  settings.etimsSerialPrefix = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_serial_prefix'").get() as any)?.value || "01";
  settings.etimsMode = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_mode'").get() as any)?.value || "vscu";
  settings.etimsBranchId = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_branch_id'").get() as any)?.value || "00";
  settings.etimsDeviceSerial = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_device_serial'").get() as any)?.value || "dvc001";
  settings.etimsVscuUrl = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_vscu_url'").get() as any)?.value || "http://localhost:8088";
  settings.etimsOscuApiUrl = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_oscu_api_url'").get() as any)?.value || "https://etims.kra.go.ke/api";
  settings.etimsOscuConsumerKey = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_oscu_consumer_key'").get() as any)?.value || "";
  settings.etimsOscuConsumerSecret = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_oscu_consumer_secret'").get() as any)?.value || "";
  settings.paymentMethods = getPaymentMethods();
  res.json(settings);
});

app.get("/api/public-settings", (_req: Request, res: Response) => {
  const { storeName, phone, email, currency, storeLogo, taxRate } = getSettings();
  const mpesaCfg = getMpesaConfig();
  const layout = getStoreSetting("store_layout") || "original";
  let banners: any[] = [];
  try { banners = JSON.parse(getStoreSetting("store_banners") || "[]"); } catch {}
  let aboutUs: any = {};
  try { aboutUs = JSON.parse(getStoreSetting("about_us") || "{}"); } catch {}
  res.json({
    storeName,
    phone,
    email,
    currency,
    storeLogo,
    taxRate,
    layout,
    banners,
    aboutUs,
    googleClientId: getStoreSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "",
    mpesaTillNumber: mpesaCfg.tillNumber,
    mpesaConfigured: isMpesaConfigured(),
  });
});

// ============ EXCHANGE RATES ============

let ratesCache: { rates: Record<string, number>; timestamp: number } | null = null;
const RATES_CACHE_TTL = 3600000; // 1 hour

app.get("/api/rates", (_req: Request, res: Response) => {
  const manualRates = getStoreSetting("exchange_rates");
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

app.put("/api/rates", adminAuthMiddleware, requirePermission("settings:update"), (req: Request, res: Response) => {
  const { rates } = req.body || {};
  if (!rates || typeof rates !== "object") {
    res.status(400).json({ error: "Rates object required." });
    return;
  }
  setStoreSetting("exchange_rates", JSON.stringify(rates));
  res.json({ base: "KES", rates, source: "manual" });
});

app.delete("/api/rates", adminAuthMiddleware, requirePermission("settings:update"), (_req: Request, res: Response) => {
  const key = getDb().prepare("DELETE FROM settings WHERE key = 'exchange_rates'").run();
  res.json({ message: "Manual rates cleared, auto-fetch will resume." });
});

// ============ STOREFRONT LAYOUT ============

app.get("/api/storefront-config", (_req: Request, res: Response) => {
  const layout = getStoreSetting("store_layout") || "original";
  let banners: any[] = [];
  try { banners = JSON.parse(getStoreSetting("store_banners") || "[]"); } catch {}
  let features: any[] = [];
  try { features = JSON.parse(getStoreSetting("store_features") || "[]"); } catch {}
  res.json({ layout, banners, features });
});

app.get("/api/admin/storefront-layout", adminAuthMiddleware, (_req: Request, res: Response) => {
  const layout = getStoreSetting("store_layout") || "original";
  let banners: any[] = [];
  try { banners = JSON.parse(getStoreSetting("store_banners") || "[]"); } catch {}
  let features: any[] = [];
  try { features = JSON.parse(getStoreSetting("store_features") || "[]"); } catch {}
  res.json({ layout, banners, features });
});

app.put("/api/admin/storefront-layout", adminAuthMiddleware, (req: Request, res: Response) => {
  const { layout, banners, features } = req.body || {};
  if (layout) {
    const valid = ["original", "amazon", "jumia", "mobile"];
    if (!valid.includes(layout)) { res.status(400).json({ error: "Invalid layout. Valid: " + valid.join(", ") }); return; }
    setStoreSetting("store_layout", layout);
  }
  if (banners !== undefined) setStoreSetting("store_banners", JSON.stringify(banners));
  if (features !== undefined) setStoreSetting("store_features", JSON.stringify(features));
  const currentLayout = getStoreSetting("store_layout") || "amazon";
  let currentBanners: any[] = [];
  try { currentBanners = JSON.parse(getStoreSetting("store_banners") || "[]"); } catch {}
  let currentFeatures: any[] = [];
  try { currentFeatures = JSON.parse(getStoreSetting("store_features") || "[]"); } catch {}
  res.json({ layout: currentLayout, banners: currentBanners, features: currentFeatures });
});

// ============ ABOUT US ============

app.get("/api/admin/about-us", adminAuthMiddleware, (_req: Request, res: Response) => {
  let aboutUs: any = {};
  try { aboutUs = JSON.parse(getStoreSetting("about_us") || "{}"); } catch {}
  res.json(aboutUs);
});

app.put("/api/admin/about-us", adminAuthMiddleware, (req: Request, res: Response) => {
  const { title, content, mission, vision } = req.body || {};
  const data = { title: title || "", content: content || "", mission: mission || "", vision: vision || "" };
  setStoreSetting("about_us", JSON.stringify(data));
  res.json(data);
});

app.put("/api/settings", adminAuthMiddleware, requirePermission("settings:update"), (req: Request, res: Response) => {
  const { storeName, phone, email, currency, taxRate, mpesaConsumerKey, mpesaConsumerSecret, mpesaPasskey, mpesaShortcode, mpesaTillNumber, mpesaEnv, googleClientId, kraPin, etimsSerialPrefix } = req.body || {};
  if (storeName !== undefined && !String(storeName).trim()) {
    res.status(400).json({ error: "Store name is required." });
    return;
  }
  const settings = updateSettings({ storeName, phone, email, currency, taxRate, paymentMethods: req.body.paymentMethods }) as any;
  if (googleClientId !== undefined) {
    setStoreSetting("google_client_id", String(googleClientId).trim());
    settings.googleClientId = getStoreSetting("google_client_id") || "";
  }
  if (kraPin !== undefined) {
    getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('kra_pin', ?)").run(String(kraPin).trim());
    settings.kraPin = String(kraPin).trim();
  }
  if (etimsSerialPrefix !== undefined) {
    getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('etims_serial_prefix', ?)").run(String(etimsSerialPrefix).trim());
    settings.etimsSerialPrefix = String(etimsSerialPrefix).trim();
  }
  const etimsKeys: Record<string, string> = {
    etimsMode: "etims_mode", etimsBranchId: "etims_branch_id", etimsDeviceSerial: "etims_device_serial",
    etimsVscuUrl: "etims_vscu_url", etimsOscuApiUrl: "etims_oscu_api_url",
    etimsOscuConsumerKey: "etims_oscu_consumer_key", etimsOscuConsumerSecret: "etims_oscu_consumer_secret",
  };
  for (const [bodyKey, dbKey] of Object.entries(etimsKeys)) {
    if ((req.body as any)[bodyKey] !== undefined) {
      getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(dbKey, String((req.body as any)[bodyKey]).trim());
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
  const mpesaCfg = getMpesaConfig();
  res.json({ ...settings, paymentMethods: getPaymentMethods(), mpesa: mpesaCfg });
});

app.post("/api/settings/logo", adminAuthMiddleware, (req: Request, res: Response) => {
  uploadProductImage(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: "Upload failed." }); return; }
    if (!req.file) { res.status(400).json({ error: "No image file provided." }); return; }
    const logoUrl = `/uploads/${(req.file as any).filename}`;
    updateSettings({ storeLogo: logoUrl });
    res.json({ logoUrl });
  });
});

// ============ PROVIDER / SUBSCRIPTION PLANS ============

app.post("/api/provider/register", async (req: Request, res: Response) => {
  const { companyName, contactName, email, password, phone } = req.body || {};
  if (!companyName || !contactName || !email || !password) {
    res.status(400).json({ error: "Company name, contact name, email, and password are required." }); return;
  }
  if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  if (findProviderByEmail(email.toLowerCase())) { res.status(409).json({ error: "A provider with this email already exists." }); return; }
  const provider = createProvider(companyName, contactName, email.toLowerCase(), password, phone || "");
  if (!provider) { res.status(500).json({ error: "Failed to create provider account." }); return; }
  assignPlanToProvider(provider.id, "starter", {});
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

app.get("/api/provider/me", providerAuthMiddleware, (req: Request, res: Response) => {
  const provider = findProviderById((req as any).provider.sub);
  if (!provider) { res.status(404).json({ error: "Provider not found." }); return; }
  res.json(provider);
});

app.put("/api/provider/me", providerAuthMiddleware, (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  const { companyName, contactName, phone } = req.body || {};
  const ok = updateProvider(providerId, { company_name: companyName, contact_name: contactName, phone });
  if (!ok) { res.status(400).json({ error: "No fields to update." }); return; }
  res.json({ ok: true, provider: findProviderById(providerId) });
});

app.get("/api/provider/sales", providerAuthMiddleware, (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  const sub = getProviderSubscription(providerId);
  const tier = sub ? (getSubscriptionPlan(sub.planId)?.tierLevel ?? 0) : 0;
  const from = String(req.query.from || "1970-01-01");
  const to = String(req.query.to || "2099-12-31");
  const orders = getDb().prepare(`
    SELECT o.*, c.name AS customer_name FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'cancelled'
    GROUP BY o.id ORDER BY o.created_at DESC
  `).all(from, to) as any[];
  const totalRevenue = orders.reduce((s: number, o: any) => s + (o.subtotal || 0) + (o.shipping_fee || 0), 0);
  res.json({ totalOrders: orders.length, totalRevenue, orders });
});

app.get("/api/provider/subscription", providerAuthMiddleware, (req: Request, res: Response) => {
  const sub = getProviderSubscription((req as any).provider.sub);
  if (!sub) {
    const plan = getSubscriptionPlan("starter");
    const defaultSub = { planId: "starter", planName: plan?.name || "Starter", status: "trial", customPrice: null, startDate: new Date().toISOString().slice(0, 10), endDate: null, notes: "" };
    res.json({ subscription: defaultSub, plan });
    return;
  }
  const plan = getSubscriptionPlan(sub.planId);
  res.json({ subscription: sub, plan });
});

app.get("/api/plans", (_req: Request, res: Response) => {
  res.json({ plans: listSubscriptionPlans(false) });
});

app.get("/api/admin/plans", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ plans: listSubscriptionPlans(true) });
});

app.post("/api/admin/plans", adminAuthMiddleware, (req: Request, res: Response) => {
  const { id, name, description, price, tierLevel, maxProducts, features } = req.body || {};
  if (!id || !name) { res.status(400).json({ error: "Plan ID and name are required." }); return; }
  if (getSubscriptionPlan(id)) { res.status(409).json({ error: "A plan with this ID already exists." }); return; }
  const plan = createSubscriptionPlan({ id, name, description, price, tierLevel, maxProducts, features });
  if (!plan) { res.status(500).json({ error: "Failed to create plan." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "created", "plan", id, { name }, (req as any).user.role);
  res.status(201).json({ plan });
});

app.put("/api/admin/plans/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const plan = updateSubscriptionPlan(String(req.params.id), req.body || {});
  if (!plan) { res.status(404).json({ error: "Plan not found." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "updated", "plan", String(req.params.id), { changes: Object.keys(req.body || {}) }, (req as any).user.role);
  res.json({ plan });
});

app.delete("/api/admin/plans/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  if (["starter", "basic", "pro", "enterprise"].includes(String(req.params.id))) {
    res.status(400).json({ error: "Cannot delete default plans." }); return;
  }
  const ok = deleteSubscriptionPlan(String(req.params.id));
  if (!ok) { res.status(404).json({ error: "Plan not found." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "deleted", "plan", String(req.params.id), {}, (req as any).user.role);
  res.status(204).end();
});

// ============ BRANCHES ============

app.get("/api/admin/branches", ownerAuthMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const branches = user.role === "admin" ? listBranches() : listBranches(user.sub);
  res.json({ branches });
});

app.post("/api/admin/branches", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { name, address, phone, email, managerId } = req.body || {};
  if (!name || !name.trim()) { res.status(400).json({ error: "Branch name is required." }); return; }

  // Check subscription limit
  const check = canCreateBranch();
  if (!check.allowed) {
    res.status(403).json({ error: `Branch limit reached (${check.current}/${check.max}). Upgrade your plan to add more branches.` }); return;
  }

  const branch = createBranch({ name: name.trim(), address, phone, email, managerId: managerId || null });
  if (!branch) { res.status(500).json({ error: "Failed to create branch." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "created", "branch", String(branch.id), { name }, (req as any).user.role);
  res.status(201).json({ branch });
});

app.put("/api/admin/branches/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid branch ID." }); return; }
  const { name, address, phone, email, managerId, isActive } = req.body || {};
  const branch = updateBranch(id, { name, address, phone, email, managerId, isActive });
  if (!branch) { res.status(404).json({ error: "Branch not found." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "updated", "branch", String(id), { name }, (req as any).user.role);
  res.json({ branch });
});

app.delete("/api/admin/branches/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid branch ID." }); return; }
  const ok = deleteBranch(id);
  if (!ok) { res.status(404).json({ error: "Branch not found." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "deleted", "branch", String(id), {}, (req as any).user.role);
  res.status(204).end();
});

// ============ CLIENTS (Multi-Tenant) ============

app.get("/api/admin/clients", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ clients: listClients() });
});

app.get("/api/admin/clients/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const client = getClient(id);
  if (!client) { res.status(404).json({ error: "Client not found." }); return; }
  res.json({ client });
});

app.post("/api/admin/clients", adminAuthMiddleware, (req: Request, res: Response) => {
  const { name, email, phone, address } = req.body || {};
  if (!name || !name.trim()) { res.status(400).json({ error: "Client name is required." }); return; }
  const client = createClient({ name: name.trim(), email, phone, address });
  if (!client) { res.status(500).json({ error: "Failed to create client." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "created", "client", String(client.id), { name }, (req as any).user.role);
  res.status(201).json({ client });
});

app.put("/api/admin/clients/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const { name, email, phone, address, isActive, settings } = req.body || {};
  const client = updateClient(id, { name, email, phone, address, isActive, settings });
  if (!client) { res.status(404).json({ error: "Client not found." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "updated", "client", String(id), { name }, (req as any).user.role);
  res.json({ client });
});

app.delete("/api/admin/clients/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const ok = deleteClient(id);
  if (!ok) { res.status(404).json({ error: "Client not found." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "deleted", "client", String(id), {}, (req as any).user.role);
  res.status(204).end();
});

// Per-client branch management
app.get("/api/admin/clients/:id/branches", adminAuthMiddleware, (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  try {
    const branches = listClientBranches(clientId);
    res.json({ branches });
  } catch {
    res.status(500).json({ error: "Failed to list branches." });
  }
});

app.post("/api/admin/clients/:id/branches", adminAuthMiddleware, (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID." }); return; }
  const { name, address, phone, email, managerId } = req.body || {};
  if (!name || !name.trim()) { res.status(400).json({ error: "Branch name is required." }); return; }
  try {
    const branch = createClientBranch(clientId, { name: name.trim(), address, phone, email, managerId: managerId || null });
    if (!branch) { res.status(500).json({ error: "Failed to create branch." }); return; }
    res.status(201).json({ branch });
  } catch {
    res.status(500).json({ error: "Failed to create branch." });
  }
});

app.put("/api/admin/clients/:id/branches/:branchId", adminAuthMiddleware, (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  const branchId = parseInt(String(req.params.branchId), 10);
  if (isNaN(clientId) || isNaN(branchId)) { res.status(400).json({ error: "Invalid ID." }); return; }
  const { name, address, phone, email, managerId, isActive } = req.body || {};
  try {
    const branch = updateClientBranch(clientId, branchId, { name, address, phone, email, managerId, isActive });
    if (!branch) { res.status(404).json({ error: "Branch not found." }); return; }
    res.json({ branch });
  } catch {
    res.status(500).json({ error: "Failed to update branch." });
  }
});

app.delete("/api/admin/clients/:id/branches/:branchId", adminAuthMiddleware, (req: Request, res: Response) => {
  const clientId = parseInt(String(req.params.id), 10);
  const branchId = parseInt(String(req.params.branchId), 10);
  if (isNaN(clientId) || isNaN(branchId)) { res.status(400).json({ error: "Invalid ID." }); return; }
  try {
    const ok = deleteClientBranch(clientId, branchId);
    if (!ok) { res.status(404).json({ error: "Branch not found." }); return; }
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete branch." });
  }
});

app.get("/api/admin/providers", ownerAuthMiddleware, (_req: Request, res: Response) => {
  const providers = listProviders().map((p) => {
    const sub = getProviderSubscription(p.id);
    return { ...p, subscription: sub || null };
  });
  res.json({ providers });
});

app.get("/api/admin/providers/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const provider = findProviderById(Number(req.params.id));
  if (!provider) { res.status(404).json({ error: "Provider not found." }); return; }
  const subscription = getProviderSubscription(Number(req.params.id));
  const history = getProviderAssignmentHistory(Number(req.params.id));
  res.json({ provider, subscription, history });
});

app.post("/api/admin/providers/:id/subscription", adminAuthMiddleware, (req: Request, res: Response) => {
  const { planId, customPrice, startDate, endDate, notes } = req.body || {};
  if (!planId) { res.status(400).json({ error: "Plan ID is required." }); return; }
  if (!getSubscriptionPlan(planId)) { res.status(404).json({ error: "Plan not found." }); return; }
  const ok = assignPlanToProvider(Number(req.params.id), planId, { customPrice, startDate, endDate, notes, createdBy: (req as any).user.sub });
  if (!ok) { res.status(500).json({ error: "Failed to assign plan." }); return; }
  res.json({ ok: true });
});

app.patch("/api/admin/providers/:id/status", adminAuthMiddleware, (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["active", "inactive", "trial"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }
  const ok = updateProviderStatus(Number(req.params.id), status);
  if (!ok) { res.status(404).json({ error: "Provider not found." }); return; }
  res.json({ ok: true });
});

// ============ PROVIDER FEATURE ENFORCEMENT ============

function requireProviderFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const providerId = (req as any).provider?.sub;
    if (!providerId) { res.status(401).json({ error: "Provider login required." }); return; }
    if (!providerHasFeature(providerId, feature)) {
      res.status(403).json({ error: `Your plan does not include "${feature}". Upgrade to access this feature.` });
      return;
    }
    next();
  };
}

// ============ PROVIDER PRODUCT ACCESS ============

app.get("/api/provider/products", providerAuthMiddleware, requireProviderFeature("Product listing"), (req: Request, res: Response) => {
  const sub = getProviderSubscription((req as any).provider.sub);
  const tier = sub ? (getSubscriptionPlan(sub.planId)?.tierLevel ?? 0) : 0;
  const products = listProducts({ minTier: tier });
  res.json({ products, currency: getSettings().currency, tier });
});

// ============ ORDERS ============

app.get("/api/pos/payment-methods", (_req: Request, res: Response) => {
  res.json({ methods: getPaymentMethods() });
});

app.post("/api/pos/checkout", staffAuthMiddleware, async (req: Request, res: Response) => {
  const { customerName, customerId: selectedCustomerId, paymentMethod, tenderedAmount, items, idempotencyKey } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "Items are required." }); return; }
  if (items.length > 100) { res.status(400).json({ error: "Too many items (max 100)." }); return; }
  if (idempotencyKey) {
    const existing = getDb().prepare("SELECT id FROM orders WHERE idempotency_key = ?").get(idempotencyKey) as any;
    if (existing) { const dup = getOrder(existing.id); if (dup) { res.status(200).json({ order: dup }); return; } }
  }
  const paymentMethods = getPaymentMethods();
  const pmt = paymentMethod || "cash";
  const pmtConfig = paymentMethods.find((m: any) => m.id === pmt);
  if (!pmtConfig) { res.status(400).json({ error: "Invalid payment method." }); return; }
  const pmtCode = pmtConfig.kraCode;
  const staff = (req as any).user;
  const staffName = staff.username || staff.email || `Staff #${staff.sub}`;
  let customerId = staff.sub;
  if (selectedCustomerId && Number(selectedCustomerId) > 0) {
    const found = findCustomerById(Number(selectedCustomerId));
    if (found) customerId = found.id;
  }
  const db = getDb();
  let subtotal = 0;
  const resolvedItems: any[] = [];
  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product) { res.status(400).json({ error: `Product ${item.productId} not found.` }); return; }
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) { res.status(400).json({ error: `Invalid quantity for ${product.name}.` }); return; }
    const stock = getStockLevel(item.productId);
    if (stock && stock.quantityInStock < qty) { res.status(400).json({ error: `Insufficient stock for ${product.name} (available: ${stock.quantityInStock}).` }); return; }
    const lineTotal = product.price * qty;
    subtotal += lineTotal;
    resolvedItems.push({ ...product, quantity: qty, lineTotal });
  }
  const notes = `POS sale | ${pmt.toUpperCase()} | by ${staffName}`;
  let result;
  if (idempotencyKey) {
    result = db.prepare(
      "INSERT INTO orders (customer_id, status, shipping_name, shipping_address, shipping_county, shipping_fee, notes, subtotal, processed_by, idempotency_key) VALUES (?, 'pending', ?, 'POS Sale', '1', 0, ?, ?, ?, ?)"
    ).run(customerId, customerName || "POS Customer", notes, subtotal, staffName, idempotencyKey);
  } else {
    result = db.prepare(
      "INSERT INTO orders (customer_id, status, shipping_name, shipping_address, shipping_county, shipping_fee, notes, subtotal, processed_by) VALUES (?, 'pending', ?, 'POS Sale', '1', 0, ?, ?, ?)"
    ).run(customerId, customerName || "POS Customer", notes, subtotal, staffName);
  }
  const orderId = result.lastInsertRowid as number;
  const insertItem = db.prepare("INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total, has_warranty, warranty_duration, taxable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of resolvedItems) {
    const hw = item.hasWarranty ? 1 : 0;
    const wd = item.warrantyDuration || 0;
    const tx = (item.taxable !== false) ? 1 : 0;
    insertItem.run(orderId, item.id, item.name, item.price, item.quantity, item.lineTotal, hw, wd, tx);
  }
  updateOrderStatus(orderId, "delivered");
  const updated = getOrder(orderId);
  const change = pmt === "cash" && Number(tenderedAmount) > subtotal ? Number(tenderedAmount) - subtotal : 0;
  res.status(201).json({ order: updated, change });
});

app.get("/api/pos/receipt/:orderId", staffAuthMiddleware, (req: Request, res: Response) => {
  const order = getOrder(Number(req.params.orderId));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  const format = (req.query.format as string) || "thermal";
  const settings = getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const kraPin = (getDb().prepare("SELECT value FROM settings WHERE key = 'kra_pin'").get() as any)?.value || "P051234567Z";
  const etimsMode = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_mode'").get() as any)?.value || "vscu";
  const invoice = (getDb().prepare("SELECT * FROM order_invoices WHERE order_id = ?").get(order.id) as any);
  const etimsNumber = invoice?.etims_invoice_number || "";
  const controlCode = invoice?.control_code || "";
  const internalData = invoice?.internal_data || "";
  const signatureData = invoice?.signature_data || "";
  const receiptDate = invoice?.receipt_date || "";
  const taxType = invoice?.tax_type || "A";
  const vscuReceiptNo = invoice?.vscu_receipt_no || "";
  const taxRate = Number(settings.taxRate || 16);
  const total = order.subtotal + (order.shippingFee || 0);
  const modeLabel = etimsMode === "vscu" ? "VSCU" : "OSCU";
  const itemsHtml = order.items.map((i: any) => {
    const isTx = i.taxable !== false;
    const vat = isTx ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0;
    const tt = isTx ? taxType : "E";
    return `<tr><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${currency} ${i.lineTotal.toLocaleString()}</td><td>${isTx ? currency + " " + vat.toLocaleString() : "N/A"}</td><td style="font-size:0.7rem">${tt}</td></tr>`;
  }).join("");
  const totalVat = order.items.reduce((s: number, i: any) => {
    return s + (i.taxable !== false ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0);
  }, 0);
  const qrData = JSON.stringify({ inv: etimsNumber, dc: controlCode, pin: kraPin, amt: total, dt: order.createdAt, ri: vscuReceiptNo });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
  const qrSmall = format === "thermal" ? qrUrl.replace("size=120x120", "size=100x100") : qrUrl;

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
      return `<tr><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${currency} ${i.price.toLocaleString()}</td><td>${currency} ${i.lineTotal.toLocaleString()}</td><td>${isTx ? currency + " " + vat.toLocaleString() : "Exempt"}</td><td style="font-size:0.75rem">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
    }).join("");
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${store}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; }
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
    <div><h1>E-TIMS TAX INVOICE / RECEIPT</h1><p class="meta">Invoice #${order.id} | ${modeLabel} Receipt #${vscuReceiptNo}</p></div>
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
      <div>Mode: ${modeLabel}</div>
    </div>
  </div>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th>VAT</th><th>TT</th><th>Warranty</th></tr></thead><tbody>
    ${a4ItemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div>Subtotal: ${currency} ${order.subtotal.toLocaleString()}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString()}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString()}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString()}</div>
  </div>
  ${internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — Payment via M-Pesa | ${escapeHtml(storeEmail)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <button class="print-btn" onclick="window.print()">Print</button>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>
</div>
</body></html>`);
    return;
  }

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>POS Receipt #${order.id} — ${store}</title>
<style>
  body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 0.5rem; font-size: 0.8rem; color: #1f2937; }
  h1 { font-size: 1rem; text-align: center; margin: 0.5rem 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.25rem 0; text-align: left; }
  .total { font-weight: 700; font-size: 1rem; border-top: 1px dashed #000; padding-top: 0.5rem; }
  .center { text-align: center; }
  hr { border: none; border-top: 1px dashed #000; margin: 0.5rem 0; }
  .print-btn { display: block; margin: 1rem auto; padding: 0.5rem 1.5rem; background: #1f2937; color: #fff; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
  @media print { body { margin: 0; } .print-btn { display: none; } }
</style></head><body>
<h1>${escapeHtml(store)}</h1>
<div class="center">${escapeHtml(storeEmail)}<br>KRA PIN: ${escapeHtml(kraPin)}<br>Mode: ${modeLabel}</div>
<hr>
<div class="center"><strong>E-TIMS TAX RECEIPT</strong></div>
<div>eTIMS No: ${escapeHtml(etimsNumber)}</div>
<div>Control Code: ${escapeHtml(controlCode)}</div>
<div>Receipt No (${modeLabel}): ${vscuReceiptNo}</div>
${internalData ? `<div style="font-size:0.65rem;word-break:break-all">Int Data: ${escapeHtml(internalData.slice(0, 20))}...</div>` : ""}
<div>Date: ${receiptDate || new Date(order.createdAt).toLocaleString("en-GB")}</div>
<div>Receipt #: ${order.id}</div>
<div>Tax Type: ${taxType === "A" ? "VAT 16% (A)" : "Not Subject (E)"}</div>
<div>Mode: ${modeLabel}</div>
<hr>
<table><thead><tr><th>Item</th><th>Qty</th><th>Total</th><th>VAT</th><th>T</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<hr>
<div class="total">Total: ${currency} ${total.toLocaleString()}</div>
<div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString()}</div>
<hr>
<div class="center">${qrUrl ? `<img src="${qrSmall}" alt="eTIMS QR" style="width:80px;height:80px;" /><br>` : ""}Verify at https://itax.kra.go.ke</div>
<button class="print-btn" onclick="window.print()">Print Receipt</button>
</body></html>`);
});

app.get("/api/pos/customers", staffAuthMiddleware, (req: Request, res: Response) => {
  const q = (req.query.q as string || "").trim();
  if (q.length < 2) { res.json({ customers: [] }); return; }
  const like = `%${q}%`;
  const rows = getDb().prepare("SELECT id, name, email, phone FROM customers WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? LIMIT 20").all(like, like, like) as any[];
  res.json({ customers: rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone || "" })) });
});

app.post("/api/orders", customerAuthMiddleware, async (req: Request, res: Response) => {
  const { shippingName, shippingAddress, shippingCounty, shippingPhone, notes, mpesaPhone, couponCode, redeemPoints } = req.body || {};
  if (!shippingName || !shippingAddress || !shippingCounty) {
    res.status(400).json({ error: "Shipping name, address, and county are required." }); return;
  }
  const shippingF = getShippingFee(shippingCounty);
  const customerId = (req as any).customer.sub;
  const order = createOrder(customerId, {
    name: shippingName, address: shippingAddress, city: "", county: shippingCounty, postcode: shippingPhone || "", phone: shippingPhone || "", shippingFee: shippingF,
  }, notes || "", undefined, couponCode, redeemPoints ? Number(redeemPoints) : undefined);
  if (!order) { res.status(400).json({ error: "Cart is empty or could not create order." }); return; }
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
});

app.get("/api/orders", customerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ orders: listOrders((req as any).customer.sub) });
});

app.get("/api/orders/:id", customerAuthMiddleware, (req: Request, res: Response) => {
  const order = getOrder(Number(req.params.id));
  if (!order || order.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Order not found." }); return; }
  res.json(order);
});

app.get("/api/admin/orders", ownerAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ orders: listOrders() });
});

app.get("/api/admin/orders/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const order = getOrder(Number(req.params.id));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  res.json(order);
});

app.patch("/api/admin/orders/:id/status", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
    res.status(400).json({ error: "Invalid status." }); return;
  }
  const ok = updateOrderStatus(Number(req.params.id), status);
  if (!ok) { res.status(404).json({ error: "Order not found." }); return; }
  res.json({ ok: true });
});

app.patch("/api/admin/order-items/:id/warranty", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { hasWarranty, warrantyDuration } = req.body || {};
  const ok = updateOrderItemWarranty(Number(req.params.id), hasWarranty ? 1 : 0, warrantyDuration ? Number(warrantyDuration) : undefined);
  if (!ok) { res.status(404).json({ error: "Order item not found." }); return; }
  res.json({ ok: true });
});

app.post("/api/admin/invoice-token/:orderId", adminAuthMiddleware, (req: Request, res: Response) => {
  const order = getOrder(Number(req.params.orderId));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  const token = signToken({ sub: (req as any).user.sub, role: (req as any).user.role, orderId: Number(req.params.orderId), purpose: "invoice" }, "5m");
  res.json({ token });
});

app.get("/api/admin/orders/:id/invoice", (req: Request, res: Response) => {
  const token = getBearerToken(req);
  if (!token) { res.status(401).json({ error: "Login required." }); return; }
  try {
    const payload = verifyToken(token) as any;
    if (payload.role !== "admin" && payload.role !== "owner") {
      if (payload.purpose !== "invoice" || payload.orderId !== Number(req.params.id)) { res.status(403).json({ error: "Access denied." }); return; }
    }
    (req as any).user = payload;
  } catch { res.status(401).json({ error: "Session expired." }); return; }
  const order = getOrder(Number(req.params.id));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  const settings = getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const kraPin = (getDb().prepare("SELECT value FROM settings WHERE key = 'kra_pin'").get() as any)?.value || "P051234567Z";
  const etimsMode = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_mode'").get() as any)?.value || "vscu";
  const invoice = (getDb().prepare("SELECT * FROM order_invoices WHERE order_id = ?").get(order.id) as any);
  const etimsNumber = invoice?.etims_invoice_number || "";
  const controlCode = invoice?.control_code || "";
  const internalData = invoice?.internal_data || "";
  const signatureData = invoice?.signature_data || "";
  const receiptDate = invoice?.receipt_date || "";
  const taxType = invoice?.tax_type || "A";
  const vscuReceiptNo = invoice?.vscu_receipt_no || "";
  const taxRate = Number(settings.taxRate || 16);
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
    return `<tr><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${currency} ${i.price.toLocaleString()}</td><td>${currency} ${i.lineTotal.toLocaleString()}</td><td>${isTx ? currency + " " + vat.toLocaleString() : "Exempt"}</td><td style="font-size:0.75rem">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
  }).join("");
  const total = order.subtotal + (order.shippingFee || 0);
  const totalVat = order.items.reduce((s: number, i: any) => {
    return s + (i.taxable !== false ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0);
  }, 0);
  const qrData = JSON.stringify({ inv: etimsNumber, dc: controlCode, pin: kraPin, amt: total, dt: order.createdAt, ri: vscuReceiptNo });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
  const modeLabel = etimsMode === "vscu" ? "VSCU" : "OSCU";
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${store}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; }
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
    <div><h1>E-TIMS TAX INVOICE / RECEIPT</h1><p class="meta">Invoice #${order.id} | ${modeLabel} Receipt #${vscuReceiptNo}</p></div>
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
      <div>Mode: ${modeLabel}</div>
    </div>
  </div>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th>VAT</th><th>TT</th><th>Warranty</th></tr></thead><tbody>
    ${itemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div>Subtotal: ${currency} ${order.subtotal.toLocaleString()}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString()}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString()}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString()}</div>
  </div>
  ${internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — Payment via M-Pesa | ${escapeHtml(storeEmail)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <button class="print-btn" onclick="window.print()">Print</button>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>
</div>
</body></html>`);
});

app.post("/api/orders/invoice-token/:orderId", customerAuthMiddleware, (req: Request, res: Response) => {
  const order = getOrder(Number(req.params.orderId));
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }
  if (order.customerId !== (req as any).customer.sub) { res.status(403).json({ error: "Access denied." }); return; }
  const token = signToken({ sub: (req as any).customer.sub, role: "customer", orderId: Number(req.params.orderId), purpose: "invoice" }, "5m");
  res.json({ token });
});

app.get("/api/orders/:id/invoice", customerAuthMiddleware, (req: Request, res: Response) => {
  const order = getOrder(Number(req.params.id));
  if (!order || order.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Order not found." }); return; }
  if (order.status !== "shipped" && order.status !== "delivered") { res.status(400).json({ error: "Invoice is only available for shipped or delivered orders." }); return; }
  const settings = getSettings();
  const store = settings.storeName || "Gear&Glitch";
  const storeEmail = settings.email || "info@gearandglitch.com";
  const currency = settings.currency || "KES";
  const kraPin = (getDb().prepare("SELECT value FROM settings WHERE key = 'kra_pin'").get() as any)?.value || "P051234567Z";
  const etimsMode = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_mode'").get() as any)?.value || "vscu";
  const invoice = (getDb().prepare("SELECT * FROM order_invoices WHERE order_id = ?").get(order.id) as any);
  const etimsNumber = invoice?.etims_invoice_number || "";
  const controlCode = invoice?.control_code || "";
  const internalData = invoice?.internal_data || "";
  const signatureData = invoice?.signature_data || "";
  const receiptDate = invoice?.receipt_date || "";
  const taxType = invoice?.tax_type || "A";
  const vscuReceiptNo = invoice?.vscu_receipt_no || "";
  const taxRate = Number(settings.taxRate || 16);
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
    return `<tr><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${currency} ${i.price.toLocaleString()}</td><td>${currency} ${i.lineTotal.toLocaleString()}</td><td>${isTx ? currency + " " + vat.toLocaleString() : "Exempt"}</td><td style="font-size:0.75rem">${tt}</td><td style="font-size:0.85rem;">${warranty}</td></tr>`;
  }).join("");
  const total = order.subtotal + (order.shippingFee || 0);
  const totalVat = order.items.reduce((s: number, i: any) => {
    return s + (i.taxable !== false ? Math.round(i.lineTotal * taxRate / 116 * 100) / 100 : 0);
  }, 0);
  const qrData = JSON.stringify({ inv: etimsNumber, dc: controlCode, pin: kraPin, amt: total, dt: order.createdAt, ri: vscuReceiptNo });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
  const modeLabel = etimsMode === "vscu" ? "VSCU" : "OSCU";
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${order.id} — ${store}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 750px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  .invoice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 2rem; }
  .header { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .header h1 { margin: 0; font-size: 1.5rem; }
  .header .meta { font-size: 0.9rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; }
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
    <div><h1>E-TIMS TAX INVOICE / RECEIPT</h1><p class="meta">Invoice #${order.id} | ${modeLabel} Receipt #${vscuReceiptNo}</p></div>
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
      <div>Mode: ${modeLabel}</div>
    </div>
  </div>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th>VAT</th><th>TT</th><th>Warranty</th></tr></thead><tbody>
    ${itemsHtml}
  </tbody></table>
  <div style="text-align:right;">
    <div>Subtotal: ${currency} ${order.subtotal.toLocaleString()}</div>
    <div>Shipping: ${currency} ${(order.shippingFee || 0).toLocaleString()}</div>
    <div>VAT (${taxRate}%): ${currency} ${totalVat.toLocaleString()}</div>
    <div class="total-row">Total incl. VAT: ${currency} ${total.toLocaleString()}</div>
  </div>
  ${internalData ? `<div class="vscu-data"><strong>Internal Data:</strong> ${escapeHtml(internalData)}<br><strong>Signature Data:</strong> ${escapeHtml(signatureData)}</div>` : ""}
  ${order.notes ? `<p style="margin-top:1rem;font-size:0.9rem;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;">
    <div style="font-size:0.85rem;color:#6b7280;">${escapeHtml(store)} — Payment via M-Pesa | ${escapeHtml(storeEmail)}</div>
    ${qrUrl ? `<img src="${qrUrl}" alt="eTIMS QR Code" style="width:100px;height:100px;" />` : ""}
  </div>
  <button class="print-btn" onclick="window.print()">Print</button>
  <div class="footer">eTIMS-compliant invoice (${modeLabel}) — Verify at https://itax.kra.go.ke</div>
</div>
</body></html>`);
});

function escapeHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ============ PRODUCT ANALYTICS ============

app.post("/api/products/:id/view", (req: Request, res: Response) => {
  recordProductView(String(req.params.id), req.body?.viewerType || "anonymous");
  res.json({ ok: true });
});

app.get("/api/admin/stats/popular", adminAuthMiddleware, (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  res.json({ products: getPopularProducts(limit), totalViews: getTotalViews() });
});

// ============ INVOICES ============

app.get("/api/provider/invoices", providerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ invoices: listInvoices((req as any).provider.sub) });
});

app.get("/api/admin/invoices", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ invoices: listInvoices(), revenue: getInvoiceRevenue() });
});

app.post("/api/admin/invoices/generate", adminAuthMiddleware, (req: Request, res: Response) => {
  const { providerId } = req.body || {};
  if (!providerId) { res.status(400).json({ error: "Provider ID is required." }); return; }
  const invoice = generateProviderInvoice(Number(providerId));
  if (!invoice) { res.status(400).json({ error: "Could not generate invoice. Provider may have no active plan or plan is free." }); return; }
  res.status(201).json(invoice);
});

app.post("/api/admin/invoices/:id/pay", adminAuthMiddleware, (req: Request, res: Response) => {
  const ok = markInvoicePaid(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Invoice not found." }); return; }
  res.json({ ok: true });
});

// ============ ORDER INVOICES ============

app.get("/api/admin/order-invoices", ownerAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ invoices: listOrderInvoices() });
});

app.post("/api/admin/order-invoices/:id/pay", ownerAuthMiddleware, (req: Request, res: Response) => {
  const ok = markOrderInvoicePaid(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Invoice not found." }); return; }
  res.json({ ok: true });
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
    ${inv.items.map(i => `<tr><td>${i.desc}</td><td>${i.qty}</td><td>KES ${i.price.toLocaleString()}</td><td>KES ${(i.price * i.qty).toLocaleString()}</td></tr>`).join("")}
  </tbody></table>
  <div class="total">Total: KES ${inv.amount.toLocaleString()}</div>
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

app.get("/api/messages", customerAuthMiddleware, (req: Request, res: Response) => {
  const customerId = (req as any).customer.sub;
  res.json({ messages: getMessagesForCustomer(customerId) });
});

app.get("/api/provider/messages", providerAuthMiddleware, requireProviderFeature("Customer management"), (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  res.json({ messages: getMessagesForProvider(providerId), unreadCount: getUnreadMessageCount(providerId) });
});

app.post("/api/messages", customerAuthMiddleware, (req: Request, res: Response) => {
  const customerId = (req as any).customer.sub;
  const { providerId, productId, subject, body } = req.body || {};
  if (!providerId || !body) { res.status(400).json({ error: "Provider ID and message body are required." }); return; }
  const msg = sendMessage({ customerId, providerId, productId, subject, body, senderRole: "customer" });
  res.status(201).json(msg);
});

app.post("/api/provider/messages", providerAuthMiddleware, requireProviderFeature("Customer management"), (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  const { customerId, productId, subject, body } = req.body || {};
  if (!customerId || !body) { res.status(400).json({ error: "Customer ID and message body are required." }); return; }
  const msg = sendMessage({ customerId, providerId, productId, subject, body, senderRole: "provider" });
  res.status(201).json(msg);
});

app.patch("/api/messages/:id/read", customerAuthMiddleware, (req: Request, res: Response) => {
  const ok = markMessageRead(Number(req.params.id));
  res.json({ ok });
});

app.get("/api/messages/providers", customerAuthMiddleware, (_req: Request, res: Response) => {
  // Return list of providers for customer to pick when sending a message
  const providers = getDb().prepare("SELECT id, company_name, contact_name, email FROM providers WHERE status != 'disabled'").all();
  res.json({ providers });
});

app.get("/api/provider/messages/customers", providerAuthMiddleware, requireProviderFeature("Customer management"), (req: Request, res: Response) => {
  const providerId = (req as any).provider.sub;
  const customers = getDb().prepare(`
    SELECT DISTINCT c.id, c.name, c.email FROM customers c
    JOIN messages m ON m.customer_id = c.id
    WHERE m.provider_id = ?
  `).all(providerId);
  res.json({ customers });
});

app.get("/api/customers/search", adminAuthMiddleware, (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (!q) { res.json({ customers: [] }); return; }
  const escaped = q.replace(/[%_]/g, "\\$&");
  const customers = getDb().prepare(
    "SELECT id, name, email FROM customers WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' LIMIT 20"
  ).all(`%${escaped}%`, `%${escaped}%`);
  res.json({ customers });
});

app.get("/api/categories", (_req: Request, res: Response) => {
  const categories = listCategories();
  const subcategories = listSubcategories();
  res.json({ categories, subcategories });
});

app.post("/api/categories", adminAuthMiddleware, (req: Request, res: Response) => {
  const { id, label, group } = req.body || {};
  if (!id || !label) {
    res.status(400).json({ error: "Category id and label are required." });
    return;
  }
  if (getCategory(id)) {
    res.status(409).json({ error: "Category already exists." });
    return;
  }
  const category = createCategory({
    id: String(id).trim(),
    label: String(label).trim(),
    group: String(group || "").trim(),
  });
  res.status(201).json({ category });
});

app.put("/api/categories/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const { label, group } = req.body || {};
  const category = updateCategory(String(req.params.id), {
    label: String(label || "").trim(),
    group: String(group || "").trim(),
  });
  if (!category) { res.status(404).json({ error: "Category not found." }); return; }
  res.json({ category });
});

app.delete("/api/categories/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const removed = deleteCategory(String(req.params.id));
  if (!removed) { res.status(404).json({ error: "Category not found." }); return; }
  res.status(204).end();
});

// ============ SUBCATEGORIES ============

app.get("/api/subcategories", (_req: Request, res: Response) => {
  res.json({ subcategories: listSubcategories() });
});

app.get("/api/categories/:id/subcategories", (req: Request, res: Response) => {
  res.json({ subcategories: getSubcategoriesForCategory(String(req.params.id)) });
});

app.post("/api/subcategories", adminAuthMiddleware, (req: Request, res: Response) => {
  const { id, name, category_ids } = req.body || {};
  if (!id || !name) {
    res.status(400).json({ error: "Subcategory id and name are required." });
    return;
  }
  if (getSubcategory(id)) {
    res.status(409).json({ error: "Subcategory already exists." });
    return;
  }
  const sub = createSubcategory({
    id: String(id).trim(),
    name: String(name).trim(),
    category_ids: category_ids || [],
  });
  res.status(201).json({ subcategory: sub });
});

app.put("/api/subcategories/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const { name, category_ids } = req.body || {};
  const sub = updateSubcategory(String(req.params.id), {
    name: name !== undefined ? String(name).trim() : undefined,
    category_ids: category_ids !== undefined ? category_ids : undefined,
  });
  if (!sub) { res.status(404).json({ error: "Subcategory not found." }); return; }
  res.json({ subcategory: sub });
});

app.delete("/api/subcategories/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const removed = deleteSubcategory(String(req.params.id));
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

app.get("/api/products", (_req: Request, res: Response) => {
  const products = listProducts();
  res.json({ products, currency: getSettings().currency });
});

app.get("/api/products/:id", (req: Request, res: Response) => {
  const product = getProduct(String(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  recordProductView(String(req.params.id), "anonymous");
  res.json(product);
});

app.post("/api/products", ownerAuthMiddleware, requirePermission("product:create"), (req: Request, res: Response) => {
  const body = req.body || {};
  const category = body.category;
  if (category && !getCategory(category)) {
    res.status(400).json({ error: "Choose a valid category." });
    return;
  }
  const name = String(body.name || "").trim();
  if (!name) { res.status(400).json({ error: "Product name cannot be empty." }); return; }

  const product = createProduct({
    id: generateProductId(name),
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

app.post("/api/products/import", ownerAuthMiddleware, (req: Request, res: Response) => {
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
      createProduct({
        id: generateProductId(row.name),
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

app.post("/api/admin/products/bulk-edit", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { productIds, updates } = req.body || {};
  if (!Array.isArray(productIds) || productIds.length === 0 || !updates) {
    res.status(400).json({ error: "productIds array and updates object are required." }); return;
  }
  const updated: string[] = [];
  const notFound: string[] = [];
  for (const id of productIds) {
    const p = getProduct(id);
    if (!p) { notFound.push(id); continue; }
    const change: any = {};
    if (updates.price !== undefined) change.price = Number(updates.price);
    if (updates.inStock !== undefined) change.inStock = Boolean(updates.inStock);
    if (updates.category !== undefined) change.category = String(updates.category).trim();
    if (updates.isNonStock !== undefined) change.isNonStock = Boolean(updates.isNonStock);
    if (updates.taxable !== undefined) change.taxable = Boolean(updates.taxable);
    updateProduct(id, change);
    updated.push(id);
  }
  res.json({ updated: updated.length, notFound });
});

app.get("/api/admin/products/:id/price-history", ownerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ history: getPriceHistory(String(req.params.id)) });
});

app.get("/api/admin/backup", ownerAuthMiddleware, (_req: Request, res: Response) => {
  const dbPath = path.join(__dirname, "../data/store.db");
  if (!fs.existsSync(dbPath)) { res.status(404).json({ error: "Database file not found." }); return; }
  const data = fs.readFileSync(dbPath);
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="store-backup-${date}.db"`);
  res.send(data);
});

app.put("/api/products/:id", ownerAuthMiddleware, requirePermission("product:update"), (req: Request, res: Response) => {
  const existing = getProduct(String(req.params.id));
  if (!existing) { res.status(404).json({ error: "Product not found." }); return; }

  const body = req.body || {};
  if (body.category !== undefined && body.category && !getCategory(body.category)) {
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
  if (body.specs !== undefined) updates.specs = normalizeSpecs(body.specs);
  if (body.inStock !== undefined) updates.inStock = Boolean(body.inStock);
  if (body.isNonStock !== undefined) updates.isNonStock = Boolean(body.isNonStock);
  if (body.imageAlt !== undefined) updates.imageAlt = String(body.imageAlt).trim();

  const product = updateProduct(String(req.params.id), updates);
  res.json(product);
});

app.post("/api/products/:id/image", ownerAuthMiddleware, requirePermission("product:update"), (req: Request, res: Response) => {
  const product = getProduct(String(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }

  uploadProductImage(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: "Upload failed." }); return; }
    if (!req.file) { res.status(400).json({ error: "No image file provided." }); return; }

    const imageUrl = imageUrlForProduct(String(req.params.id));
    const updated = setProductImageUrl(String(req.params.id), imageUrl);
    // Also save to product_images gallery
    const existing = getProductImages(String(req.params.id));
    if (!existing.find(i => i.image_url === imageUrl)) {
      addProductImage(String(req.params.id), imageUrl, -1);
    }
    res.json(updated);
  });
});

// Gallery images
app.get("/api/products/:id/images", (req: Request, res: Response) => {
  const product = getProduct(String(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  const images = getProductImages(String(req.params.id));
  const combined = [];
  if (product.imageUrl) combined.push({ id: 0, product_id: product.id, image_url: product.imageUrl, sort_order: -1, is_primary: 1, created_at: "" });
  for (const img of images) {
    if (img.image_url !== product.imageUrl) combined.push(img);
  }
  res.json({ images: combined });
});

// ============ PRODUCT REVIEWS ============

app.get("/api/products/:id/reviews", (req: Request, res: Response) => {
  res.json({ reviews: getProductReviews(String(req.params.id)), rating: getProductRating(String(req.params.id)) });
});

app.get("/api/products/:id/reviews/check", customerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ hasReviewed: hasCustomerReviewed(String(req.params.id), (req as any).customer.sub) });
});

app.post("/api/products/:id/reviews", customerAuthMiddleware, (req: Request, res: Response) => {
  const productId = String(req.params.id);
  const customerId = (req as any).customer.sub;
  if (hasCustomerReviewed(productId, customerId)) { res.status(400).json({ error: "You have already reviewed this product." }); return; }
  const { rating, title, comment } = req.body || {};
  if (!rating || rating < 1 || rating > 5) { res.status(400).json({ error: "Rating must be between 1 and 5." }); return; }
  const review = createReview(productId, customerId, Number(rating), String(title || "").trim(), String(comment || "").trim());
  res.status(201).json(review);
});

app.post("/api/products/:id/images", ownerAuthMiddleware, requirePermission("product:update"), (req: Request, res: Response) => {
  const product = getProduct(String(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  uploadGalleryImage(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: "Upload failed." }); return; }
    if (!req.file) { res.status(400).json({ error: "No image file provided." }); return; }
    const imageUrl = `/uploads/${(req.file as any).filename}`;
    const img = addProductImage(String(req.params.id), imageUrl);
    res.json(img);
  });
});

app.delete("/api/products/:id/images/:imageId", ownerAuthMiddleware, requirePermission("product:update"), (req: Request, res: Response) => {
  const ok = deleteProductImage(Number(req.params.imageId));
  if (!ok) { res.status(404).json({ error: "Image not found." }); return; }
  res.json({ ok: true });
});

app.put("/api/products/:id/images/reorder", adminAuthMiddleware, (req: Request, res: Response) => {
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds)) { res.status(400).json({ error: "orderedIds array required." }); return; }
  orderedIds.forEach((id: number, idx: number) => setProductImageOrder(id, idx));
  res.json({ ok: true });
});

app.put("/api/products/:id/images/:imageId/primary", adminAuthMiddleware, (req: Request, res: Response) => {
  setPrimaryImage(String(req.params.id), Number(req.params.imageId));
  const img = getProductImages(String(req.params.id)).find(i => i.id === Number(req.params.imageId));
  if (img) setProductImageUrl(String(req.params.id), img.image_url);
  res.json({ ok: true });
});

app.patch("/api/products/:id/price", adminAuthMiddleware, (req: Request, res: Response) => {
  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "Price must be a positive number." });
    return;
  }
  const product = updateProduct(String(req.params.id), { price });
  if (!product) { res.status(404).json({ error: "Product not found." }); return; }
  res.json(product);
});

app.delete("/api/products/:id", ownerAuthMiddleware, requirePermission("product:delete"), (req: Request, res: Response) => {
  const removed = deleteProduct(String(req.params.id));
  if (!removed) { res.status(404).json({ error: "Product not found." }); return; }
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

app.get("/api/customer/me", customerAuthMiddleware, (req: Request, res: Response) => {
  const customer = findCustomerById((req as any).customer.sub);
  if (!customer) { res.status(404).json({ error: "Customer not found." }); return; }
  res.json(customer);
});

app.put("/api/customer/me", customerAuthMiddleware, (req: Request, res: Response) => {
  const customerId = (req as any).customer.sub;
  const { name, phone } = req.body || {};
  const ok = updateCustomer(customerId, { name, phone });
  if (!ok) { res.status(400).json({ error: "No fields to update." }); return; }
  res.json({ ok: true, customer: findCustomerById(customerId) });
});

app.post("/api/customer/change-password", customerAuthMiddleware, async (req: Request, res: Response) => {
  const customerId = (req as any).customer.sub;
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "Current and new passwords are required." }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  const row = getDb().prepare("SELECT password_hash FROM customers WHERE id = ?").get(customerId) as { password_hash: string } | undefined;
  if (!row) { res.status(404).json({ error: "Customer not found." }); return; }
  const match = await bcrypt.compare(currentPassword, row.password_hash);
  if (!match) { res.status(403).json({ error: "Current password is incorrect." }); return; }
  const success = changeCustomerPassword(customerId, newPassword);
  if (!success) { res.status(500).json({ error: "Failed to change password." }); return; }
  res.json({ ok: true });
});

// ============ LOYALTY POINTS ============

app.get("/api/loyalty/points", customerAuthMiddleware, (req: Request, res: Response) => {
  res.json(getLoyaltyPoints((req as any).customer.sub));
});

app.get("/api/loyalty/transactions", customerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ transactions: getLoyaltyTransactions((req as any).customer.sub) });
});

app.post("/api/loyalty/redeem", customerAuthMiddleware, (req: Request, res: Response) => {
  const { points } = req.body || {};
  if (!points || points < 1) { res.status(400).json({ error: "Points must be at least 1." }); return; }
  const discount = redeemLoyaltyPoints((req as any).customer.sub, points, "checkout", "pending");
  if (!discount) { res.status(400).json({ error: "Not enough points or invalid request." }); return; }
  res.json({ discount, pointsRedeemed: points });
});

app.get("/api/admin/loyalty/customers", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ customers: listAllLoyaltyCustomers() });
});

app.post("/api/auth/magic-request", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) { res.status(400).json({ error: "Email is required." }); return; }
  const customer = findCustomerByEmail(email);
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
  const staff = findStaffByEmail(email);
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
    const staff = findStaffById(payload.sub);
    if (!staff) { res.status(404).json({ error: "User not found." }); return; }
    changeStaffPassword(payload.sub, newPassword);
    res.json({ ok: true });
  } catch (_err) {
    res.status(400).json({ error: "Invalid or expired token." });
  }
});

app.post("/api/auth/google-admin-login", async (req: Request, res: Response) => {
  const googleToken = String(req.body?.credential || "");
  if (!googleToken) { res.status(400).json({ error: "Google credential is required." }); return; }
  try {
    const clientId = getStoreSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID || "";
    if (!clientId) { res.status(400).json({ error: "Google login is not configured." }); return; }
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: googleToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) { res.status(400).json({ error: "Google login failed." }); return; }
    const email = payload.email.toLowerCase();
    const staff = findStaffByEmail(email);
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
  const customer = findCustomerByEmail(email);
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

  const userWithHash = getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get((req as any).user.sub) as any;
  const match = await bcrypt.compare(currentPassword, userWithHash.password_hash);
  if (!match) { res.status(401).json({ error: "Current password is incorrect." }); return; }

  changeStaffPassword((req as any).user.sub, newPassword);
  res.json({ ok: true, message: "Password changed successfully." });
});

app.get("/api/staff", adminAuthMiddleware, requirePermission("staff:list"), (_req: Request, res: Response) => {
  res.json({ staff: listStaff() });
});

app.post("/api/staff", adminAuthMiddleware, requirePermission("staff:create"), (req: Request, res: Response) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const role = req.body?.role || "technician";

  if (!username) { res.status(400).json({ error: "Username is required." }); return; }
  if (!password || password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  if (!["admin", "owner", "technician"].includes(role)) { res.status(400).json({ error: "Invalid role." }); return; }

  const result = createStaff(username, password, role);
  if (!result.ok) { res.status(409).json({ error: result.error }); return; }
  res.status(201).json(result.staff);
});

app.patch("/api/staff/:id", adminAuthMiddleware, requirePermission("staff:update"), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { username, email } = req.body || {};
  if (username !== undefined && (!username || !String(username).trim())) {
    res.status(400).json({ error: "Username cannot be empty." }); return;
  }
  const staff = updateStaffDetails(id, { username: username?.trim(), email });
  if (!staff) { res.status(404).json({ error: "Staff member not found." }); return; }
  res.json(staff);
});

app.patch("/api/staff/:id/role", adminAuthMiddleware, requirePermission("staff:update"), (req: Request, res: Response) => {
  const newRole = req.body?.role;
  if (!["admin", "owner", "technician"].includes(newRole)) { res.status(400).json({ error: "Invalid role." }); return; }
  const staff = updateStaffRole(Number(req.params.id), newRole);
  if (!staff) { res.status(404).json({ error: "Staff member not found." }); return; }
  res.json(staff);
});

app.post("/api/staff/:id/reset-password", adminAuthMiddleware, (req: Request, res: Response) => {
  const newPassword = String(req.body?.password || "");
  if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  const success = changeStaffPassword(Number(req.params.id), newPassword);
  if (!success) { res.status(404).json({ error: "Staff member not found." }); return; }
  res.json({ ok: true, message: "Password reset successfully." });
});

app.delete("/api/staff/:id", adminAuthMiddleware, requirePermission("staff:delete"), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (id === (req as any).user.sub) { res.status(400).json({ error: "Cannot delete your own account." }); return; }
  const success = deleteStaff(id);
  if (!success) { res.status(404).json({ error: "Staff member not found." }); return; }
  res.status(204).end();
});

// ============ PERMISSIONS & ROLES ============

app.get("/api/permissions", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ permissions: getAllPermissions() });
});

app.get("/api/roles", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ roles: listRoles(getDb()) });
});

app.get("/api/roles/:roleId", adminAuthMiddleware, (req: Request, res: Response) => {
  const role = getRole(getDb(), String(req.params.roleId));
  if (!role) { res.status(404).json({ error: "Role not found." }); return; }
  res.json({ role });
});

app.post("/api/roles", adminAuthMiddleware, (req: Request, res: Response) => {
  const { roleId, name, description, permissions } = req.body || {};
  if (!roleId || !name) {
    res.status(400).json({ error: "Role ID and name are required." });
    return;
  }
  const role = createRole(getDb(), roleId, name, description, permissions);
  res.status(201).json({ role });
});

app.put("/api/roles/:roleId", adminAuthMiddleware, (req: Request, res: Response) => {
  const role = updateRole(getDb(), String(req.params.roleId), req.body || {});
  if (!role) { res.status(404).json({ error: "Role not found or cannot be modified." }); return; }
  res.json({ role });
});

app.delete("/api/roles/:roleId", adminAuthMiddleware, (req: Request, res: Response) => {
  if (["admin", "technician", "manager"].includes(String(req.params.roleId))) {
    res.status(400).json({ error: "Cannot delete default roles." });
    return;
  }
  const success = deleteRole(getDb(), String(req.params.roleId));
  if (!success) { res.status(404).json({ error: "Role not found." }); return; }
  res.status(204).end();
});

app.get("/api/staff/:id/roles", adminAuthMiddleware, (req: Request, res: Response) => {
  const roles = getUserRoles(getDb(), Number(req.params.id));
  res.json({ roles });
});

app.post("/api/staff/:id/roles/:roleId", adminAuthMiddleware, (req: Request, res: Response) => {
  const success = assignRoleToUser(getDb(), Number(req.params.id), String(req.params.roleId));
  if (!success) { res.status(400).json({ error: "Failed to assign role." }); return; }
  res.json({ ok: true });
});

app.delete("/api/staff/:id/roles/:roleId", adminAuthMiddleware, (req: Request, res: Response) => {
  const success = removeRoleFromUser(getDb(), Number(req.params.id), String(req.params.roleId));
  if (!success) { res.status(404).json({ error: "Role not assigned to user." }); return; }
  res.status(204).end();
});

app.get("/api/staff/:id/permissions", adminAuthMiddleware, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const effective = getUserPermissions(getDb(), id);
  const direct = getUserDirectPermissions(getDb(), id);
  res.json({ effective, direct });
});

app.put("/api/staff/:id/permissions", adminAuthMiddleware, (req: Request, res: Response) => {
  const perms: string[] = req.body?.permissions || [];
  setUserDirectPermissions(getDb(), Number(req.params.id), perms);
  const effective = getUserPermissions(getDb(), Number(req.params.id));
  res.json({ ok: true, effective, direct: perms });
});

// ============ STOCK ============

app.get("/api/stock/low-items", ownerAuthMiddleware, requirePermission("stock:view_low"), (req: Request, res: Response) => {
  const threshold = req.query.threshold ? Number(req.query.threshold) : null;
  const items = getLowStockItems(threshold);
  res.json({ items });
});

app.get("/api/stock", ownerAuthMiddleware, requirePermission("stock:list"), (_req: Request, res: Response) => {
  const products = listProducts();
  const stock = products.map((p) => getStockLevel(p.id));
  res.json({ stock });
});

app.get("/api/stock/:productId", ownerAuthMiddleware, requirePermission("stock:list"), (req: Request, res: Response) => {
  const stock = getStockLevel(String(req.params.productId));
  res.json(stock);
});

app.put("/api/stock/:productId", ownerAuthMiddleware, requirePermission("stock:update"), (req: Request, res: Response) => {
  const updates: any = {};
  if (req.body.quantityInStock !== undefined) updates.quantityInStock = Number(req.body.quantityInStock);
  if (req.body.lowStockThreshold !== undefined) updates.lowStockThreshold = Number(req.body.lowStockThreshold);
  const stock = updateStockLevel(String(req.params.productId), updates);
  res.json(stock);
});

app.get("/api/stock/:productId/movements", adminAuthMiddleware, (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const movements = getStockMovements(String(req.params.productId), limit);
  res.json({ movements });
});

// ============ STOCK TRANSFERS ============

app.get("/api/stock-transfers", adminAuthMiddleware, requirePermission("stock:transfer"), (_req: Request, res: Response) => {
  const status = _req.query.status as string | undefined;
  res.json({ transfers: listStockTransfers(status) });
});

app.post("/api/stock-transfers", adminAuthMiddleware, requirePermission("stock:transfer"), (req: Request, res: Response) => {
  const { fromBranchId, toBranchId, productId, quantity, notes } = req.body || {};
  if (!fromBranchId || !toBranchId || !productId || !quantity) {
    res.status(400).json({ error: "From branch, to branch, product ID, and quantity are required." }); return;
  }
  if (fromBranchId === toBranchId) {
    res.status(400).json({ error: "Source and destination branches must be different." }); return;
  }
  const transfer = createStockTransfer(fromBranchId, toBranchId, productId, quantity, notes, (req as any).user?.sub);
  if (!transfer) { res.status(400).json({ error: "Failed to create transfer." }); return; }
  res.status(201).json({ transfer });
});

app.post("/api/stock-transfers/:id/complete", adminAuthMiddleware, requirePermission("stock:transfer"), (req: Request, res: Response) => {
  const transfer = completeStockTransfer(Number(req.params.id));
  if (!transfer) { res.status(400).json({ error: "Transfer not found or already completed." }); return; }
  res.json({ transfer });
});

app.post("/api/stock-transfers/:id/reject", adminAuthMiddleware, requirePermission("stock:transfer"), (req: Request, res: Response) => {
  const transfer = rejectStockTransfer(Number(req.params.id));
  if (!transfer) { res.status(400).json({ error: "Transfer not found or already completed." }); return; }
  res.json({ transfer });
});

// ============ CART ============

app.get("/api/cart", customerAuthMiddleware, (req: Request, res: Response) => {
  const items = getCartItems((req as any).customer.sub);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const currency = getSettings().currency;
  res.json({ items, subtotal, currency });
});

app.post("/api/cart", customerAuthMiddleware, (req: Request, res: Response) => {
  const { productId, quantity } = req.body || {};
  if (!productId) { res.status(400).json({ error: "Product ID is required." }); return; }
  const result = addToCart((req as any).customer.sub, productId, Number(quantity) || 1);
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.json({ ok: true });
});

app.get("/api/cart/count", customerAuthMiddleware, (req: Request, res: Response) => {
  const count = getCartCount((req as any).customer.sub);
  res.json({ count });
});

app.patch("/api/cart/:productId", customerAuthMiddleware, (req: Request, res: Response) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: "Quantity must be a positive integer." });
    return;
  }
  setCartQuantity((req as any).customer.sub, String(req.params.productId), quantity);
  res.json({ ok: true });
});

app.delete("/api/cart/:productId", customerAuthMiddleware, (req: Request, res: Response) => {
  removeFromCart((req as any).customer.sub, String(req.params.productId));
  res.json({ ok: true });
});

app.delete("/api/cart", customerAuthMiddleware, (req: Request, res: Response) => {
  clearCart((req as any).customer.sub);
  res.json({ ok: true });
});

// ============ REPAIRS ============

app.get("/api/staff/technicians", staffAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ staff: listStaff() });
});

app.get("/api/backoffice/stats", staffAuthMiddleware, (_req: Request, res: Response) => {
  res.json(getDashboardStats());
});

app.get("/api/repairs/types", (_req: Request, res: Response) => {
  res.json({ types: listRepairTypes() });
});

app.get("/api/repairs/statuses", (_req: Request, res: Response) => {
  res.json({ statuses: STATUS_LABELS });
});

app.post("/api/repairs", customerAuthMiddleware, (req: Request, res: Response) => {
  const result = createRepairTicket((req as any).customer.sub, req.body || {});
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  try { notifier.sendNewRepairEmail(result.ticket!).catch(() => {}); } catch (_e) { /* ignore */ }
  res.status(201).json(result.ticket);
});

app.get("/api/repairs/mine", customerAuthMiddleware, (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
  const status = req.query.status as string | undefined;

  if (page || pageSize || status) {
    const p = listRepairsForCustomerPaged((req as any).customer.sub, { status, page: page || 1, pageSize: pageSize || 10 });
    res.json(p);
    return;
  }

  res.json({ tickets: listRepairsForCustomer((req as any).customer.sub) });
});

app.get("/api/repairs/mine/:id", customerAuthMiddleware, (req: Request, res: Response) => {
  const ticket = loadTicketDetails(String(req.params.id));
  if (!ticket || ticket.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Ticket not found." }); return; }
  const visibleUpdates = ticket.updates.filter((u) => u.customerVisible);
  res.json({ ...ticket, updates: visibleUpdates, workNotes: undefined });
});

app.post("/api/repairs/mine/:id/message", customerAuthMiddleware, (req: Request, res: Response) => {
  const ticket = loadTicketDetails(String(req.params.id));
  if (!ticket || ticket.customerId !== (req as any).customer.sub) { res.status(404).json({ error: "Ticket not found." }); return; }
  const { message } = req.body || {};
  if (!message || !String(message).trim()) { res.status(400).json({ error: "Message is required." }); return; }
  addRepairUpdate(String(req.params.id), null, "customer_note", String(message).trim(), true);
  res.status(201).json({ ok: true });
});

app.get("/api/repairs", staffAuthMiddleware, (req: Request, res: Response) => {
  const tickets = listRepairsForStaff({
    status: req.query.status as string || undefined,
    assignedTo: req.query.assignedTo ? Number(req.query.assignedTo) : undefined,
  });
  res.json({ tickets });
});

app.get("/api/repairs/calendar", staffAuthMiddleware, (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = req.query.to as string;
  if (!to) { res.status(400).json({ error: "Query param 'to' is required (ISO date)." }); return; }
  const cal = listCalendarRepairs(from, to);
  res.json({ tickets: cal });
});

app.get("/api/repairs/:id", staffAuthMiddleware, (req: Request, res: Response) => {
  const ticket = loadTicketDetails(String(req.params.id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found." }); return; }
  res.json(ticket);
});

app.patch("/api/repairs/:id", staffAuthMiddleware, (req: Request, res: Response) => {
  const result = updateRepairTicket(String(req.params.id), req.body || {}, (req as any).user.sub);
  if (!result) { res.status(404).json({ error: "Ticket not found." }); return; }
  if ((result as any).error) { res.status(400).json({ error: (result as any).error }); return; }
  res.json(result);
});

app.post("/api/repairs/:id/parts", staffAuthMiddleware, (req: Request, res: Response) => {
  const result = addRepairPart(String(req.params.id), req.body || {});
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.status(201).json(result.part);
});

app.delete("/api/repairs/:id/parts/:partId", staffAuthMiddleware, (req: Request, res: Response) => {
  const removed = removeRepairPart(String(req.params.id), Number(req.params.partId));
  if (!removed) { res.status(404).json({ error: "Part not found." }); return; }
  res.status(204).end();
});

app.post("/api/repairs/:id/updates", staffAuthMiddleware, (req: Request, res: Response) => {
  const { message, customerVisible } = req.body || {};
  if (!message || !String(message).trim()) {
    res.status(400).json({ error: "Message is required." });
    return;
  }
  addRepairUpdate(String(req.params.id), (req as any).user.sub, "note", String(message).trim(), Boolean(customerVisible));
  res.status(201).json({ ok: true });
});

// ============ REPAIR IMAGES ============
app.get("/api/repairs/:id/images", staffAuthMiddleware, (req: Request, res: Response) => {
  res.json({ images: getRepairImages(String(req.params.id)) });
});

app.post("/api/repairs/:id/images", staffAuthMiddleware, (req: Request, res: Response) => {
  uploadRepairImage(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    if (!req.file) { res.status(400).json({ error: "No image uploaded." }); return; }
    const imageType = String(req.body.imageType || "before").toLowerCase();
    if (!["before", "after"].includes(imageType)) { res.status(400).json({ error: "imageType must be 'before' or 'after'." }); return; }
    const imageUrl = `/uploads/${req.file.filename}`;
    const image = addRepairImage(String(req.params.id), imageUrl, imageType as "before" | "after", (req as any).user.sub);
    res.status(201).json(image);
  });
});

app.delete("/api/repairs/:id/images/:imageId", staffAuthMiddleware, (req: Request, res: Response) => {
  const removed = deleteRepairImage(Number(req.params.imageId));
  if (!removed) { res.status(404).json({ error: "Image not found." }); return; }
  res.status(204).end();
});

app.post("/api/repairs/:id/send-quote", staffAuthMiddleware, (req: Request, res: Response) => {
  const ok = sendRepairQuote(String(req.params.id));
  if (!ok) { res.status(404).json({ error: "Ticket not found." }); return; }
  res.json({ ok: true });
});

app.post("/api/repairs/:id/quote-response", customerAuthMiddleware, (req: Request, res: Response) => {
  const { response } = req.body || {};
  if (response !== "accepted" && response !== "declined") {
    res.status(400).json({ error: "Response must be 'accepted' or 'declined'." }); return;
  }
  const ticket = loadTicketDetails(String(req.params.id));
  if (!ticket || ticket.customerId !== (req as any).customer.sub) {
    res.status(404).json({ error: "Ticket not found." }); return;
  }
  const ok = respondToRepairQuote(String(req.params.id), response);
  if (!ok) { res.status(400).json({ error: "No quote to respond to." }); return; }
  res.json({ ok: true });
});

// ============ PURCHASE ORDERS ============
app.get("/api/purchases", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ orders: listPurchaseOrders() });
});

app.post("/api/purchases", adminAuthMiddleware, (req: Request, res: Response) => {
  const po = createPurchaseOrder({ ...req.body, createdBy: (req as any).user.sub });
  if (!po) { res.status(400).json({ error: "Could not create purchase order." }); return; }
  res.status(201).json(po);
});

app.get("/api/purchases/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const po = getPurchaseOrder(Number(req.params.id));
  if (!po) { res.status(404).json({ error: "Purchase order not found." }); return; }
  res.json(po);
});

app.patch("/api/purchases/:id/status", adminAuthMiddleware, (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["pending", "ordered", "received", "cancelled"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }
  updatePurchaseOrderStatus(Number(req.params.id), status);
  res.json({ ok: true });
});

app.post("/api/purchases/:id/items", adminAuthMiddleware, (req: Request, res: Response) => {
  const item = addPurchaseOrderItem(Number(req.params.id), req.body);
  if (!item) { res.status(400).json({ error: "Could not add item." }); return; }
  res.status(201).json(item);
});

app.post("/api/admin/auto-reorder", adminAuthMiddleware, (_req: Request, res: Response) => {
  const result = autoReorderLowStock();
  res.json(result);
});

app.post("/api/purchases/items/:itemId/receive", adminAuthMiddleware, (req: Request, res: Response) => {
  const { quantityReceived } = req.body || {};
  if (!quantityReceived || quantityReceived < 1) { res.status(400).json({ error: "quantityReceived is required." }); return; }
  const ok = receivePurchaseOrderItem(Number(req.params.itemId), Number(quantityReceived));
  if (!ok) { res.status(404).json({ error: "Item not found." }); return; }
  res.json({ ok: true });
});

// ============ REPORTS ============
app.get("/api/reports/tech-performance", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ technicians: getTechPerformanceReport() });
});

app.get("/api/reports/purchases", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json(getPurchaseReport());
});

// ============ ADMIN CREATE PROVIDER ============
app.post("/api/admin/providers", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { companyName, contactName, email, password, phone } = req.body || {};
  if (!companyName || !contactName || !email || !password) { res.status(400).json({ error: "companyName, contactName, email, password are required." }); return; }
  const existing = findProviderByEmail(email);
  if (existing) { res.status(400).json({ error: "Provider with this email already exists." }); return; }
  const provider = createProvider(companyName, contactName, email, password, phone || "");
  if (!provider) { res.status(400).json({ error: "Could not create provider." }); return; }
  // Assign starter plan by default
  const starter = getSubscriptionPlan("starter");
  if (starter) assignPlanToProvider(provider.id, starter.id, { createdBy: (req as any).user.sub, startDate: new Date().toISOString().slice(0, 10) });
  res.status(201).json(provider);
});

// ============ WISHLIST ============
app.get("/api/wishlist", customerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ items: getWishlist((req as any).customer.sub) });
});

app.post("/api/wishlist", customerAuthMiddleware, (req: Request, res: Response) => {
  const { productId, notes } = req.body || {};
  if (!productId) { res.status(400).json({ error: "productId is required." }); return; }
  const result = addToWishlist((req as any).customer.sub, productId, notes);
  if (!result.ok) { res.status(400).json(result); return; }
  res.status(201).json({ ok: true });
});

app.delete("/api/wishlist/:productId", customerAuthMiddleware, (req: Request, res: Response) => {
  removeFromWishlist((req as any).customer.sub, String(req.params.productId));
  res.status(204).end();
});

app.get("/api/wishlist/check/:productId", customerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ inWishlist: isInWishlist((req as any).customer.sub, String(req.params.productId)) });
});

// ============ QUOTES ============
app.get("/api/quotes", customerAuthMiddleware, (req: Request, res: Response) => {
  res.json({ quotes: listQuotesForCustomer((req as any).customer.sub) });
});

app.post("/api/quotes/from-wishlist", customerAuthMiddleware, (req: Request, res: Response) => {
  const quote = createQuoteFromWishlist((req as any).customer.sub, req.body?.notes);
  if (!quote) { res.status(400).json({ error: "Wishlist is empty." }); return; }
  res.status(201).json(quote);
});

app.patch("/api/quotes/:id/status", customerAuthMiddleware, (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["draft", "sent", "accepted", "declined"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }
  updateQuoteStatus(Number(req.params.id), status);
  res.json({ ok: true });
});

// ============ SHOP SUBSCRIPTION ============

app.get("/api/shop/subscription", staffAuthMiddleware, (_req: Request, res: Response) => {
  const plan = getShopPlan();
  res.json({ plan });
});

app.put("/api/shop/subscription", adminAuthMiddleware, (req: Request, res: Response) => {
  const { planId } = req.body || {};
  if (!planId) { res.status(400).json({ error: "planId is required." }); return; }
  const current = getShopPlan();
  const ok = setShopPlan(planId);
  if (!ok) { res.status(400).json({ error: "Invalid plan." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "plan_changed", "shop_subscription", planId, { from: current?.id || "none", to: planId }, (req as any).user.role);
  res.json({ ok: true });
});

app.post("/api/shop/subscription/request", staffAuthMiddleware, (req: Request, res: Response) => {
  const { planId, notes } = req.body || {};
  if (!planId) { res.status(400).json({ error: "planId is required." }); return; }
  const ok = createSubscriptionRequest(planId, (req as any).user.sub, notes || "");
  if (!ok) { res.status(400).json({ error: "Invalid plan." }); return; }
  res.status(201).json({ ok: true });
});

app.get("/api/shop/subscription/requests", adminAuthMiddleware, (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  res.json({ requests: listSubscriptionRequests(status) });
});

app.put("/api/shop/subscription/requests/:id", adminAuthMiddleware, (req: Request, res: Response) => {
  const { status } = req.body || {};
  if (!["approved", "rejected"].includes(status)) { res.status(400).json({ error: "Status must be approved or rejected." }); return; }
  const ok = reviewSubscriptionRequest(Number(req.params.id), status, (req as any).user.sub);
  if (!ok) { res.status(400).json({ error: "Request not found or already reviewed." }); return; }
  logAudit((req as any).user.sub, (req as any).user.username || "Admin", "request_" + status, "subscription_request", String(req.params.id), {}, (req as any).user.role);
  res.json({ ok: true });
});

app.get("/api/shop/features", (_req: Request, res: Response) => {
  const plan = getShopPlan();
  res.json({ features: plan?.features || [] });
});

app.get("/api/audit-log", ownerAuthMiddleware, (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 200;
  const entityType = req.query.entityType as string | undefined;
  const isOwner = (req as any).user.role === "owner";
  res.json({ entries: getAuditLog(limit, entityType, isOwner ? "admin" : undefined) });
});

// ============ OWNER DASHBOARD ============

// ============ COUPONS (Admin) ============

app.get("/api/admin/coupons", ownerAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ coupons: listCoupons() });
});

app.post("/api/admin/coupons", ownerAuthMiddleware, (req: Request, res: Response) => {
  const coupon = createCoupon(req.body || {});
  if (!coupon) { res.status(400).json({ error: "Coupon code already exists." }); return; }
  res.status(201).json(coupon);
});

app.put("/api/admin/coupons/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const coupon = updateCoupon(Number(req.params.id), req.body || {});
  res.json(coupon);
});

app.delete("/api/admin/coupons/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const ok = deleteCoupon(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Coupon not found." }); return; }
  res.json({ ok: true });
});

// ============ COUPONS (Public validate) ============

app.post("/api/coupons/validate", customerAuthMiddleware, (req: Request, res: Response) => {
  const { code, subtotal } = req.body || {};
  if (!code) { res.status(400).json({ error: "Coupon code is required." }); return; }
  const result = validateCoupon(String(code).trim(), Number(subtotal) || 0);
  if (result.error) { res.status(400).json({ error: result.error }); return; }
  res.json({ coupon: result.coupon, discount: result.discount });
});

// ============ SUPPLIERS (Admin) ============

app.get("/api/admin/suppliers", ownerAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ suppliers: listSuppliers() });
});

app.post("/api/admin/suppliers", ownerAuthMiddleware, (req: Request, res: Response) => {
  res.status(201).json(createSupplier(req.body || {}));
});

app.put("/api/admin/suppliers/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const supplier = updateSupplier(Number(req.params.id), req.body || {});
  res.json(supplier);
});

app.delete("/api/admin/suppliers/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const ok = deleteSupplier(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Supplier not found." }); return; }
  res.json({ ok: true });
});

app.get("/api/admin/customers", ownerAuthMiddleware, (_req: Request, res: Response) => {
  // Auto-deactivate customers with no login for 1 year
  deactivateOldCustomers();
  const includeInactive = String(_req.query.includeInactive || "") === "true";
  const customers = includeInactive ? listAllCustomers() : listActiveCustomers();
  res.json({ customers });
});

app.post("/api/admin/customers", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) { res.status(400).json({ error: "Name, email, and password required." }); return; }
  try {
    const existing = require("./db").findCustomerByEmail(email);
    if (existing) { res.status(409).json({ error: "Email already registered." }); return; }
    const customer = createCustomer(name, email, password, phone || "");
    if (!customer) { res.status(500).json({ error: "Failed to create customer." }); return; }
    res.json({ customer });
  } catch (err: any) { res.status(500).json({ error: "Failed to create customer." }); }
});

app.delete("/api/admin/customers/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const ok = deleteCustomer(Number(req.params.id));
  res.json({ success: ok });
});

app.get("/api/admin/customers/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const customer = getCustomerDetails(Number(req.params.id));
  if (!customer) { res.status(404).json({ error: "Customer not found." }); return; }
  res.json(customer);
});

app.patch("/api/admin/customers/:id/status", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { isActive } = req.body || {};
  if (isActive === undefined) { res.status(400).json({ error: "isActive required." }); return; }
  updateCustomerStatus(Number(req.params.id), isActive ? 1 : 0);
  res.json({ success: true });
});

app.get("/api/admin/messages", ownerAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ messages: listAllMessages() });
});

app.post("/api/admin/messages", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { customerId, providerId, subject, body } = req.body || {};
  if (!customerId || !providerId || !body) { res.status(400).json({ error: "customerId, providerId, and body are required." }); return; }
  const msg = sendMessage({ customerId: Number(customerId), providerId: Number(providerId), subject: subject || "", body, senderRole: "provider" });
  res.status(201).json(msg);
});

app.patch("/api/admin/messages/:id/read", ownerAuthMiddleware, (req: Request, res: Response) => {
  const ok = markMessageRead(Number(req.params.id));
  res.json({ ok });
});

app.get("/api/admin/quotes", staffAuthMiddleware, requirePermission("reports:view"), (_req: Request, res: Response) => {
  res.json({ quotes: listAllQuotes() });
});

app.post("/api/admin/quotes", staffAuthMiddleware, requirePermission("reports:view"), (req: Request, res: Response) => {
  const { customerId, notes, items } = req.body || {};
  if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "customerId and items array are required." }); return;
  }
  const customer = getCustomerDetails(Number(customerId));
  if (!customer) { res.status(404).json({ error: "Customer not found." }); return; }
  const quote = createQuote(Number(customerId), notes || "", items);
  res.status(201).json(quote);
});

app.put("/api/admin/quotes/:id", staffAuthMiddleware, requirePermission("reports:view"), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { customerId, notes, items } = req.body || {};
  const existing = getQuote(id);
  if (!existing) { res.status(404).json({ error: "Quote not found." }); return; }
  if (!customerId && !notes && !items) { res.status(400).json({ error: "Nothing to update." }); return; }
  res.json({ message: "Quote updated." });
});

app.get("/api/reports/sales/trends", ownerAuthMiddleware, requirePermission("reports:view"), (req: Request, res: Response) => {
  const from = String(req.query.from || "").slice(0, 10);
  const to = String(req.query.to || "").slice(0, 10);
  const branchId = req.query.branch_id ? Number(req.query.branch_id) : undefined;
  if (!from || !to) { res.status(400).json({ error: "from and to dates required." }); return; }
  let sql = `SELECT DATE(created_at) as day, COUNT(*) as orders, SUM(subtotal + shipping_fee - COALESCE(discount_amount, 0)) as revenue FROM orders WHERE status != 'cancelled' AND created_at >= ? AND created_at < date(?, '+1 day')`;
  const params: any[] = [from, to];
  if (branchId) { sql += " AND branch_id = ?"; params.push(branchId); }
  sql += " GROUP BY day ORDER BY day";
  const rows = getDb().prepare(sql).all(...params);
  res.json({ trends: rows });
});

app.get("/api/reports/sales", ownerAuthMiddleware, requirePermission("reports:view"), (req: Request, res: Response) => {
  const from = String(req.query.from || "1970-01-01");
  const to = String(req.query.to || "2099-12-31");
  const branchId = req.query.branch_id ? Number(req.query.branch_id) : undefined;
  res.json(getSalesReportWithRange(from, to, branchId));
});

app.get("/api/reports/stock-summary", ownerAuthMiddleware, requirePermission("reports:view"), (_req: Request, res: Response) => {
  res.json({ items: getStockSummary() });
});

app.get("/api/reports/employee-sales", ownerAuthMiddleware, requirePermission("reports:view"), (req: Request, res: Response) => {
  const from = String(req.query.from || "1970-01-01");
  const to = String(req.query.to || "2099-12-31");
  res.json({ employees: getEmployeeSalesPerformance(from, to) });
});

app.get("/api/reports/technician-repairs", ownerAuthMiddleware, requirePermission("reports:view"), (req: Request, res: Response) => {
  const from = String(req.query.from || "1970-01-01");
  const to = String(req.query.to || "2099-12-31");
  res.json({ technicians: getTechnicianRepairStats(from, to) });
});

// ============ STOCK TAKE ============

app.get("/api/stock-take", ownerAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ sessions: listStockTakeSessions() });
});

app.post("/api/stock-take/start", ownerAuthMiddleware, (req: Request, res: Response) => {
  const session = createStockTakeSession((req as any).user.sub, req.body?.notes || "");
  if (!session) { res.status(500).json({ error: "Failed to create stock take session." }); return; }
  const items = getStockTakeItems(session.id);
  res.status(201).json({ session, items });
});

app.get("/api/stock-take/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const session = getStockTakeSession(Number(req.params.id));
  if (!session) { res.status(404).json({ error: "Session not found." }); return; }
  const items = getStockTakeItems(Number(req.params.id));
  res.json({ session, items });
});

app.post("/api/stock-take/:id/count", ownerAuthMiddleware, (req: Request, res: Response) => {
  const { itemId, countedQuantity, notes } = req.body || {};
  if (!itemId || countedQuantity === undefined) { res.status(400).json({ error: "itemId and countedQuantity are required." }); return; }
  const ok = recordStockCount(itemId, Number(countedQuantity), notes || "");
  if (!ok) { res.status(404).json({ error: "Stock take item not found." }); return; }
  res.json({ ok: true });
});

app.post("/api/stock-take/:id/complete", ownerAuthMiddleware, (req: Request, res: Response) => {
  const result = completeStockTakeSession(Number(req.params.id));
  if (!result.ok) { res.status(400).json({ error: result.error || "Cannot complete session." }); return; }
  res.json({ ok: true, report: result.report });
});

app.post("/api/stock-take/:id/apply", ownerAuthMiddleware, (req: Request, res: Response) => {
  const adjusted = applyStockTakeAdjustments(Number(req.params.id));
  res.json({ ok: true, adjusted });
});

app.get("/api/stock-take/:id/report", ownerAuthMiddleware, (req: Request, res: Response) => {
  res.json(getStockTakeVarianceReport(Number(req.params.id)));
});

app.delete("/api/stock-take/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const result = deleteStockTakeSession(Number(req.params.id));
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.json({ ok: true });
});

// ============ STOCK ON HAND / SNAPSHOTS ============

app.get("/api/stock-on-hand/current", adminAuthMiddleware, requirePermission("stock:on_hand"), (_req: Request, res: Response) => {
  res.json({ items: getCurrentStockLevels(), date: new Date().toISOString().slice(0, 10) });
});

app.get("/api/stock-on-hand/history", adminAuthMiddleware, requirePermission("stock:on_hand"), (_req: Request, res: Response) => {
  res.json({ dates: listStockSnapshotDates() });
});

app.get("/api/stock-on-hand/:date", adminAuthMiddleware, requirePermission("stock:on_hand"), (req: Request, res: Response) => {
  const snapshot = getStockSnapshot(String(req.params.date));
  if (snapshot.items.length === 0) { res.status(404).json({ error: "No snapshot for this date." }); return; }
  res.json(snapshot);
});

app.post("/api/stock-on-hand/snapshot", adminAuthMiddleware, requirePermission("stock:on_hand"), (req: Request, res: Response) => {
  const date = req.body?.date || new Date().toISOString().slice(0, 10);
  createStockSnapshot(date);
  res.json({ ok: true, date });
});

// ============ SPEC TEMPLATES ============

app.get("/api/spec-templates", ownerAuthMiddleware, (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  if (category) res.json({ fields: getSpecTemplateFields(category) });
  else res.json({ fields: getAllSpecTemplateFields() });
});

app.post("/api/spec-templates", ownerAuthMiddleware, (req: Request, res: Response) => {
  const field = createSpecTemplateField(req.body);
  if (!field) { res.status(400).json({ error: "Failed to create spec field." }); return; }
  res.status(201).json(field);
});

app.put("/api/spec-templates/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const ok = updateSpecTemplateField(Number(req.params.id), req.body);
  if (!ok) { res.status(404).json({ error: "Spec field not found." }); return; }
  res.json({ ok: true });
});

app.delete("/api/spec-templates/:id", ownerAuthMiddleware, (req: Request, res: Response) => {
  const ok = deleteSpecTemplateField(Number(req.params.id));
  if (!ok) { res.status(404).json({ error: "Spec field not found." }); return; }
  res.json({ ok: true });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Error]", err?.message || err);
  res.status(err?.status || 500).json({ error: "Internal server error." });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
