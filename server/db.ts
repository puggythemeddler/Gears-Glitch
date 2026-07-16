import bcrypt from "bcryptjs";
import { imageUrlForProduct, deleteProductImages } from "./upload";
import { CATEGORIES } from "./categories";
import { query, queryOne, queryAll, transaction, runSchema, getPool } from "./db-helpers";

interface ProductRow {
  id: string;
  category: string;
  name: string;
  price: number;
  specs: string;
  in_stock: number;
  is_non_stock: number;
  image_alt: string;
  image_url: string;
  subcategory: string;
  has_warranty: number;
  warranty_duration: number;
  taxable: number;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  category: string;
  name: string;
  price: number;
  specs: any[];
  inStock: boolean;
  isNonStock: boolean;
  subcategory: string;
  hasWarranty: boolean;
  warrantyDuration: number;
  taxable: boolean;
  imageAlt: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface Staff {
  id: number;
  username: string;
  email?: string;
  role: string;
}

interface StaffWithPassword extends Staff {
  password_hash: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: number;
  last_login: string | null;
  created_at: string;
}

interface CustomerWithPassword extends Customer {
  password_hash: string;
}

interface CartItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  inStock: boolean;
  imageUrl: string;
  imageAlt: string;
  lineTotal: number;
  hasWarranty: boolean;
  warrantyDuration: number;
}

interface StockLevel {
  productId: string;
  quantityInStock: number;
  quantityReserved: number;
  quantitySold: number;
  lowStockThreshold: number;
  updatedAt: string;
}

interface StockMovement {
  id: number;
  productId: string;
  movementType: string;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  tierLevel: number;
  maxProducts: number | null;
  maxBranches: number;
  features: string[];
  isActive: boolean;
}

interface Provider {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  hasPin: boolean;
}

interface ProviderWithPassword extends Provider {
  password_hash: string;
  pin_hash: string;
}

interface ProviderPlanAssignment {
  id: number;
  providerId: number;
  planId: string;
  planName: string;
  customPrice: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string;
}

interface LowStockItem {
  productId: string;
  name: string;
  price: number;
  quantityInStock: number;
  lowStockThreshold: number;
}

interface Order {
  id: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  status: string;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCounty: string;
  shippingPostcode: string;
  shippingPhone: string;
  shippingFee: number;
  notes: string;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
  branchId: number | null;
  items: OrderItem[];
  couponId?: number | null;
  discountAmount?: number;
  processedBy?: string;
  idempotencyKey?: string;
}

interface OrderItem {
  id: number;
  orderId: number;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  hasWarranty: number;
  warrantyDuration: number;
}

interface ProductView {
  id: number;
  productId: string;
  viewerType: string;
  viewedAt: string;
}

interface Invoice {
  id: number;
  providerId: number;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
}

interface OrderInvoice {
  id: number;
  orderId: number;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  etimsInvoiceNumber?: string;
  controlCode?: string;
  kraPin?: string;
  serialNumber?: number;
  internalData?: string;
  signatureData?: string;
  receiptDate?: string;
  receiptCounter?: number;
  totalReceipts?: number;
  taxType?: string;
  paymentType?: string;
}

interface Settings {
  storeName: string;
  phone: string;
  email: string;
  currency: string;
  storeLogo: string;
  storeFavicon: string;
  taxRate: number;
  backupImagesToDb: boolean;
}

interface CategoryRow {
  id: string;
  label: string;
  group_name: string;
  show_on_pos: number;
}

interface Category {
  id: string;
  label: string;
  group: string;
  showOnPos: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  kraCode: string;
  needsTender: boolean;
}

interface ProductImage {
  id: number;
  product_id: string;
  image_url: string;
  sort_order: number;
  is_primary: number;
  created_at: string;
}

interface Message {
  id: number;
  customerId: number;
  providerId: number;
  productId: string | null;
  subject: string;
  body: string;
  senderRole: "customer" | "provider";
  createdAt: string;
  readAt: string | null;
  customerName?: string;
  providerName?: string;
}

interface StockTransfer {
  id: number;
  fromBranchId: number;
  toBranchId: number;
  productId: string;
  quantity: number;
  status: string;
  notes: string | null;
  createdBy: number | null;
  completedAt: string | null;
  createdAt: string;
}

interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  managerId: number | null;
  managerName: string;
  isActive: boolean;
  createdAt: string;
}

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  dbPath: string;
  settings: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WishlistItem {
  id: number;
  customerId: number;
  productId: string;
  notes: string;
  createdAt: string;
  productName?: string;
  productPrice?: number;
  productImage?: string;
}

interface Quote {
  id: number;
  customerId: number;
  quoteNumber: string;
  status: string;
  notes: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

interface QuoteItem {
  id: number;
  quoteId: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface CreditNote {
  id: number;
  orderId: number;
  totalAmount: number;
  reason: string;
  reasonCode: string;
  status: string;
  createdBy: number;
  createdAt: string;
  items: CreditNoteItem[];
  etimsCnNumber?: string;
  etimsControlCode?: string;
  etimsSerialNumber?: number;
  etimsInternalData?: string;
  etimsSignatureData?: string;
  etimsSubmittedAt?: string;
}

interface CreditNoteItem {
  id: number;
  creditNoteId: number;
  orderItemId: number;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

interface RepairImage {
  id: number;
  ticketId: string;
  imageUrl: string;
  imageType: "before" | "after";
  uploadedBy: number | null;
  createdAt: string;
}

interface PurchaseOrder {
  id: number;
  supplierName: string;
  supplierContact: string;
  orderDate: string;
  status: string;
  notes: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
  totalCost: number;
}

interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  productId: string;
  productName?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

interface TechPerformanceReport {
  staffId: number;
  staffName: string;
  ticketsCompleted: number;
  ticketsAssigned: number;
  totalEarned: number;
}

interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  paidInvoices: number;
  invoiceRevenue: number;
  topProducts: { productId: string; name: string; totalSold: number; revenue: number }[];
}

interface PurchaseReport {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
  receivedOrders: number;
}

interface StockTakeSession {
  id: number;
  status: string;
  notes: string;
  createdBy: number | null;
  completedAt: string | null;
  createdAt: string;
}

interface StockTakeItem {
  id: number;
  sessionId: number;
  productId: string;
  productName: string;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number;
  notes: string;
}

interface StockSnapshot {
  id: number;
  snapshotDate: string;
  productId: string;
  productName: string;
  quantity: number;
  createdAt: string;
}

interface AuditEntry {
  id: number;
  userId: number | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  createdAt: string;
}

interface SpecFieldDef {
  id: number;
  category: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  options: string[];
  required: boolean;
  sortOrder: number;
}

function mapProduct(row: ProductRow | null): Product | null {
  if (!row) return null;
  const baseUrl = row.image_url || imageUrlForProduct(row.id) || "";
  const ts = row.updated_at ? new Date(row.updated_at).getTime() : row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const imageUrl = baseUrl ? `${baseUrl}?v=${ts}` : "";
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    price: row.price,
    specs: JSON.parse(row.specs || "[]"),
    inStock: Boolean(row.in_stock),
    isNonStock: Boolean(row.is_non_stock),
    subcategory: row.subcategory || "",
    hasWarranty: Boolean(row.has_warranty),
    warrantyDuration: row.warranty_duration || 0,
    taxable: Boolean(row.taxable),
    imageAlt: row.image_alt || "",
    imageUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlan(row: any): SubscriptionPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    tierLevel: row.tier_level,
    maxProducts: row.max_products,
    maxBranches: row.max_branches ?? 1,
    features: JSON.parse(row.features || "[]"),
    isActive: Boolean(row.is_active),
  };
}

function mapBranch(row: any): Branch {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    managerId: row.manager_id ?? null,
    managerName: row.manager_username ?? "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

function mapClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    address: row.address || "",
    dbPath: row.db_path || "",
    settings: row.settings || "{}",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function getDb(): any {
  return getPool();
}

async function initDb(): Promise<void> {
  await runMigrations();
  await ensureDefaultSettings();
  await ensureDefaultCategories();
  await ensureAdminUser();
  await ensureTechnicianUser();
  await seedProductsIfEmpty();
  await assignInitialRoles();
  await ensureDefaultSubscriptionPlans();
  await seedDemoProvider();
  await seedDemoCustomer();
  const settings = await getSettings();
  await query(
    `INSERT INTO order_invoices (order_id, amount, currency, status)
     SELECT o.id, (o.subtotal + o.shipping_fee), $1, 'pending'
     FROM orders o WHERE o.status IN ('shipped', 'delivered')
     AND NOT EXISTS (SELECT 1 FROM order_invoices oi WHERE oi.order_id = o.id)
     ON CONFLICT DO NOTHING`,
    [settings.currency]
  );
}

async function runMigrations(): Promise<void> {
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_non_stock INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS taxable INTEGER NOT NULL DEFAULT 1`); } catch {}
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS min_tier INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS has_warranty INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_duration INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'`); } catch {}
  try { await query(`UPDATE users SET role = 'admin' WHERE role IS NULL OR role = ''`); } catch {}
  try { await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`); } catch {}
  try { await query(`UPDATE users SET email = username || '@gearandglitch.com' WHERE email IS NULL`); } catch {}
  try { await query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS pin_hash TEXT NOT NULL DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS show_on_pos INTEGER NOT NULL DEFAULT 1`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS repair_type TEXT`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS hardware_value DOUBLE PRECISION NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS labor_cost DOUBLE PRECISION NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS parts_cost DOUBLE PRECISION NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS software_install INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS software_license INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS total_cost DOUBLE PRECISION NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS quote_sent_at TEXT`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS quote_responded_at TEXT`); } catch {}
  try { await query(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS quote_response TEXT`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_county TEXT NOT NULL DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee DOUBLE PRECISION NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users(id)`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id)`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed_by TEXT`); } catch {}
  try { await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT`); } catch {}
  try { await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS has_warranty INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS warranty_duration INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS taxable INTEGER NOT NULL DEFAULT 1`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS etims_invoice_number TEXT`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS control_code TEXT`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS kra_pin TEXT`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS serial_number INTEGER`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS internal_data TEXT`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS signature_data TEXT`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS receipt_date TEXT`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS receipt_counter INTEGER`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS total_receipts INTEGER`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS tax_type TEXT NOT NULL DEFAULT 'A'`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT '04'`); } catch {}
  try { await query(`ALTER TABLE order_invoices ADD COLUMN IF NOT EXISTS vscu_receipt_no INTEGER`); } catch {}
  try { await query(`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_role TEXT NOT NULL DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login TEXT`); } catch {}
  try { await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1`); } catch {}
  try { await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS reason_code TEXT NOT NULL DEFAULT '13'`); } catch {}
  try { await query(`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS etims_cn_number TEXT`); } catch {}
  try { await query(`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS etims_control_code TEXT`); } catch {}
  try { await query(`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS etims_serial_number INTEGER`); } catch {}
  try { await query(`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS etims_internal_data TEXT`); } catch {}
  try { await query(`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS etims_signature_data TEXT`); } catch {}
  try { await query(`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS etims_submitted_at TEXT`); } catch {}
  try {
    await query(`CREATE TABLE IF NOT EXISTS product_views (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      viewer_type TEXT NOT NULL DEFAULT 'anonymous',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id)`);
  } catch {}
  try {
    await query(`CREATE TABLE IF NOT EXISTS stored_images (
      id SERIAL PRIMARY KEY,
      ref_id TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      image_data TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_stored_images_ref ON stored_images(ref_id)`);
  } catch {}

  const existingTypes = await queryOne("SELECT COUNT(*) AS c FROM repair_types") as any;
  if (existingTypes && Number(existingTypes.c) === 0) {
    const types = [
      { id: "keyboard", name: "Keyboard Repair", description: "Keyboard replacement or individual key fix", base_price: 1500 },
      { id: "motherboard", name: "Motherboard Replacement", description: "Full motherboard replacement including labor", base_price: 3500 },
      { id: "servicing", name: "Computer Servicing", description: "Full cleaning, thermal paste, fan check", base_price: 2000 },
      { id: "screen", name: "Screen Replacement", description: "LCD/LED screen replacement", base_price: 2500 },
      { id: "battery", name: "Battery Replacement", description: "Laptop battery replacement", base_price: 1000 },
      { id: "software_install", name: "Software Installation", description: "OS or application installation", base_price: 800 },
      { id: "software_license", name: "Software Installation + License", description: "Software installation with genuine license", base_price: 2500 },
      { id: "data_recovery", name: "Data Recovery", description: "Hard drive data recovery service", base_price: 3000 },
      { id: "upgrade_ram", name: "RAM Upgrade", description: "Memory module installation", base_price: 800 },
      { id: "upgrade_storage", name: "Storage Upgrade", description: "HDD/SSD replacement or addition", base_price: 1200 },
    ];
    for (const t of types) {
      await query("INSERT INTO repair_types (id, name, description, base_price) VALUES ($1, $2, $3, $4)", [t.id, t.name, t.description, t.base_price]);
    }
  }

  const etimsMode = await queryOne("SELECT value FROM settings WHERE key = 'etims_mode'");
  if (!etimsMode) {
    await query("INSERT INTO settings (key, value) VALUES ('etims_mode', 'off')");
  } else if (etimsMode.value !== "off") {
    await query("UPDATE settings SET value = 'off' WHERE key = 'etims_mode'");
  }
  const settingDefaults: { [k: string]: string } = {
    etims_branch_id: "00", etims_device_serial: "dvc001", etims_vscu_url: "http://localhost:8088",
    etims_oscu_api_url: "https://etims.kra.go.ke/api", etims_oscu_consumer_key: "",
    etims_oscu_consumer_secret: "", kra_pin: "P051234567Z", etims_serial_prefix: "01",
    etims_last_serial: "1", etims_vscu_receipt_counter: "0", loyalty_rate: "10",
    loyalty_redemption_rate: "1", store_layout: "original", store_banners: "[]",
    store_features: "[]", shop_plan_id: "starter",
  };
  for (const [k, v] of Object.entries(settingDefaults)) {
    const ex = await queryOne("SELECT value FROM settings WHERE key = $1", [k]);
    if (!ex) await query("INSERT INTO settings (key, value) VALUES ($1, $2)", [k, v]);
  }
  const aboutUs = await queryOne("SELECT value FROM settings WHERE key = 'about_us'");
  if (!aboutUs) {
    await query("INSERT INTO settings (key, value) VALUES ('about_us', $1)", ['{"title":"About Us","content":"We are a leading retailer of computers, laptops, and accessories.","mission":"To provide quality tech products at affordable prices.","vision":"To be the most trusted tech retailer in the region."}']);
  }

  await initRolesAsync();
  await ensureTechnicianUser();

  const existingClientCount = await queryOne("SELECT COUNT(*) AS count FROM clients") as any;
  if (!existingClientCount || Number(existingClientCount.count) === 0) {
    const shopName = await getStoreSetting("storeName") || "My Shop";
    const shopEmail = await getStoreSetting("email") || "";
    const shopPhone = await getStoreSetting("phone") || "";
    await query("INSERT INTO clients (name, email, phone, settings) VALUES ($1, $2, $3, $4)", [shopName, shopEmail, shopPhone, JSON.stringify({ migrated: true })]);
  }
}

async function ensureDefaultSettings(): Promise<void> {
  const defaults: { [key: string]: string } = {
    storeName: "Gear&Glitch", phone: "01234 567890", email: "sales@computerstore.example", currency: "KES", storeLogo: "", storeFavicon: "",
  };
  const existing = await queryOne("SELECT COUNT(*) AS count FROM settings") as { count: number } | undefined;
  if (existing && Number(existing.count) > 0) return;
  for (const [key, value] of Object.entries(defaults)) {
    await query("INSERT INTO settings (key, value) VALUES ($1, $2)", [key, value]);
  }
}

async function ensureDefaultCategories(): Promise<void> {
  const existing = await queryOne("SELECT COUNT(*) AS count FROM categories") as { count: number } | undefined;
  if (existing && Number(existing.count) > 0) return;
  for (const category of CATEGORIES) {
    await query("INSERT INTO categories (id, label, group_name) VALUES ($1, $2, $3)", [category.id, category.label, category.group || ""]);
  }
}

async function ensureAdminUser(): Promise<void> {
  const row = await queryOne("SELECT COUNT(*) AS count FROM users") as { count: number } | undefined;
  if (row && Number(row.count) > 0) return;
  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_EMAIL || "admin@gearandglitch.com";
  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    if (process.env.NODE_ENV === "production") { console.warn("ADMIN_PASSWORD not set"); return; }
    password = "admin123";
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await query("INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", [username, email, passwordHash]);
}

async function ensureTechnicianUser(): Promise<void> {
  const techUser = process.env.TECH_USERNAME || "technician";
  const techEmail = process.env.TECH_EMAIL || "tech@gearandglitch.com";
  let password = process.env.TECH_PASSWORD || "";
  if (!password) {
    if (process.env.NODE_ENV === "production") { console.warn("TECH_PASSWORD not set"); return; }
    password = "tech123";
  }
  const existing = await queryOne("SELECT id, email FROM users WHERE username = $1", [techUser]) as any;
  if (existing) {
    if (existing.email !== techEmail) await query("UPDATE users SET email = $1 WHERE id = $2", [techEmail, existing.id]);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await query("INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'technician')", [techUser, techEmail, passwordHash]);
}

async function seedDemoProvider(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const demoEmail = "provider@gearandglitch.com";
  if (await findProviderByEmail(demoEmail)) return;
  const pwdHash = await bcrypt.hash("provider123", 10);
  const result = await query("INSERT INTO providers (company_name, contact_name, email, phone, password_hash, status) VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id", ["Demo Company", "Demo Provider", demoEmail, "0123456789", pwdHash]);
  const providerId = result.rows[0].id;
  const plan = await getSubscriptionPlan("starter");
  if (plan) {
    await query("INSERT INTO provider_plan_assignments (provider_id, plan_id, status, start_date) VALUES ($1, $2, 'active', $3)", [providerId, plan.id, new Date().toISOString().slice(0, 10)]);
  }
}

async function seedDemoCustomer(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const demoEmail = "customer@gearandglitch.com";
  if (await findCustomerByEmail(demoEmail)) return;
  const pwdHash = await bcrypt.hash("customer123", 10);
  await query("INSERT INTO customers (name, email, password_hash) VALUES ($1, $2, $3)", ["Demo Customer", demoEmail, pwdHash]);
}

async function initRolesAsync(): Promise<void> {
  const DEFAULT_ROLES: { [key: string]: string[] } = {
    admin: ["staff:list", "staff:create", "staff:update", "staff:delete", "repair:list", "repair:create", "repair:view", "repair:update", "repair:assign", "repair:cancel", "product:list", "product:create", "product:update", "product:delete", "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer", "settings:view", "settings:update", "calendar:view", "calendar:schedule", "reports:view", "reports:export"],
    technician: ["repair:list", "repair:view", "repair:update", "calendar:view", "calendar:schedule", "product:list"],
    manager: ["staff:list", "repair:list", "repair:view", "repair:update", "repair:assign", "product:list", "product:update", "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer", "calendar:view", "calendar:schedule", "reports:view", "reports:export"],
    owner: ["staff:list", "staff:create", "staff:update", "staff:delete", "repair:list", "repair:create", "repair:view", "repair:update", "repair:assign", "repair:cancel", "product:list", "product:create", "product:update", "product:delete", "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer", "settings:view", "settings:update", "calendar:view", "calendar:schedule", "reports:view", "reports:export"],
  };
  await transaction(async (client) => {
    for (const [roleId] of Object.entries(DEFAULT_ROLES)) {
      await client.query("INSERT INTO roles (id, name, description, is_custom) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING", [roleId, roleId.charAt(0).toUpperCase() + roleId.slice(1), `Default ${roleId} role`]);
    }
    for (const [roleId, permissions] of Object.entries(DEFAULT_ROLES)) {
      for (const permission of permissions) {
        await client.query("INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roleId, permission]);
      }
    }
  });
}

async function assignInitialRoles(): Promise<void> {
  for (const role of ["admin", "owner", "technician"]) {
    const user = await queryOne("SELECT id FROM users WHERE role = $1", [role]) as { id: number } | undefined;
    if (user) {
      const existingRoles = await queryAll("SELECT role_id AS id FROM user_roles WHERE user_id = $1", [user.id]) as any[];
      if (!existingRoles.find((r: any) => r.id === role)) {
        const roleExists = await queryOne("SELECT id FROM roles WHERE id = $1", [role]);
        if (roleExists) {
          await query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.id, role]);
        }
      }
    }
  }
}

async function listCategories(): Promise<Category[]> {
  const rows = await queryAll("SELECT id, label, group_name, show_on_pos FROM categories ORDER BY group_name, label");
  return rows.map((row: any) => ({ id: row.id, label: row.label, group: row.group_name, showOnPos: row.show_on_pos === 1 }));
}

async function listPosCategories(): Promise<Category[]> {
  const rows = await queryAll("SELECT id, label, group_name, show_on_pos FROM categories WHERE show_on_pos = 1 ORDER BY group_name, label");
  return rows.map((row: any) => ({ id: row.id, label: row.label, group: row.group_name, showOnPos: true }));
}

async function getCategory(id: string): Promise<CategoryRow | undefined> {
  return await queryOne("SELECT id, label, group_name, show_on_pos FROM categories WHERE id = $1", [id]) as CategoryRow | undefined;
}

async function createCategory(category: { id: string; label: string; group?: string; showOnPos?: boolean }): Promise<CategoryRow | undefined> {
  await query("INSERT INTO categories (id, label, group_name, show_on_pos) VALUES ($1, $2, $3, $4)", [category.id, category.label, category.group || "", category.showOnPos !== false ? 1 : 0]);
  return await getCategory(category.id);
}

async function updateCategory(id: string, updates: { label?: string; group?: string; showOnPos?: number }): Promise<CategoryRow | undefined | null> {
  const existing = await getCategory(id);
  if (!existing) return null;
  await query("UPDATE categories SET label = $1, group_name = $2, show_on_pos = $3 WHERE id = $4", [updates.label ?? existing.label, updates.group ?? existing.group_name, updates.showOnPos !== undefined ? updates.showOnPos : existing.show_on_pos, id]);
  return await getCategory(id);
}

async function deleteCategory(id: string): Promise<boolean> {
  const result = await query("DELETE FROM categories WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function isValidCategory(id: string): Promise<boolean> {
  return Boolean(await getCategory(id));
}

async function listSubcategories(): Promise<any[]> {
  const rows = await queryAll("SELECT id, name, category_ids, created_at FROM subcategories ORDER BY name");
  return rows.map((row: any) => ({ ...row, category_ids: JSON.parse(row.category_ids || "[]") }));
}

async function getSubcategory(id: string): Promise<any> {
  const row = await queryOne("SELECT id, name, category_ids, created_at FROM subcategories WHERE id = $1", [id]) as any;
  if (!row) return undefined;
  return { ...row, category_ids: JSON.parse(row.category_ids || "[]") };
}

async function createSubcategory(data: { id: string; name: string; category_ids?: string[] }): Promise<any> {
  await query("INSERT INTO subcategories (id, name, category_ids) VALUES ($1, $2, $3)", [data.id, data.name, JSON.stringify(data.category_ids || [])]);
  return await getSubcategory(data.id);
}

async function updateSubcategory(id: string, updates: { name?: string; category_ids?: string[] }): Promise<any> {
  const existing = await getSubcategory(id);
  if (!existing) return null;
  await query("UPDATE subcategories SET name = $1, category_ids = $2 WHERE id = $3", [updates.name ?? existing.name, updates.category_ids !== undefined ? JSON.stringify(updates.category_ids) : JSON.stringify(existing.category_ids), id]);
  return await getSubcategory(id);
}

async function deleteSubcategory(id: string): Promise<boolean> {
  const result = await query("DELETE FROM subcategories WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function getSubcategoriesForCategory(categoryId: string): Promise<any[]> {
  return (await listSubcategories()).filter((s) => s.category_ids.includes(categoryId));
}

async function findStaffByUsername(username: string): Promise<StaffWithPassword | undefined> {
  return await queryOne("SELECT * FROM users WHERE username = $1", [username]) as StaffWithPassword | undefined;
}

async function findStaffByEmail(email: string): Promise<StaffWithPassword | undefined> {
  return await queryOne("SELECT * FROM users WHERE email = $1", [email]) as StaffWithPassword | undefined;
}

async function findStaffById(id: number): Promise<Staff | undefined> {
  return await queryOne("SELECT id, username, email, role, created_at FROM users WHERE id = $1", [id]) as Staff | undefined;
}

async function listStaff(): Promise<Staff[]> {
  return await queryAll("SELECT id, username, email, role FROM users ORDER BY username") as Staff[];
}

async function updateStaffDetails(id: number, data: { username?: string; email?: string }): Promise<Staff | null> {
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (data.username !== undefined) { fields.push(`username = $${idx}`); params.push(data.username); idx++; }
  if (data.email !== undefined) { fields.push(`email = $${idx}`); params.push(data.email); idx++; }
  if (fields.length === 0) return null;
  params.push(id);
  const result = await query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`, params);
  if ((result.rowCount ?? 0) === 0) return null;
  return await findStaffById(id) || null;
}

async function seedProductsIfEmpty(): Promise<void> {
  const row = await queryOne("SELECT COUNT(*) AS count FROM products") as { count: number } | undefined;
  if (row && Number(row.count) > 0) return;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const seedPath = path.join(__dirname, "..", "products.json");
    if (!fs.existsSync(seedPath)) return;
    const catalog = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    await transaction(async (client) => {
      for (const product of (catalog.products || [])) {
        await client.query("INSERT INTO products (id, category, name, price, specs, in_stock, image_alt, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [product.id, product.category, product.name, product.price, JSON.stringify(product.specs || []), product.inStock ? 1 : 0, product.imageAlt || "", product.imageUrl || ""]);
      }
    });
  } catch {}
}

async function getSettings(): Promise<Settings> {
  const rows = await queryAll("SELECT key, value FROM settings") as { key: string; value: string }[];
  const s: { [key: string]: string } = {};
  for (const row of rows) s[row.key] = row.value;
  return {
    storeName: s.storeName || "Gear&Glitch",
    phone: s.phone || "",
    email: s.email || "",
    currency: s.currency || "KES",
    storeLogo: s.storeLogo || "",
    storeFavicon: s.storeFavicon || "",
    taxRate: Number(s.taxRate) || 0,
    backupImagesToDb: s.backupImagesToDb === "true",
  };
}

async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const raw = await getStoreSetting("payment_methods");
  if (raw) { try { return JSON.parse(raw); } catch {} }
  return [{ id: "cash", name: "Cash", kraCode: "01", needsTender: true }, { id: "mpesa", name: "M-Pesa", kraCode: "04", needsTender: false }, { id: "card", name: "Card", kraCode: "02", needsTender: false }];
}

async function setPaymentMethods(methods: PaymentMethod[]): Promise<void> {
  await setStoreSetting("payment_methods", JSON.stringify(methods));
}

async function updateSettings(updates: { [key: string]: any }): Promise<Settings> {
  const allowed = ["storeName", "phone", "email", "currency", "storeLogo", "storeFavicon", "taxRate", "backupImagesToDb"];
  if (updates.paymentMethods) await setPaymentMethods(updates.paymentMethods);
  await transaction(async (client) => {
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [key, String(updates[key])]);
      }
    }
  });
  return await getSettings();
}

async function getStoreSetting(key: string): Promise<string | null> {
  const row = await queryOne("SELECT value FROM settings WHERE key = $1", [key]) as any;
  return row ? row.value : null;
}

async function setStoreSetting(key: string, value: string): Promise<void> {
  await query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
}

async function listProducts(category?: string): Promise<Product[]> {
  let sql = "SELECT * FROM products"; const params: any[] = [];
  if (category && category !== "all") { sql += " WHERE category = $1"; params.push(category); }
  sql += " ORDER BY created_at DESC";
  const rows = await queryAll(sql, params) as ProductRow[];
  return rows.map(mapProduct) as Product[];
}

async function getProduct(id: string): Promise<Product | undefined> {
  const row = await queryOne("SELECT * FROM products WHERE id = $1", [id]) as ProductRow | null;
  return mapProduct(row) || undefined;
}

async function setProductImageUrl(id: string, url: string): Promise<void> {
  await query("UPDATE products SET image_url = $1 WHERE id = $2", [url, id]);
}

async function getProductImages(productId: string): Promise<ProductImage[]> {
  return await queryAll("SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order", [productId]) as ProductImage[];
}

async function addProductImage(productId: string, imageUrl: string, sortOrder: number = 0, isPrimary: number = 0): Promise<ProductImage> {
  const result = await query("INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES ($1, $2, $3, $4) RETURNING *", [productId, imageUrl, sortOrder, isPrimary]);
  return result.rows[0] as ProductImage;
}

async function deleteProductImage(id: number): Promise<boolean> {
  const result = await query("DELETE FROM product_images WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function setProductImageOrder(productId: string, imageIds: number[]): Promise<void> {
  await transaction(async (client) => {
    for (let i = 0; i < imageIds.length; i++) {
      await client.query("UPDATE product_images SET sort_order = $1 WHERE id = $2 AND product_id = $3", [i, imageIds[i], productId]);
    }
  });
}

async function setPrimaryImage(productId: string, imageId: number): Promise<void> {
  await transaction(async (client) => {
    await client.query("UPDATE product_images SET is_primary = 0 WHERE product_id = $1", [productId]);
    await client.query("UPDATE product_images SET is_primary = 1 WHERE id = $1 AND product_id = $2", [imageId, productId]);
  });
}

async function getMessagesForCustomer(customerId: number): Promise<Message[]> {
  return await queryAll("SELECT * FROM messages WHERE customer_id = $1 ORDER BY created_at DESC", [customerId]) as Message[];
}

async function getMessagesForProvider(providerId: number): Promise<Message[]> {
  return await queryAll("SELECT * FROM messages WHERE provider_id = $1 ORDER BY created_at DESC", [providerId]) as Message[];
}

async function sendMessage(customerId: number, providerId: number, subject: string, body: string, senderRole: string, productId?: string | null): Promise<Message> {
  const result = await query("INSERT INTO messages (customer_id, provider_id, product_id, subject, body, sender_role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [customerId, providerId, productId || null, subject, body, senderRole]);
  return result.rows[0] as Message;
}

async function markMessageRead(id: number): Promise<void> {
  await query("UPDATE messages SET read_at = NOW()::text WHERE id = $1 AND read_at IS NULL", [id]);
}

async function getUnreadMessageCount(customerId: number, providerId: number, role: string): Promise<number> {
  let sql: string; let params: any[];
  if (role === "customer") {
    sql = "SELECT COUNT(*) AS count FROM messages WHERE customer_id = $1 AND sender_role != 'customer' AND read_at IS NULL";
    params = [customerId];
  } else {
    sql = "SELECT COUNT(*) AS count FROM messages WHERE provider_id = $1 AND sender_role != 'provider' AND read_at IS NULL";
    params = [providerId];
  }
  const result = await queryOne(sql, params) as any;
  return Number(result?.count || 0);
}

async function generateProductId(category: string): Promise<string> {
  const prefix = category.slice(0, 3).toUpperCase();
  const row = await queryOne("SELECT id FROM products WHERE id LIKE $1 ORDER BY id DESC LIMIT 1", [`${prefix}-%`]) as any;
  if (!row) return `${prefix}-001`;
  const num = parseInt(row.id.split("-")[1] || "0", 10) + 1;
  return `${prefix}-${String(num).padStart(3, "0")}`;
}

async function createProduct(product: { id: string; category: string; name: string; price: number; specs?: any[]; inStock?: boolean; isNonStock?: boolean; subcategory?: string; hasWarranty?: boolean; warrantyDuration?: number; taxable?: boolean; imageAlt?: string; imageUrl?: string }): Promise<Product> {
  await query(
    `INSERT INTO products (id, category, name, price, specs, in_stock, is_non_stock, subcategory, has_warranty, warranty_duration, taxable, image_alt, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [product.id, product.category, product.name, product.price, JSON.stringify(product.specs || []), product.inStock !== false ? 1 : 0, product.isNonStock ? 1 : 0, product.subcategory || "", product.hasWarranty ? 1 : 0, product.warrantyDuration || 0, product.taxable !== false ? 1 : 0, product.imageAlt || "", product.imageUrl || ""]
  );
  return (await getProduct(product.id))!;
}

async function updateProduct(id: string, updates: { category?: string; name?: string; price?: number; specs?: any[]; inStock?: boolean; isNonStock?: boolean; subcategory?: string; hasWarranty?: boolean; warrantyDuration?: number; taxable?: boolean; imageAlt?: string; imageUrl?: string }): Promise<Product | undefined> {
  const existing = await getProduct(id);
  if (!existing) return undefined;
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (updates.category !== undefined) { fields.push(`category = $${idx}`); params.push(updates.category); idx++; }
  if (updates.name !== undefined) { fields.push(`name = $${idx}`); params.push(updates.name); idx++; }
  if (updates.price !== undefined) { fields.push(`price = $${idx}`); params.push(updates.price); idx++; }
  if (updates.specs !== undefined) { fields.push(`specs = $${idx}`); params.push(JSON.stringify(updates.specs)); idx++; }
  if (updates.inStock !== undefined) { fields.push(`in_stock = $${idx}`); params.push(updates.inStock ? 1 : 0); idx++; }
  if (updates.isNonStock !== undefined) { fields.push(`is_non_stock = $${idx}`); params.push(updates.isNonStock ? 1 : 0); idx++; }
  if (updates.subcategory !== undefined) { fields.push(`subcategory = $${idx}`); params.push(updates.subcategory); idx++; }
  if (updates.hasWarranty !== undefined) { fields.push(`has_warranty = $${idx}`); params.push(updates.hasWarranty ? 1 : 0); idx++; }
  if (updates.warrantyDuration !== undefined) { fields.push(`warranty_duration = $${idx}`); params.push(updates.warrantyDuration); idx++; }
  if (updates.taxable !== undefined) { fields.push(`taxable = $${idx}`); params.push(updates.taxable ? 1 : 0); idx++; }
  if (updates.imageAlt !== undefined) { fields.push(`image_alt = $${idx}`); params.push(updates.imageAlt); idx++; }
  if (updates.imageUrl !== undefined) { fields.push(`image_url = $${idx}`); params.push(updates.imageUrl); idx++; }
  fields.push(`updated_at = NOW()::text`);
  if (fields.length === 1) return existing;
  params.push(id);
  await query(`UPDATE products SET ${fields.join(", ")} WHERE id = $${idx}`, params);
  return await getProduct(id);
}

async function deleteProduct(id: string): Promise<boolean> {
  const result = await query("DELETE FROM products WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function getPriceHistory(_productId: string): Promise<any[]> {
  return [];
}

async function createStaff(data: { username: string; email?: string; password: string; role?: string }): Promise<Staff> {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const result = await query("INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role", [data.username, data.email || "", passwordHash, data.role || "admin"]);
  return result.rows[0] as Staff;
}

async function updateStaffRole(id: number, role: string): Promise<void> {
  await query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
}

async function changeStaffPassword(id: number, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, id]);
}

async function deleteStaff(id: number): Promise<boolean> {
  const result = await query("DELETE FROM users WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function findAdminByUsername(username: string): Promise<StaffWithPassword | undefined> {
  return await findStaffByUsername(username);
}

async function findCustomerByEmail(email: string): Promise<CustomerWithPassword | undefined> {
  return await queryOne("SELECT * FROM customers WHERE email = $1", [email]) as CustomerWithPassword | undefined;
}

async function findCustomerById(id: number): Promise<Customer | undefined> {
  return await queryOne("SELECT id, name, email, phone, is_active, last_login, created_at FROM customers WHERE id = $1", [id]) as Customer | undefined;
}

async function updateCustomerLastLogin(id: number): Promise<void> {
  await query("UPDATE customers SET last_login = NOW()::text WHERE id = $1", [id]);
}

async function updateCustomerStatus(id: number, isActive: boolean): Promise<void> {
  await query("UPDATE customers SET is_active = $1 WHERE id = $2", [isActive ? 1 : 0, id]);
}

async function deleteCustomer(id: number): Promise<boolean> {
  const result = await query("DELETE FROM customers WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function deactivateOldCustomers(daysInactive: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - daysInactive * 86400000).toISOString();
  const result = await query("UPDATE customers SET is_active = 0 WHERE is_active = 1 AND last_login < $1", [cutoff]);
  return result.rowCount ?? 0;
}

async function createCustomer(data: { name: string; email: string; password?: string; phone?: string }): Promise<Customer> {
  let passwordHash = "";
  if (data.password) passwordHash = await bcrypt.hash(data.password, 10);
  const result = await query("INSERT INTO customers (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, is_active, last_login, created_at", [data.name, data.email, passwordHash, data.phone || ""]);
  return result.rows[0] as Customer;
}

async function getCartItems(customerId: number): Promise<CartItem[]> {
  const rows = await queryAll(
    `SELECT c.product_id AS "productId", c.quantity, p.name, p.price, p.in_stock AS "inStock", p.image_url AS "imageUrl", p.image_alt AS "imageAlt", p.has_warranty AS "hasWarranty", p.warranty_duration AS "warrantyDuration"
     FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.customer_id = $1 ORDER BY c.created_at`,
    [customerId]
  ) as any[];
  return rows.map((r) => ({ ...r, inStock: Boolean(r.inStock), hasWarranty: Boolean(r.hasWarranty), lineTotal: r.price * r.quantity }));
}

async function getCartCount(customerId: number): Promise<number> {
  const row = await queryOne("SELECT COALESCE(SUM(quantity), 0) AS count FROM cart_items WHERE customer_id = $1", [customerId]) as any;
  return Number(row?.count || 0);
}

async function addToCart(customerId: number, productId: string, quantity: number = 1): Promise<void> {
  await query(
    `INSERT INTO cart_items (customer_id, product_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (customer_id, product_id) DO UPDATE SET quantity = cart_items.quantity + $3`,
    [customerId, productId, quantity]
  );
}

async function setCartQuantity(customerId: number, productId: string, quantity: number): Promise<void> {
  if (quantity <= 0) { await removeFromCart(customerId, productId); return; }
  await query("UPDATE cart_items SET quantity = $1 WHERE customer_id = $2 AND product_id = $3", [quantity, customerId, productId]);
}

async function removeFromCart(customerId: number, productId: string): Promise<void> {
  await query("DELETE FROM cart_items WHERE customer_id = $1 AND product_id = $2", [customerId, productId]);
}

async function clearCart(customerId: number): Promise<void> {
  await query("DELETE FROM cart_items WHERE customer_id = $1", [customerId]);
}

async function getStockLevel(productId: string): Promise<StockLevel | undefined> {
  return await queryOne("SELECT * FROM stock_levels WHERE product_id = $1", [productId]) as StockLevel | undefined;
}

async function updateStockLevel(productId: string, quantityInStock: number): Promise<void> {
  await query(
    `INSERT INTO stock_levels (product_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold) VALUES ($1, $2, 0, 0, 5)
     ON CONFLICT (product_id) DO UPDATE SET quantity_in_stock = EXCLUDED.quantity_in_stock, updated_at = NOW()::text`,
    [productId, quantityInStock]
  );
}

async function recordStockMovement(productId: string, movementType: string, quantity: number, referenceType?: string, referenceId?: string, notes?: string, createdBy?: number): Promise<void> {
  await query(
    "INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [productId, movementType, quantity, referenceType || null, referenceId || null, notes || null, createdBy || null]
  );
}

async function getStockMovements(productId: string): Promise<StockMovement[]> {
  return await queryAll("SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC", [productId]) as StockMovement[];
}

async function getLowStockItems(): Promise<LowStockItem[]> {
  const rows = await queryAll(
    `SELECT s.product_id AS "productId", p.name, p.price, s.quantity_in_stock AS "quantityInStock", s.low_stock_threshold AS "lowStockThreshold"
     FROM stock_levels s JOIN products p ON p.id = s.product_id WHERE s.quantity_in_stock <= s.low_stock_threshold ORDER BY s.quantity_in_stock ASC`
  ) as any[];
  return rows;
}

async function createStockTransfer(data: { fromBranchId: number; toBranchId: number; productId: string; quantity: number; notes?: string; createdBy?: number }): Promise<StockTransfer> {
  const result = await query(
    "INSERT INTO stock_transfers (from_branch_id, to_branch_id, product_id, quantity, status, notes, created_by) VALUES ($1, $2, $3, $4, 'pending', $5, $6) RETURNING *",
    [data.fromBranchId, data.toBranchId, data.productId, data.quantity, data.notes || null, data.createdBy || null]
  );
  return result.rows[0] as StockTransfer;
}

async function getStockTransfer(id: number): Promise<StockTransfer | undefined> {
  return await queryOne("SELECT * FROM stock_transfers WHERE id = $1", [id]) as StockTransfer | undefined;
}

async function listStockTransfers(): Promise<StockTransfer[]> {
  return await queryAll("SELECT * FROM stock_transfers ORDER BY created_at DESC") as StockTransfer[];
}

async function completeStockTransfer(id: number): Promise<boolean> {
  const result = await query("UPDATE stock_transfers SET status = 'completed', completed_at = NOW()::text WHERE id = $1 AND status = 'pending'", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function rejectStockTransfer(id: number): Promise<boolean> {
  const result = await query("UPDATE stock_transfers SET status = 'rejected' WHERE id = $1 AND status = 'pending'", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function ensureDefaultSubscriptionPlans(): Promise<void> {
  const row = await queryOne("SELECT COUNT(*) AS count FROM subscription_plans") as any;
  if (row && Number(row.count) > 0) return;
  const plans = [
    { id: "starter", name: "Starter", description: "Perfect for small shops", price: 0, tier_level: 1, max_products: 50, max_branches: 1, features: JSON.stringify(["Up to 50 products", "1 branch", "Basic support"]) },
    { id: "growth", name: "Growth", description: "For growing businesses", price: 2500, tier_level: 2, max_products: 500, max_branches: 3, features: JSON.stringify(["Up to 500 products", "3 branches", "Priority support", "Analytics"]) },
    { id: "pro", name: "Pro", description: "For established shops", price: 5000, tier_level: 3, max_products: null, max_branches: 10, features: JSON.stringify(["Unlimited products", "10 branches", "Premium support", "Advanced analytics", "Custom branding"]) },
    { id: "enterprise", name: "Enterprise", description: "Custom solutions", price: 15000, tier_level: 4, max_products: null, max_branches: 999, features: JSON.stringify(["Unlimited everything", "Dedicated support", "Custom integrations"]) },
  ];
  for (const p of plans) {
    await query("INSERT INTO subscription_plans (id, name, description, price, tier_level, max_products, max_branches, features) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [p.id, p.name, p.description, p.price, p.tier_level, p.max_products, p.max_branches, p.features]);
  }
}

async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const rows = await queryAll("SELECT * FROM subscription_plans ORDER BY tier_level") as any[];
  return rows.map(mapPlan);
}

async function getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
  const row = await queryOne("SELECT * FROM subscription_plans WHERE id = $1", [id]) as any;
  return row ? mapPlan(row) : undefined;
}

async function createSubscriptionPlan(plan: Omit<SubscriptionPlan, "id"> & { id?: string }): Promise<SubscriptionPlan> {
  const id = plan.id || slugify(plan.name);
  await query("INSERT INTO subscription_plans (id, name, description, price, tier_level, max_products, max_branches, features) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [id, plan.name, plan.description, plan.price, plan.tierLevel, plan.maxProducts, plan.maxBranches, JSON.stringify(plan.features)]);
  return (await getSubscriptionPlan(id))!;
}

async function updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
  const existing = await getSubscriptionPlan(id);
  if (!existing) return undefined;
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (updates.name !== undefined) { fields.push(`name = $${idx}`); params.push(updates.name); idx++; }
  if (updates.description !== undefined) { fields.push(`description = $${idx}`); params.push(updates.description); idx++; }
  if (updates.price !== undefined) { fields.push(`price = $${idx}`); params.push(updates.price); idx++; }
  if (updates.tierLevel !== undefined) { fields.push(`tier_level = $${idx}`); params.push(updates.tierLevel); idx++; }
  if (updates.maxProducts !== undefined) { fields.push(`max_products = $${idx}`); params.push(updates.maxProducts); idx++; }
  if (updates.maxBranches !== undefined) { fields.push(`max_branches = $${idx}`); params.push(updates.maxBranches); idx++; }
  if (updates.features !== undefined) { fields.push(`features = $${idx}`); params.push(JSON.stringify(updates.features)); idx++; }
  if (fields.length === 0) return existing;
  params.push(id);
  await query(`UPDATE subscription_plans SET ${fields.join(", ")} WHERE id = $${idx}`, params);
  return await getSubscriptionPlan(id);
}

async function deleteSubscriptionPlan(id: string): Promise<boolean> {
  const result = await query("DELETE FROM subscription_plans WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function listBranches(): Promise<Branch[]> {
  const rows = await queryAll("SELECT b.*, u.username AS manager_username FROM branches b LEFT JOIN users u ON u.id = b.manager_id ORDER BY b.name") as any[];
  return rows.map(mapBranch);
}

async function getBranch(id: number): Promise<Branch | undefined> {
  const row = await queryOne("SELECT b.*, u.username AS manager_username FROM branches b LEFT JOIN users u ON u.id = b.manager_id WHERE b.id = $1", [id]) as any;
  return row ? mapBranch(row) : undefined;
}

async function createBranch(data: { name: string; address?: string; phone?: string; email?: string; managerId?: number; isActive?: boolean }): Promise<Branch> {
  const result = await query("INSERT INTO branches (name, address, phone, email, manager_id, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [data.name, data.address || "", data.phone || "", data.email || "", data.managerId || null, data.isActive !== false ? 1 : 0]);
  return (await getBranch(result.rows[0].id))!;
}

async function updateBranch(id: number, updates: Partial<{ name: string; address: string; phone: string; email: string; managerId: number; isActive: boolean }>): Promise<Branch | null> {
  const existing = await getBranch(id);
  if (!existing) return null;
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (updates.name !== undefined) { fields.push(`name = $${idx}`); params.push(updates.name); idx++; }
  if (updates.address !== undefined) { fields.push(`address = $${idx}`); params.push(updates.address); idx++; }
  if (updates.phone !== undefined) { fields.push(`phone = $${idx}`); params.push(updates.phone); idx++; }
  if (updates.email !== undefined) { fields.push(`email = $${idx}`); params.push(updates.email); idx++; }
  if (updates.managerId !== undefined) { fields.push(`manager_id = $${idx}`); params.push(updates.managerId); idx++; }
  if (updates.isActive !== undefined) { fields.push(`is_active = $${idx}`); params.push(updates.isActive ? 1 : 0); idx++; }
  if (fields.length === 0) return existing;
  params.push(id);
  await query(`UPDATE branches SET ${fields.join(", ")} WHERE id = $${idx}`, params);
  return await getBranch(id);
}

async function deleteBranch(id: number): Promise<boolean> {
  const result = await query("DELETE FROM branches WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function getBranchCount(): Promise<number> {
  const row = await queryOne("SELECT COUNT(*) AS count FROM branches") as any;
  return Number(row?.count || 0);
}

async function getMaxBranchesForShop(): Promise<number | null> {
  const settings = await getSettings();
  const planRow = await queryOne("SELECT sp.max_branches FROM settings s JOIN subscription_plans sp ON sp.id = s.value WHERE s.key = 'shop_plan_id'") as any;
  return planRow ? Number(planRow.max_branches) : null;
}

async function canCreateBranch(): Promise<boolean> {
  const max = await getMaxBranchesForShop();
  if (max === null) return true;
  const current = await getBranchCount();
  return current < max;
}

async function listClients(): Promise<Client[]> {
  const rows = await queryAll("SELECT * FROM clients ORDER BY created_at DESC") as any[];
  return rows.map(mapClient);
}

async function getClient(id: number): Promise<Client | undefined> {
  const row = await queryOne("SELECT * FROM clients WHERE id = $1", [id]) as any;
  return row ? mapClient(row) : undefined;
}

async function createClient(data: { name: string; email: string; phone?: string; address?: string; settings?: string }): Promise<Client> {
  const result = await query("INSERT INTO clients (name, email, phone, address, settings) VALUES ($1, $2, $3, $4, $5) RETURNING id", [data.name, data.email, data.phone || "", data.address || "", data.settings || "{}"]);
  return (await getClient(result.rows[0].id))!;
}

async function updateClient(id: number, updates: Partial<{ name: string; email: string; phone: string; address: string; settings: string; isActive: boolean }>): Promise<Client | null> {
  const existing = await getClient(id);
  if (!existing) return null;
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (updates.name !== undefined) { fields.push(`name = $${idx}`); params.push(updates.name); idx++; }
  if (updates.email !== undefined) { fields.push(`email = $${idx}`); params.push(updates.email); idx++; }
  if (updates.phone !== undefined) { fields.push(`phone = $${idx}`); params.push(updates.phone); idx++; }
  if (updates.address !== undefined) { fields.push(`address = $${idx}`); params.push(updates.address); idx++; }
  if (updates.settings !== undefined) { fields.push(`settings = $${idx}`); params.push(updates.settings); idx++; }
  if (updates.isActive !== undefined) { fields.push(`is_active = $${idx}`); params.push(updates.isActive ? 1 : 0); idx++; }
  fields.push(`updated_at = NOW()::text`);
  if (fields.length === 1) return existing;
  params.push(id);
  await query(`UPDATE clients SET ${fields.join(", ")} WHERE id = $${idx}`, params);
  return await getClient(id);
}

async function deleteClient(id: number): Promise<boolean> {
  const result = await query("DELETE FROM clients WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function listClientBranches(clientId: number): Promise<Branch[]> {
  return await queryAll("SELECT * FROM client_branches WHERE client_id = $1 ORDER BY name", [clientId]) as Branch[];
}

async function getClientBranch(clientId: number, branchId: number): Promise<Branch | undefined> {
  return await queryOne("SELECT * FROM client_branches WHERE client_id = $1 AND id = $2", [clientId, branchId]) as Branch | undefined;
}

async function createClientBranch(clientId: number, data: { name: string; address?: string; phone?: string; email?: string }): Promise<Branch> {
  const result = await query("INSERT INTO client_branches (client_id, name, address, phone, email) VALUES ($1, $2, $3, $4, $5) RETURNING *", [clientId, data.name, data.address || "", data.phone || "", data.email || ""]);
  return result.rows[0] as Branch;
}

async function updateClientBranch(clientId: number, branchId: number, updates: Partial<{ name: string; address: string; phone: string; email: string }>): Promise<Branch | null> {
  const existing = await getClientBranch(clientId, branchId);
  if (!existing) return null;
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (updates.name !== undefined) { fields.push(`name = $${idx}`); params.push(updates.name); idx++; }
  if (updates.address !== undefined) { fields.push(`address = $${idx}`); params.push(updates.address); idx++; }
  if (updates.phone !== undefined) { fields.push(`phone = $${idx}`); params.push(updates.phone); idx++; }
  if (updates.email !== undefined) { fields.push(`email = $${idx}`); params.push(updates.email); idx++; }
  if (fields.length === 0) return existing;
  params.push(clientId, branchId);
  await query(`UPDATE client_branches SET ${fields.join(", ")} WHERE client_id = $${idx} AND id = $${idx + 1}`, params);
  return await getClientBranch(clientId, branchId);
}

async function deleteClientBranch(clientId: number, branchId: number): Promise<boolean> {
  const result = await query("DELETE FROM client_branches WHERE client_id = $1 AND id = $2", [clientId, branchId]);
  return (result.rowCount ?? 0) > 0;
}

async function findProviderByEmail(email: string): Promise<ProviderWithPassword | undefined> {
  return await queryOne("SELECT * FROM providers WHERE email = $1", [email]) as ProviderWithPassword | undefined;
}

async function findProviderById(id: number): Promise<Provider | undefined> {
  return await queryOne(`SELECT id, company_name AS "companyName", contact_name AS "contactName", email, phone, status, CASE WHEN pin_hash != '' THEN true ELSE false END AS "hasPin" FROM providers WHERE id = $1`, [id]) as Provider | undefined;
}

async function listProviders(): Promise<Provider[]> {
  const rows = await queryAll("SELECT id, company_name AS \"companyName\", contact_name AS \"contactName\", email, phone, status, CASE WHEN pin_hash != '' THEN true ELSE false END AS \"hasPin\" FROM providers ORDER BY company_name") as Provider[];
  return rows;
}

async function createProvider(data: { companyName: string; contactName: string; email: string; phone: string; password: string }): Promise<Provider> {
  const hash = await bcrypt.hash(data.password, 10);
  const result = await query("INSERT INTO providers (company_name, contact_name, email, phone, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, company_name, contact_name, email, phone, status", [data.companyName, data.contactName, data.email, data.phone, hash]);
  return result.rows[0] as Provider;
}

async function verifyProviderPin(providerId: number, pin: string): Promise<boolean> {
  const row = await queryOne("SELECT pin_hash FROM providers WHERE id = $1", [providerId]) as any;
  if (!row || !row.pin_hash) return false;
  return bcrypt.compare(pin, row.pin_hash);
}

async function updateProviderStatus(id: number, status: string): Promise<void> {
  await query("UPDATE providers SET status = $1 WHERE id = $2", [status, id]);
}

async function updateProvider(id: number, updates: Partial<{ companyName: string; contactName: string; email: string; phone: string; password: string; pin: string }>): Promise<void> {
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (updates.companyName !== undefined) { fields.push(`company_name = $${idx}`); params.push(updates.companyName); idx++; }
  if (updates.contactName !== undefined) { fields.push(`contact_name = $${idx}`); params.push(updates.contactName); idx++; }
  if (updates.email !== undefined) { fields.push(`email = $${idx}`); params.push(updates.email); idx++; }
  if (updates.phone !== undefined) { fields.push(`phone = $${idx}`); params.push(updates.phone); idx++; }
  if (updates.password !== undefined) { fields.push(`password_hash = $${idx}`); params.push(await bcrypt.hash(updates.password, 10)); idx++; }
  if (updates.pin !== undefined) { fields.push(`pin_hash = $${idx}`); params.push(await bcrypt.hash(updates.pin, 10)); idx++; }
  if (fields.length === 0) return;
  params.push(id);
  await query(`UPDATE providers SET ${fields.join(", ")} WHERE id = $${idx}`, params);
}

async function getProviderSubscription(providerId: number): Promise<ProviderPlanAssignment | undefined> {
  const row = await queryOne(
    `SELECT ppa.*, sp.name AS plan_name FROM provider_plan_assignments ppa
     JOIN subscription_plans sp ON sp.id = ppa.plan_id
     WHERE ppa.provider_id = $1 AND ppa.status = 'active' ORDER BY ppa.start_date DESC LIMIT 1`, [providerId]
  ) as any;
  if (!row) return undefined;
  return { id: row.id, providerId: row.provider_id, planId: row.plan_id, planName: row.plan_name, customPrice: row.custom_price, startDate: row.start_date, endDate: row.end_date, status: row.status, notes: row.notes };
}

async function assignPlanToProvider(providerId: number, planId: string, customPrice?: number): Promise<ProviderPlanAssignment> {
  await query("UPDATE provider_plan_assignments SET status = 'inactive', end_date = NOW()::text WHERE provider_id = $1 AND status = 'active'", [providerId]);
  const result = await query(
    "INSERT INTO provider_plan_assignments (provider_id, plan_id, custom_price, status, start_date) VALUES ($1, $2, $3, 'active', $4) RETURNING id",
    [providerId, planId, customPrice || null, new Date().toISOString().slice(0, 10)]
  );
  const assignment = await getProviderSubscription(providerId);
  return assignment!;
}

async function getProviderAssignmentHistory(providerId: number): Promise<ProviderPlanAssignment[]> {
  const rows = await queryAll(
    `SELECT ppa.*, sp.name AS plan_name FROM provider_plan_assignments ppa
     JOIN subscription_plans sp ON sp.id = ppa.plan_id WHERE ppa.provider_id = $1 ORDER BY ppa.start_date DESC`, [providerId]
  ) as any[];
  return rows.map((row) => ({ id: row.id, providerId: row.provider_id, planId: row.plan_id, planName: row.plan_name, customPrice: row.custom_price, startDate: row.start_date, endDate: row.end_date, status: row.status, notes: row.notes }));
}

async function getWishlist(customerId: number): Promise<WishlistItem[]> {
  const rows = await queryAll(
    `SELECT w.*, p.name AS "productName", p.price AS "productPrice", p.image_url AS "productImage"
     FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.customer_id = $1 ORDER BY w.created_at DESC`, [customerId]
  ) as any[];
  return rows.map((r) => ({ id: r.id, customerId: r.customer_id, productId: r.product_id, notes: r.notes, createdAt: r.created_at, productName: r.productName, productPrice: r.productPrice, productImage: r.productImage }));
}

async function addToWishlist(customerId: number, productId: string, notes?: string): Promise<WishlistItem> {
  const result = await query("INSERT INTO wishlist (customer_id, product_id, notes) VALUES ($1, $2, $3) ON CONFLICT (customer_id, product_id) DO UPDATE SET notes = $3 RETURNING *", [customerId, productId, notes || ""]);
  return result.rows[0] as WishlistItem;
}

async function removeFromWishlist(customerId: number, productId: string): Promise<boolean> {
  const result = await query("DELETE FROM wishlist WHERE customer_id = $1 AND product_id = $2", [customerId, productId]);
  return (result.rowCount ?? 0) > 0;
}

async function isInWishlist(customerId: number, productId: string): Promise<boolean> {
  const row = await queryOne("SELECT 1 FROM wishlist WHERE customer_id = $1 AND product_id = $2", [customerId, productId]);
  return Boolean(row);
}

async function generateQuoteNumber(): Promise<string> {
  const row = await queryOne("SELECT COUNT(*) AS count FROM quotes") as any;
  const num = Number(row?.count || 0) + 1;
  return `Q-${String(num).padStart(5, "0")}`;
}

async function createQuoteFromWishlist(customerId: number, wishlistIds: number[]): Promise<Quote> {
  const quoteNumber = await generateQuoteNumber();
  const result = await query("INSERT INTO quotes (customer_id, quote_number, status) VALUES ($1, $2, 'draft') RETURNING id", [customerId, quoteNumber]);
  const quoteId = result.rows[0].id;
  const items = await queryAll("SELECT w.product_id, p.name, p.price FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.id = ANY($1)", [wishlistIds]) as any[];
  for (const item of items) {
    await query("INSERT INTO quote_items (quote_id, product_id, product_name, quantity, unit_price, line_total) VALUES ($1, $2, $3, 1, $4, $4)", [quoteId, item.product_id, item.name, item.price]);
  }
  return (await getQuote(quoteId))!;
}

async function createQuote(data: { customerId: number; items: { productId: string; productName: string; quantity: number; unitPrice: number }[]; notes?: string }): Promise<Quote> {
  const quoteNumber = await generateQuoteNumber();
  const total = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const result = await query("INSERT INTO quotes (customer_id, quote_number, status, notes, total) VALUES ($1, $2, 'draft', $3, $4) RETURNING id", [data.customerId, quoteNumber, data.notes || "", total]);
  const quoteId = result.rows[0].id;
  for (const item of data.items) {
    await query("INSERT INTO quote_items (quote_id, product_id, product_name, quantity, unit_price, line_total) VALUES ($1, $2, $3, $4, $5, $6)", [quoteId, item.productId, item.productName, item.quantity, item.unitPrice, item.quantity * item.unitPrice]);
  }
  return (await getQuote(quoteId))!;
}

async function getQuote(id: number): Promise<Quote | undefined> {
  const row = await queryOne("SELECT * FROM quotes WHERE id = $1", [id]) as any;
  if (!row) return undefined;
  const items = await queryAll("SELECT * FROM quote_items WHERE quote_id = $1", [id]) as any[];
  return { id: row.id, customerId: row.customer_id, quoteNumber: row.quote_number, status: row.status, notes: row.notes, total: row.total, createdAt: row.created_at, updatedAt: row.updated_at, items: items.map((i) => ({ id: i.id, quoteId: i.quote_id, productId: i.product_id, productName: i.product_name, quantity: i.quantity, unitPrice: i.unit_price, lineTotal: i.line_total })) };
}

async function listQuotesForCustomer(customerId: number): Promise<Quote[]> {
  const rows = await queryAll("SELECT * FROM quotes WHERE customer_id = $1 ORDER BY created_at DESC", [customerId]) as any[];
  const quotes: Quote[] = [];
  for (const row of rows) { const q = await getQuote(row.id); if (q) quotes.push(q); }
  return quotes;
}

async function updateQuoteStatus(id: number, status: string): Promise<boolean> {
  const result = await query("UPDATE quotes SET status = $1, updated_at = NOW()::text WHERE id = $2", [status, id]);
  return (result.rowCount ?? 0) > 0;
}

async function listAllQuotes(): Promise<Quote[]> {
  const rows = await queryAll("SELECT * FROM quotes ORDER BY created_at DESC") as any[];
  const quotes: Quote[] = [];
  for (const row of rows) { const q = await getQuote(row.id); if (q) quotes.push(q); }
  return quotes;
}

async function validateCoupon(code: string, subtotal: number): Promise<{ valid: boolean; discount: number; couponId?: number }> {
  const coupon = await queryOne("SELECT * FROM coupons WHERE code = $1 AND is_active = 1", [code]) as any;
  if (!coupon) return { valid: false, discount: 0 };
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { valid: false, discount: 0 };
  if (coupon.min_order && subtotal < coupon.min_order) return { valid: false, discount: 0 };
  if (coupon.max_uses && coupon.usage_count >= coupon.max_uses) return { valid: false, discount: 0 };
  const discount = coupon.discount_type === "percentage" ? subtotal * (coupon.discount_value / 100) : Math.min(coupon.discount_value, subtotal);
  return { valid: true, discount, couponId: coupon.id };
}

async function listCoupons(): Promise<any[]> {
  return await queryAll("SELECT * FROM coupons ORDER BY created_at DESC") as any[];
}

async function getCoupon(id: number): Promise<any | undefined> {
  return await queryOne("SELECT * FROM coupons WHERE id = $1", [id]) as any;
}

async function createCoupon(data: { code: string; discountType: string; discountValue: number; minOrder?: number; maxUses?: number; validUntil?: string }): Promise<any> {
  const result = await query("INSERT INTO coupons (code, discount_type, discount_value, min_order, max_uses, valid_until) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [data.code, data.discountType, data.discountValue, data.minOrder || 0, data.maxUses || null, data.validUntil || null]);
  return result.rows[0];
}

async function updateCoupon(id: number, updates: Partial<{ code: string; discountType: string; discountValue: number; minOrder: number; maxUses: number; validUntil: string; isActive: boolean }>): Promise<any> {
  const fields: string[] = []; const params: any[] = []; let idx = 1;
  if (updates.code !== undefined) { fields.push(`code = $${idx}`); params.push(updates.code); idx++; }
  if (updates.discountType !== undefined) { fields.push(`discount_type = $${idx}`); params.push(updates.discountType); idx++; }
  if (updates.discountValue !== undefined) { fields.push(`discount_value = $${idx}`); params.push(updates.discountValue); idx++; }
  if (updates.minOrder !== undefined) { fields.push(`min_order = $${idx}`); params.push(updates.minOrder); idx++; }
  if (updates.maxUses !== undefined) { fields.push(`max_uses = $${idx}`); params.push(updates.maxUses); idx++; }
  if (updates.validUntil !== undefined) { fields.push(`valid_until = $${idx}`); params.push(updates.validUntil); idx++; }
  if (updates.isActive !== undefined) { fields.push(`is_active = $${idx}`); params.push(updates.isActive ? 1 : 0); idx++; }
  if (fields.length === 0) return await getCoupon(id);
  params.push(id);
  await query(`UPDATE coupons SET ${fields.join(", ")} WHERE id = $${idx}`, params);
  return await getCoupon(id);
}

async function deleteCoupon(id: number): Promise<boolean> {
  const result = await query("DELETE FROM coupons WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function recordCouponUsage(couponId: number, orderId: number): Promise<void> {
  await query("UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1", [couponId]);
}

async function createOrder(data: { customerId: number; customerName: string; customerEmail: string; shippingName: string; shippingAddress: string; shippingCity: string; shippingCounty: string; shippingPostcode: string; shippingPhone: string; shippingFee: number; notes?: string; items: { productId: string; name: string; price: number; quantity: number; hasWarranty?: boolean; warrantyDuration?: number; taxable?: boolean }[]; couponId?: number; discountAmount?: number; staffId?: number; branchId?: number; processedBy?: string; idempotencyKey?: string }): Promise<Order> {
  const subtotal = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const result = await query(
    `INSERT INTO orders (customer_id, customer_name, customer_email, status, shipping_name, shipping_address, shipping_city, shipping_county, shipping_postcode, shipping_phone, shipping_fee, notes, subtotal, coupon_id, discount_amount, staff_id, branch_id, processed_by, idempotency_key)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
    [data.customerId, data.customerName, data.customerEmail, data.shippingName, data.shippingAddress, data.shippingCity, data.shippingCounty, data.shippingPostcode, data.shippingPhone, data.shippingFee, data.notes || "", subtotal, data.couponId || null, data.discountAmount || 0, data.staffId || null, data.branchId || null, data.processedBy || null, data.idempotencyKey || null]
  );
  const orderId = result.rows[0].id;
  for (const item of data.items) {
    await query("INSERT INTO order_items (order_id, product_id, name, price, quantity, has_warranty, warranty_duration, taxable) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [orderId, item.productId, item.name, item.price, item.quantity, item.hasWarranty ? 1 : 0, item.warrantyDuration || 0, item.taxable !== false ? 1 : 0]);
  }
  return (await getOrder(orderId))!;
}

async function getOrder(id: number): Promise<Order | undefined> {
  const row = await queryOne("SELECT * FROM orders WHERE id = $1", [id]) as any;
  if (!row) return undefined;
  const items = await queryAll("SELECT * FROM order_items WHERE order_id = $1", [id]) as any[];
  return {
    id: row.id, customerId: row.customer_id, customerName: row.customer_name, customerEmail: row.customer_email, status: row.status, shippingName: row.shipping_name, shippingAddress: row.shipping_address, shippingCity: row.shipping_city, shippingCounty: row.shipping_county, shippingPostcode: row.shipping_postcode, shippingPhone: row.shipping_phone, shippingFee: row.shipping_fee, notes: row.notes, subtotal: row.subtotal, createdAt: row.created_at, updatedAt: row.updated_at, branchId: row.branch_id, couponId: row.coupon_id, discountAmount: row.discount_amount, processedBy: row.processed_by, idempotencyKey: row.idempotency_key,
    items: items.map((i) => ({ id: i.id, orderId: i.order_id, productId: i.product_id, name: i.name, price: i.price, quantity: i.quantity, lineTotal: i.price * i.quantity, hasWarranty: i.has_warranty, warrantyDuration: i.warranty_duration })),
  };
}

async function updateOrderItemWarranty(orderId: number, orderItemId: number, hasWarranty: boolean, warrantyDuration: number): Promise<void> {
  await query("UPDATE order_items SET has_warranty = $1, warranty_duration = $2 WHERE id = $3 AND order_id = $4", [hasWarranty ? 1 : 0, warrantyDuration, orderItemId, orderId]);
}

async function listOrders(customerId?: number): Promise<Order[]> {
  let sql = "SELECT id FROM orders"; const params: any[] = [];
  if (customerId) { sql += " WHERE customer_id = $1"; params.push(customerId); }
  sql += " ORDER BY created_at DESC";
  const rows = await queryAll(sql, params) as { id: number }[];
  const orders: Order[] = [];
  for (const row of rows) { const o = await getOrder(row.id); if (o) orders.push(o); }
  return orders;
}

async function updateOrderStatus(id: number, status: string): Promise<boolean> {
  const result = await query("UPDATE orders SET status = $1, updated_at = NOW()::text WHERE id = $2", [status, id]);
  return (result.rowCount ?? 0) > 0;
}

async function recordProductView(productId: string, viewerType: string): Promise<void> {
  await query("INSERT INTO product_views (product_id, viewer_type) VALUES ($1, $2)", [productId, viewerType]);
}

async function getPopularProducts(limit?: number): Promise<{ productId: string; name: string; views: number }[]> {
  return await queryAll(
    `SELECT pv.product_id AS "productId", p.name, COUNT(*) AS views
     FROM product_views pv JOIN products p ON p.id = pv.product_id
     GROUP BY pv.product_id, p.name ORDER BY views DESC LIMIT $1`, [limit || 10]
  ) as any[];
}

async function getTotalViews(): Promise<number> {
  const row = await queryOne("SELECT COUNT(*) AS count FROM product_views") as any;
  return Number(row?.count || 0);
}

async function createInvoice(data: { providerId: number; planId: string; amount: number; currency: string; periodStart: string; periodEnd: string }): Promise<Invoice> {
  const result = await query(
    "INSERT INTO invoices (provider_id, plan_id, amount, currency, period_start, period_end) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [data.providerId, data.planId, data.amount, data.currency, data.periodStart, data.periodEnd]
  );
  const row = result.rows[0];
  return { id: row.id, providerId: row.provider_id, planId: row.plan_id, planName: "", amount: row.amount, currency: row.currency, status: row.status, periodStart: row.period_start, periodEnd: row.period_end, paidAt: row.paid_at, createdAt: row.created_at };
}

async function getInvoice(id: number): Promise<Invoice | undefined> {
  const row = await queryOne(
    `SELECT i.*, sp.name AS plan_name FROM invoices i LEFT JOIN subscription_plans sp ON sp.id = i.plan_id WHERE i.id = $1`, [id]
  ) as any;
  if (!row) return undefined;
  return { id: row.id, providerId: row.provider_id, planId: row.plan_id, planName: row.plan_name || "", amount: row.amount, currency: row.currency, status: row.status, periodStart: row.period_start, periodEnd: row.period_end, paidAt: row.paid_at, createdAt: row.created_at };
}

async function listInvoices(providerId?: number): Promise<Invoice[]> {
  let sql = "SELECT i.id FROM invoices i";
  const params: any[] = [];
  if (providerId) { sql += " WHERE i.provider_id = $1"; params.push(providerId); }
  sql += " ORDER BY i.created_at DESC";
  const rows = await queryAll(sql, params) as { id: number }[];
  const invoices: Invoice[] = [];
  for (const row of rows) { const inv = await getInvoice(row.id); if (inv) invoices.push(inv); }
  return invoices;
}

async function markInvoicePaid(id: number): Promise<boolean> {
  const result = await query("UPDATE invoices SET status = 'paid', paid_at = NOW()::text WHERE id = $1 AND status = 'pending'", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function generateProviderInvoice(providerId: number, planId: string): Promise<Invoice | null> {
  const plan = await getSubscriptionPlan(planId);
  if (!plan) return null;
  const now = new Date();
  const periodStart = now.toISOString().slice(0, 10);
  const periodEnd = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  return await createInvoice({ providerId, planId: plan.id, amount: plan.price, currency: "KES", periodStart, periodEnd });
}

async function getInvoiceRevenue(): Promise<{ total: number; paid: number; pending: number }> {
  const rows = await queryAll("SELECT status, amount FROM invoices") as any[];
  let total = 0, paid = 0, pending = 0;
  for (const row of rows) {
    total += row.amount;
    if (row.status === "paid") paid += row.amount;
    else if (row.status === "pending") pending += row.amount;
  }
  return { total, paid, pending };
}

async function getEtimsMode(): Promise<string> {
  const row = await queryOne("SELECT value FROM settings WHERE key = 'etims_mode'") as any;
  return row?.value || "off";
}

async function generateEtimsInvoiceNumber(): Promise<string> {
  const last = await queryOne("SELECT value FROM settings WHERE key = 'etims_last_serial'") as any;
  const serial = last ? Number(last.value) + 1 : 1;
  await setStoreSetting("etims_last_serial", String(serial));
  const branchId = await getStoreSetting("etims_branch_id") || "00";
  const prefix = await getStoreSetting("etims_serial_prefix") || "01";
  return `${prefix}${branchId}-${serial}`;
}

async function createEtimsSalesTransaction(data: { invoiceNumber: string; items: { name: string; quantity: number; unitPrice: number; taxAmount: number }[]; totalTax: number; totalAmount: number; paymentType: string }): Promise<any> {
  const mode = await getEtimsMode();
  if (mode === "off") return { success: true, mode: "off" };
  return { success: true, mode, invoiceNumber: data.invoiceNumber, submitted: false };
}

async function createOrderInvoice(orderId: number): Promise<OrderInvoice> {
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");
  const settings = await getSettings();
  const result = await query(
    "INSERT INTO order_invoices (order_id, amount, currency, status) VALUES ($1, $2, $3, 'pending') RETURNING *",
    [orderId, order.subtotal + order.shippingFee, settings.currency]
  );
  const row = result.rows[0];
  return { id: row.id, orderId: row.order_id, amount: row.amount, currency: row.currency, status: row.status, createdAt: row.created_at };
}

async function listOrderInvoices(orderId?: number): Promise<OrderInvoice[]> {
  let sql = "SELECT * FROM order_invoices"; const params: any[] = [];
  if (orderId) { sql += " WHERE order_id = $1"; params.push(orderId); }
  sql += " ORDER BY created_at DESC";
  const rows = await queryAll(sql, params) as any[];
  return rows.map((r) => ({ id: r.id, orderId: r.order_id, amount: r.amount, currency: r.currency, status: r.status, createdAt: r.created_at, etimsInvoiceNumber: r.etims_invoice_number, controlCode: r.control_code, kraPin: r.kra_pin, serialNumber: r.serial_number, internalData: r.internal_data, signatureData: r.signature_data, receiptDate: r.receipt_date, receiptCounter: r.receipt_counter, totalReceipts: r.total_receipts, taxType: r.tax_type, paymentType: r.payment_type }));
}

async function markOrderInvoicePaid(id: number): Promise<boolean> {
  const result = await query("UPDATE order_invoices SET status = 'paid' WHERE id = $1 AND status = 'pending'", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function createCreditNote(data: { orderId: number; reason: string; reasonCode?: string; createdBy: number; items: { orderItemId: number; productId: string; name: string; price: number; quantity: number }[] }): Promise<CreditNote> {
  const totalAmount = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const result = await query(
    "INSERT INTO credit_notes (order_id, total_amount, reason, reason_code, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [data.orderId, totalAmount, data.reason, data.reasonCode || "13", data.createdBy]
  );
  const creditNoteId = result.rows[0].id;
  for (const item of data.items) {
    await query(
      "INSERT INTO credit_note_items (credit_note_id, order_item_id, product_id, name, price, quantity, line_total) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [creditNoteId, item.orderItemId, item.productId, item.name, item.price, item.quantity, item.price * item.quantity]
    );
  }
  return await getCreditNote(creditNoteId);
}

async function submitCreditNoteToEtims(creditNoteId: number, etimsData: { cnNumber: string; controlCode: string; serialNumber: number; internalData: string; signatureData: string }): Promise<boolean> {
  const result = await query(
    "UPDATE credit_notes SET etims_cn_number = $1, etims_control_code = $2, etims_serial_number = $3, etims_internal_data = $4, etims_signature_data = $5, etims_submitted_at = NOW()::text, status = 'submitted' WHERE id = $6",
    [etimsData.cnNumber, etimsData.controlCode, etimsData.serialNumber, etimsData.internalData, etimsData.signatureData, creditNoteId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function getCreditNote(id: number): Promise<CreditNote | undefined> {
  const row = await queryOne("SELECT * FROM credit_notes WHERE id = $1", [id]) as any;
  if (!row) return undefined;
  const items = await queryAll("SELECT * FROM credit_note_items WHERE credit_note_id = $1", [id]) as any[];
  return {
    id: row.id, orderId: row.order_id, totalAmount: row.total_amount, reason: row.reason, reasonCode: row.reason_code, status: row.status, createdBy: row.created_by, createdAt: row.created_at, etimsCnNumber: row.etims_cn_number, etimsControlCode: row.etims_control_code, etimsSerialNumber: row.etims_serial_number, etimsInternalData: row.etims_internal_data, etimsSignatureData: row.etims_signature_data, etimsSubmittedAt: row.etims_submitted_at,
    items: items.map((i) => ({ id: i.id, creditNoteId: i.credit_note_id, orderItemId: i.order_item_id, productId: i.product_id, name: i.name, price: i.price, quantity: i.quantity, lineTotal: i.line_total })),
  };
}

async function listCreditNotes(orderId?: number): Promise<CreditNote[]> {
  let sql = "SELECT id FROM credit_notes"; const params: any[] = [];
  if (orderId) { sql += " WHERE order_id = $1"; params.push(orderId); }
  sql += " ORDER BY created_at DESC";
  const rows = await queryAll(sql, params) as { id: number }[];
  const notes: CreditNote[] = [];
  for (const row of rows) { const n = await getCreditNote(row.id); if (n) notes.push(n); }
  return notes;
}

async function getRepairImages(ticketId: string): Promise<RepairImage[]> {
  return await queryAll("SELECT * FROM repair_images WHERE ticket_id = $1 ORDER BY created_at", [ticketId]) as RepairImage[];
}

async function addRepairImage(ticketId: string, imageUrl: string, imageType: string, uploadedBy?: number): Promise<RepairImage> {
  const result = await query("INSERT INTO repair_images (ticket_id, image_url, image_type, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING *", [ticketId, imageUrl, imageType, uploadedBy || null]);
  return result.rows[0] as RepairImage;
}

async function deleteRepairImage(id: number): Promise<boolean> {
  const result = await query("DELETE FROM repair_images WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function createPurchaseOrder(data: { supplierName: string; supplierContact?: string; notes?: string; createdBy?: number; items: { productId: string; quantityOrdered: number; unitCost: number }[] }): Promise<PurchaseOrder> {
  const result = await query(
    "INSERT INTO purchase_orders (supplier_name, supplier_contact, status, notes, created_by) VALUES ($1, $2, 'pending', $3, $4) RETURNING id",
    [data.supplierName, data.supplierContact || "", data.notes || "", data.createdBy || null]
  );
  const poId = result.rows[0].id;
  for (const item of data.items) {
    await query("INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, quantity_received, unit_cost) VALUES ($1, $2, $3, 0, $4)", [poId, item.productId, item.quantityOrdered, item.unitCost]);
  }
  return (await getPurchaseOrder(poId))!;
}

async function getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined> {
  const row = await queryOne("SELECT * FROM purchase_orders WHERE id = $1", [id]) as any;
  if (!row) return undefined;
  const items = await queryAll(
    "SELECT poi.*, p.name AS product_name FROM purchase_order_items poi LEFT JOIN products p ON p.id = poi.product_id WHERE poi.purchase_order_id = $1", [id]
  ) as any[];
  const totalCost = items.reduce((sum, i) => sum + i.quantity_ordered * i.unit_cost, 0);
  return {
    id: row.id, supplierName: row.supplier_name, supplierContact: row.supplier_contact, orderDate: row.order_date, status: row.status, notes: row.notes, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, totalCost,
    items: items.map((i) => ({ id: i.id, purchaseOrderId: i.purchase_order_id, productId: i.product_id, productName: i.product_name, quantityOrdered: i.quantity_ordered, quantityReceived: i.quantity_received, unitCost: i.unit_cost })),
  };
}

async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const rows = await queryAll("SELECT id FROM purchase_orders ORDER BY created_at DESC") as { id: number }[];
  const orders: PurchaseOrder[] = [];
  for (const row of rows) { const o = await getPurchaseOrder(row.id); if (o) orders.push(o); }
  return orders;
}

async function addPurchaseOrderItem(purchaseOrderId: number, data: { productId: string; quantityOrdered: number; unitCost: number }): Promise<PurchaseOrderItem> {
  const result = await query("INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, quantity_received, unit_cost) VALUES ($1, $2, $3, 0, $4) RETURNING *", [purchaseOrderId, data.productId, data.quantityOrdered, data.unitCost]);
  return result.rows[0] as PurchaseOrderItem;
}

async function updatePurchaseOrderStatus(id: number, status: string): Promise<boolean> {
  const result = await query("UPDATE purchase_orders SET status = $1, updated_at = NOW()::text WHERE id = $2", [status, id]);
  return (result.rowCount ?? 0) > 0;
}

async function receivePurchaseOrderItem(itemId: number, quantityReceived: number): Promise<void> {
  await query("UPDATE purchase_order_items SET quantity_received = $1 WHERE id = $2", [quantityReceived, itemId]);
}

async function autoReorderLowStock(): Promise<PurchaseOrder | null> {
  const lowItems = await getLowStockItems();
  if (lowItems.length === 0) return null;
  return await createPurchaseOrder({ supplierName: "Auto-Reorder System", notes: "Auto-generated reorder for low stock items", items: lowItems.map((i) => ({ productId: i.productId, quantityOrdered: i.lowStockThreshold * 2, unitCost: i.price * 0.6 })) });
}

async function getTechPerformanceReport(): Promise<TechPerformanceReport[]> {
  return await queryAll(
    `SELECT u.id AS "staffId", u.username AS "staffName",
      COUNT(CASE WHEN rt.status = 'completed' THEN 1 END) AS "ticketsCompleted",
      COUNT(rt.id) AS "ticketsAssigned",
      COALESCE(SUM(CASE WHEN rt.status = 'completed' THEN rt.total_cost ELSE 0 END), 0) AS "totalEarned"
     FROM users u LEFT JOIN repair_tickets rt ON rt.assigned_to = u.id
     WHERE u.role = 'technician' GROUP BY u.id, u.username ORDER BY "ticketsCompleted" DESC`
  ) as TechPerformanceReport[];
}

async function getSalesReport(): Promise<SalesReport> {
  const orderStats = await queryOne("SELECT COUNT(*) AS total_orders, COALESCE(SUM(subtotal + shipping_fee), 0) AS total_revenue FROM orders WHERE status != 'cancelled'") as any;
  const invoiceStats = await queryOne("SELECT COUNT(*) AS paid_invoices, COALESCE(SUM(amount), 0) AS invoice_revenue FROM order_invoices WHERE status = 'paid'") as any;
  const topProducts = await queryAll(
    `SELECT oi.product_id AS "productId", oi.name, SUM(oi.quantity) AS "totalSold", SUM(oi.price * oi.quantity) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
     GROUP BY oi.product_id, oi.name ORDER BY "totalSold" DESC LIMIT 10`
  ) as any[];
  return { totalRevenue: Number(orderStats?.total_revenue || 0), totalOrders: Number(orderStats?.total_orders || 0), paidInvoices: Number(invoiceStats?.paid_invoices || 0), invoiceRevenue: Number(invoiceStats?.invoice_revenue || 0), topProducts };
}

async function getSalesReportWithRange(startDate?: string, endDate?: string): Promise<SalesReport> {
  let where = " o.status != 'cancelled'"; const params: any[] = []; let idx = 1;
  if (startDate) { where += ` AND o.created_at >= $${idx}`; params.push(startDate); idx++; }
  if (endDate) { where += ` AND o.created_at <= $${idx}`; params.push(endDate); idx++; }
  const orderStats = await queryOne(`SELECT COUNT(*) AS total_orders, COALESCE(SUM(subtotal + shipping_fee), 0) AS total_revenue FROM orders o WHERE ${where}`, params) as any;
  const invoiceStats = await queryOne("SELECT COUNT(*) AS paid_invoices, COALESCE(SUM(amount), 0) AS invoice_revenue FROM order_invoices WHERE status = 'paid'") as any;
  const topProducts = await queryAll(
    `SELECT oi.product_id AS "productId", oi.name, SUM(oi.quantity) AS "totalSold", SUM(oi.price * oi.quantity) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${where}
     GROUP BY oi.product_id, oi.name ORDER BY "totalSold" DESC LIMIT 10`, params
  ) as any[];
  return { totalRevenue: Number(orderStats?.total_revenue || 0), totalOrders: Number(orderStats?.total_orders || 0), paidInvoices: Number(invoiceStats?.paid_invoices || 0), invoiceRevenue: Number(invoiceStats?.invoice_revenue || 0), topProducts };
}

async function getPurchaseReport(): Promise<PurchaseReport> {
  const row = await queryOne(
    `SELECT COUNT(*) AS total_orders, COALESCE(SUM(
      (SELECT COALESCE(SUM(poi.quantity_ordered * poi.unit_cost), 0) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id)
    ), 0) AS total_spent,
    COUNT(CASE WHEN po.status = 'pending' THEN 1 END) AS pending_orders,
    COUNT(CASE WHEN po.status = 'received' THEN 1 END) AS received_orders
     FROM purchase_orders po`
  ) as any;
  return { totalOrders: Number(row?.total_orders || 0), totalSpent: Number(row?.total_spent || 0), pendingOrders: Number(row?.pending_orders || 0), receivedOrders: Number(row?.received_orders || 0) };
}

async function getStockSummary(): Promise<{ productId: string; name: string; category: string; quantityInStock: number; quantityReserved: number; quantitySold: number; lowStockThreshold: number }[]> {
  return await queryAll(
    `SELECT p.id AS "productId", p.name, p.category,
      COALESCE(sl.quantity_in_stock, 0) AS "quantityInStock",
      COALESCE(sl.quantity_reserved, 0) AS "quantityReserved",
      COALESCE(sl.quantity_sold, 0) AS "quantitySold",
      COALESCE(sl.low_stock_threshold, 5) AS "lowStockThreshold"
    FROM products p
    LEFT JOIN stock_levels sl ON sl.product_id = p.id
    ORDER BY p.name`
  );
}

async function getEmployeeSalesPerformance(): Promise<any[]> {
  return await queryAll(
    `SELECT u.id AS "staffId", u.username AS "staffName", COUNT(o.id) AS "totalOrders", COALESCE(SUM(o.subtotal + o.shipping_fee), 0) AS "totalRevenue"
     FROM users u LEFT JOIN orders o ON o.staff_id = u.id AND o.status != 'cancelled'
     WHERE u.role != 'customer' GROUP BY u.id, u.username ORDER BY "totalRevenue" DESC`
  );
}

async function getTechnicianRepairStats(): Promise<any[]> {
  return await queryAll(
    `SELECT u.id AS "technicianId", u.username AS "technicianName", COUNT(rt.id) AS "totalRepairs",
      COUNT(CASE WHEN rt.status = 'completed' THEN 1 END) AS "completedRepairs",
      COALESCE(SUM(CASE WHEN rt.status = 'completed' THEN rt.total_cost ELSE 0 END), 0) AS "totalEarned"
     FROM users u LEFT JOIN repair_tickets rt ON rt.assigned_to = u.id
     WHERE u.role = 'technician' GROUP BY u.id, u.username ORDER BY "completedRepairs" DESC`
  );
}

async function createStockTakeSession(notes?: string, createdBy?: number): Promise<StockTakeSession> {
  const result = await query("INSERT INTO stock_take_sessions (status, notes, created_by) VALUES ('in_progress', $1, $2) RETURNING *", [notes || "", createdBy || null]);
  return result.rows[0] as StockTakeSession;
}

async function getStockTakeSession(id: number): Promise<StockTakeSession | undefined> {
  return await queryOne("SELECT * FROM stock_take_sessions WHERE id = $1", [id]) as StockTakeSession | undefined;
}

async function listStockTakeSessions(): Promise<StockTakeSession[]> {
  return await queryAll("SELECT * FROM stock_take_sessions ORDER BY created_at DESC") as StockTakeSession[];
}

async function getStockTakeItems(sessionId: number): Promise<StockTakeItem[]> {
  return await queryAll(
    "SELECT sti.*, p.name AS product_name FROM stock_take_items sti LEFT JOIN products p ON p.id = sti.product_id WHERE sti.session_id = $1 ORDER BY p.name", [sessionId]
  ) as StockTakeItem[];
}

async function recordStockCount(sessionId: number, productId: string, countedQuantity: number, notes?: string): Promise<void> {
  const systemRow = await queryOne("SELECT quantity_in_stock FROM stock_levels WHERE product_id = $1", [productId]) as any;
  const systemQuantity = systemRow ? Number(systemRow.quantity_in_stock) : 0;
  await query(
    `INSERT INTO stock_take_items (session_id, product_id, product_name, system_quantity, counted_quantity, variance, notes)
     VALUES ($1, $2, (SELECT name FROM products WHERE id = $2), $3, $4, $5, $6)
     ON CONFLICT (session_id, product_id) DO UPDATE SET counted_quantity = $4, variance = $5, notes = $6`,
    [sessionId, productId, systemQuantity, countedQuantity, countedQuantity - systemQuantity, notes || ""]
  );
}

async function completeStockTakeSession(id: number): Promise<boolean> {
  const result = await query("UPDATE stock_take_sessions SET status = 'completed', completed_at = NOW()::text WHERE id = $1 AND status = 'in_progress'", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function snapshotStockLevels(): Promise<void> {
  await query(
    `INSERT INTO stock_snapshots (snapshot_date, product_id, product_name, quantity)
     SELECT NOW()::text, sl.product_id, p.name, sl.quantity_in_stock
     FROM stock_levels sl JOIN products p ON p.id = sl.product_id`
  );
}

async function listStockSnapshots(): Promise<StockSnapshot[]> {
  return await queryAll("SELECT * FROM stock_snapshots ORDER BY snapshot_date DESC, product_name") as StockSnapshot[];
}

async function addAuditLog(userId: number | null, userName: string, action: string, entityType: string, entityId: string | null, details: string, actorRole?: string): Promise<void> {
  await query("INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, actor_role) VALUES ($1, $2, $3, $4, $5, $6, $7)", [userId, userName, action, entityType, entityId, details, actorRole || ""]);
}

async function listAuditLogs(limit?: number): Promise<AuditEntry[]> {
  return await queryAll("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1", [limit || 100]) as AuditEntry[];
}

async function getSpecFields(category: string): Promise<SpecFieldDef[]> {
  const rows = await queryAll("SELECT * FROM spec_template_fields WHERE category = $1 ORDER BY sort_order", [category]) as any[];
  return rows.map((r) => ({ id: r.id, category: r.category, fieldKey: r.field_key, fieldLabel: r.field_label, fieldType: r.field_type, options: JSON.parse(r.options || "[]"), required: Boolean(r.required), sortOrder: r.sort_order }));
}

async function upsertSpecField(data: { category: string; fieldKey: string; fieldLabel: string; fieldType?: string; options?: string[]; required?: boolean; sortOrder?: number }): Promise<SpecFieldDef> {
  const result = await query(
    `INSERT INTO spec_template_fields (category, field_key, field_label, field_type, options, required, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [data.category, data.fieldKey, data.fieldLabel, data.fieldType || "text", JSON.stringify(data.options || []), data.required ? 1 : 0, data.sortOrder || 0]
  );
  const r = result.rows[0];
  return { id: r.id, category: r.category, fieldKey: r.field_key, fieldLabel: r.field_label, fieldType: r.field_type, options: JSON.parse(r.options || "[]"), required: Boolean(r.required), sortOrder: r.sort_order };
}

async function deleteSpecField(id: number): Promise<boolean> {
  const result = await query("DELETE FROM spec_template_fields WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

async function listSpecTemplates(): Promise<string[]> {
  const rows = await queryAll("SELECT DISTINCT category FROM spec_template_fields ORDER BY category") as { category: string }[];
  return rows.map((r) => r.category);
}

async function storeImage(refId: string, mimeType: string, imageData: string): Promise<number> {
  const row = await queryOne("INSERT INTO stored_images (ref_id, mime_type, image_data) VALUES ($1, $2, $3) RETURNING id", [refId, mimeType, imageData]) as any;
  return row ? row.id : 0;
}

async function getImage(refId: string): Promise<{ id: number; refId: string; mimeType: string; imageData: string } | undefined> {
  const row = await queryOne("SELECT * FROM stored_images WHERE ref_id = $1 ORDER BY id DESC LIMIT 1", [refId]) as any;
  if (!row) return undefined;
  return { id: row.id, refId: row.ref_id, mimeType: row.mime_type, imageData: row.image_data };
}

async function deleteImageByRef(refId: string): Promise<void> {
  await query("DELETE FROM stored_images WHERE ref_id = $1", [refId]);
}

async function getLoyaltyPoints(customerId: number): Promise<number> {
  const row = await queryOne("SELECT points FROM loyalty_points WHERE customer_id = $1", [customerId]) as any;
  return row ? Number(row.points) : 0;
}

async function earnLoyaltyPoints(customerId: number, orderId: number, points: number): Promise<void> {
  await query(
    `INSERT INTO loyalty_points (customer_id, points) VALUES ($1, $2)
     ON CONFLICT (customer_id) DO UPDATE SET points = loyalty_points.points + $2`,
    [customerId, points]
  );
  await query("INSERT INTO loyalty_transactions (customer_id, order_id, points, type) VALUES ($1, $2, $3, 'earn')", [customerId, orderId, points]);
}

async function redeemLoyaltyPoints(customerId: number, orderId: number, points: number): Promise<boolean> {
  const current = await getLoyaltyPoints(customerId);
  if (current < points) return false;
  await query("UPDATE loyalty_points SET points = points - $1 WHERE customer_id = $2", [points, customerId]);
  await query("INSERT INTO loyalty_transactions (customer_id, order_id, points, type) VALUES ($1, $2, $3, 'redeem')", [customerId, orderId, points]);
  return true;
}

async function getLoyaltyTransactions(customerId: number): Promise<any[]> {
  return await queryAll("SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC", [customerId]);
}

async function listAllLoyaltyCustomers(): Promise<any[]> {
  return await queryAll(
    `SELECT lp.customer_id, c.name, c.email, lp.points FROM loyalty_points lp
     JOIN customers c ON c.id = lp.customer_id WHERE lp.points > 0 ORDER BY lp.points DESC`
  );
}

async function listAllCustomers(): Promise<Customer[]> {
  return await queryAll("SELECT id, name, email, phone, is_active, last_login, created_at FROM customers ORDER BY created_at DESC") as Customer[];
}

async function listActiveCustomers(): Promise<Customer[]> {
  return await queryAll("SELECT id, name, email, phone, is_active, last_login, created_at FROM customers WHERE is_active = 1 ORDER BY name") as Customer[];
}

async function getCustomerDetails(id: number): Promise<Customer | undefined> {
  return await findCustomerById(id);
}

async function listAllMessages(): Promise<Message[]> {
  return await queryAll(
    `SELECT m.*, c.name AS "customerName", p.company_name AS "providerName"
     FROM messages m LEFT JOIN customers c ON c.id = m.customer_id LEFT JOIN providers p ON p.id = m.provider_id
     ORDER BY m.created_at DESC`
  ) as Message[];
}

async function changeCustomerPassword(customerId: number, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE customers SET password_hash = $1 WHERE id = $2", [hash, customerId]);
}

async function logAudit(userId: number | null, userName: string, action: string, entityType: string, entityId: string | null, details: any = {}, actorRole: string = ""): Promise<void> {
  await query("INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, actor_role) VALUES ($1, $2, $3, $4, $5, $6, $7)", [userId, userName, action, entityType, entityId, JSON.stringify(details), actorRole]);
}

async function getAuditLog(limit: number = 200, entityType?: string, excludeRole?: string): Promise<AuditEntry[]> {
  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const params: any[] = [];
  if (entityType) { sql += " AND entity_type = $1"; params.push(entityType); }
  if (excludeRole) { sql += ` AND actor_role != $${params.length + 1}`; params.push(excludeRole); }
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  return await queryAll(sql, params) as AuditEntry[];
}

async function providerHasFeature(providerId: number, feature: string): Promise<boolean> {
  const sub = await getProviderSubscription(providerId);
  if (!sub) return false;
  const plan = await getSubscriptionPlan(sub.planId);
  if (!plan) return false;
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];
  return features.some((f) => f.toLowerCase().trim() === feature.toLowerCase().trim());
}

async function applyStockTakeAdjustments(sessionId: number): Promise<number> {
  const items = await queryAll("SELECT * FROM stock_take_items WHERE session_id = $1 AND counted_quantity IS NOT NULL", [sessionId]) as any[];
  let adjusted = 0;
  for (const item of items) {
    const current = await getStockLevel(item.product_id);
    const diff = item.counted_quantity - (current?.quantityInStock || 0);
    if (diff === 0) continue;
    await updateStockLevel(item.product_id, Math.max(0, item.counted_quantity));
    await recordStockMovement(item.product_id, "stock_take_adjust", diff, "stock_take", String(sessionId), `Stock take #${sessionId} adjustment`);
    adjusted++;
  }
  return adjusted;
}

async function getStockTakeVarianceReport(sessionId: number): Promise<{ totalItems: number; counted: number; withVariance: number; totalVariance: number; items: StockTakeItem[] }> {
  const items = await getStockTakeItems(sessionId);
  const counted = items.filter((i: any) => i.counted_quantity !== null);
  const withVariance = counted.filter((i: any) => i.variance !== 0);
  const totalVariance = counted.reduce((s: number, i: any) => s + Math.abs(i.variance), 0);
  return { totalItems: items.length, counted: counted.length, withVariance: withVariance.length, totalVariance, items };
}

async function deleteStockTakeSession(sessionId: number): Promise<{ ok: boolean; error?: string }> {
  const session = await getStockTakeSession(sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  const counted = await queryOne("SELECT COUNT(*) AS c FROM stock_take_items WHERE session_id = $1 AND counted_quantity IS NOT NULL", [sessionId]) as any;
  if (Number(counted?.c || 0) > 0) return { ok: false, error: "Cannot delete session with counted items." };
  await query("DELETE FROM stock_take_items WHERE session_id = $1", [sessionId]);
  await query("DELETE FROM stock_take_sessions WHERE id = $1", [sessionId]);
  return { ok: true };
}

async function createStockSnapshot(snapshotDate?: string): Promise<boolean> {
  const date = snapshotDate || new Date().toISOString().slice(0, 10);
  await query("DELETE FROM stock_snapshots WHERE snapshot_date = $1", [date]);
  await query(
    `INSERT INTO stock_snapshots (snapshot_date, product_id, product_name, quantity)
     SELECT $1, sl.product_id, p.name, sl.quantity_in_stock
     FROM stock_levels sl JOIN products p ON p.id = sl.product_id`, [date]
  );
  return true;
}

async function getStockSnapshot(snapshotDate: string): Promise<{ date: string; items: { productId: string; productName: string; quantity: number }[] }> {
  const rows = await queryAll("SELECT * FROM stock_snapshots WHERE snapshot_date = $1 ORDER BY product_name", [snapshotDate]) as any[];
  return { date: snapshotDate, items: rows.map((r: any) => ({ productId: r.product_id, productName: r.product_name, quantity: r.quantity })) };
}

async function listStockSnapshotDates(): Promise<{ date: string; createdAt: string }[]> {
  return await queryAll("SELECT DISTINCT snapshot_date AS date, MAX(created_at) AS \"createdAt\" FROM stock_snapshots GROUP BY snapshot_date ORDER BY snapshot_date DESC") as any[];
}

async function getCurrentStockLevels(): Promise<{ productId: string; productName: string; quantity: number }[]> {
  return await queryAll("SELECT p.id AS \"productId\", p.name AS \"productName\", COALESCE(sl.quantity_in_stock, 0) AS quantity FROM products p LEFT JOIN stock_levels sl ON sl.product_id = p.id ORDER BY p.name") as any[];
}

async function getShopPlan(): Promise<SubscriptionPlan | undefined> {
  const row = await queryOne("SELECT value FROM settings WHERE key = 'shop_plan_id'") as any;
  if (!row) return undefined;
  return await getSubscriptionPlan(row.value);
}

async function setShopPlan(planId: string): Promise<boolean> {
  const plan = await getSubscriptionPlan(planId);
  if (!plan) return false;
  await query("INSERT INTO settings (key, value) VALUES ('shop_plan_id', $1) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [planId]);
  return true;
}

async function createSubscriptionRequest(planId: string, createdBy: number, notes: string = ""): Promise<boolean> {
  const plan = await getSubscriptionPlan(planId);
  if (!plan) return false;
  await query("INSERT INTO subscription_requests (requested_plan_id, status, notes, created_by) VALUES ($1, 'pending', $2, $3)", [planId, notes, createdBy]);
  return true;
}

async function listSubscriptionRequests(status?: string): Promise<any[]> {
  let sql = `SELECT sr.*, sp.name AS plan_name FROM subscription_requests sr JOIN subscription_plans sp ON sp.id = sr.requested_plan_id`;
  const params: any[] = [];
  if (status) { sql += " WHERE sr.status = $1"; params.push(status); }
  sql += " ORDER BY sr.created_at DESC";
  return await queryAll(sql, params);
}

async function reviewSubscriptionRequest(id: number, status: string, reviewedBy: number): Promise<boolean> {
  if (!["approved", "rejected"].includes(status)) return false;
  const req = await queryOne("SELECT * FROM subscription_requests WHERE id = $1 AND status = 'pending'", [id]) as any;
  if (!req) return false;
  await query("UPDATE subscription_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW()::text WHERE id = $3", [status, reviewedBy, id]);
  if (status === "approved") {
    await setShopPlan(req.requested_plan_id);
  }
  return true;
}

// ============ SPEC TEMPLATE FIELDS (matching original names) ============

async function getSpecTemplateFields(category: string): Promise<SpecFieldDef[]> {
  const rows = await queryAll("SELECT * FROM spec_template_fields WHERE category = $1 ORDER BY sort_order, id", [category]) as any[];
  return rows.map((r: any) => ({ id: r.id, category: r.category, fieldKey: r.field_key, fieldLabel: r.field_label, fieldType: r.field_type, options: JSON.parse(r.options || "[]"), required: Boolean(r.required), sortOrder: r.sort_order }));
}

async function getAllSpecTemplateFields(): Promise<SpecFieldDef[]> {
  const rows = await queryAll("SELECT * FROM spec_template_fields ORDER BY category, sort_order, id") as any[];
  return rows.map((r: any) => ({ id: r.id, category: r.category, fieldKey: r.field_key, fieldLabel: r.field_label, fieldType: r.field_type, options: JSON.parse(r.options || "[]"), required: Boolean(r.required), sortOrder: r.sort_order }));
}

async function createSpecTemplateField(field: { category: string; fieldKey: string; fieldLabel: string; fieldType?: string; options?: string[]; required?: boolean; sortOrder?: number }): Promise<SpecFieldDef | null> {
  const result = await query(
    "INSERT INTO spec_template_fields (category, field_key, field_label, field_type, options, required, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    [field.category, field.fieldKey, field.fieldLabel, field.fieldType || "text", JSON.stringify(field.options || []), field.required ? 1 : 0, field.sortOrder ?? 0]
  );
  const r = result.rows[0];
  if (!r) return null;
  return { id: r.id, category: r.category, fieldKey: r.field_key, fieldLabel: r.field_label, fieldType: r.field_type, options: JSON.parse(r.options || "[]"), required: Boolean(r.required), sortOrder: r.sort_order };
}

async function updateSpecTemplateField(id: number, updates: { fieldKey?: string; fieldLabel?: string; fieldType?: string; options?: string[]; required?: boolean; sortOrder?: number }): Promise<boolean> {
  const existing = await queryOne("SELECT * FROM spec_template_fields WHERE id = $1", [id]) as any;
  if (!existing) return false;
  await query(
    "UPDATE spec_template_fields SET field_key = $1, field_label = $2, field_type = $3, options = $4, required = $5, sort_order = $6 WHERE id = $7",
    [updates.fieldKey ?? existing.field_key, updates.fieldLabel ?? existing.field_label, updates.fieldType ?? existing.field_type, JSON.stringify(updates.options ?? JSON.parse(existing.options || "[]")), updates.required !== undefined ? (updates.required ? 1 : 0) : existing.required, updates.sortOrder ?? existing.sort_order, id]
  );
  return true;
}

async function deleteSpecTemplateField(id: number): Promise<boolean> {
  const r = await query("DELETE FROM spec_template_fields WHERE id = $1", [id]);
  return (r.rowCount ?? 0) > 0;
}

// ============ SUPPLIERS ============

async function listSuppliers(): Promise<any[]> {
  return await queryAll("SELECT * FROM suppliers ORDER BY name ASC");
}

async function getSupplier(id: number): Promise<any> {
  return await queryOne("SELECT * FROM suppliers WHERE id = $1", [id]);
}

async function createSupplier(data: any): Promise<any> {
  await query(
    "INSERT INTO suppliers (name, contact_name, email, phone, address, notes, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [String(data.name || "").trim(), String(data.contact_name || "").trim(), String(data.email || "").trim(), String(data.phone || "").trim(), String(data.address || "").trim(), String(data.notes || "").trim(), data.is_active !== false ? 1 : 0]
  );
  return await queryOne("SELECT * FROM suppliers ORDER BY id DESC LIMIT 1");
}

async function updateSupplier(id: number, data: any): Promise<any> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  for (const k of ["name", "contact_name", "email", "phone", "address", "notes", "is_active"]) {
    if (data[k] !== undefined) { sets.push(`${k} = $${idx}`); vals.push(data[k]); idx++; }
  }
  if (sets.length === 0) return await getSupplier(id);
  vals.push(id);
  await query(`UPDATE suppliers SET ${sets.join(", ")}, updated_at = NOW()::text WHERE id = $${idx}`, vals);
  return await getSupplier(id);
}

async function deleteSupplier(id: number): Promise<boolean> {
  const r = await query("DELETE FROM suppliers WHERE id = $1", [id]);
  return (r.rowCount ?? 0) > 0;
}

// ============ PRODUCT REVIEWS ============

async function createReview(productId: string, customerId: number, rating: number, title: string, comment: string): Promise<any> {
  await query("INSERT INTO product_reviews (product_id, customer_id, rating, title, comment) VALUES ($1, $2, $3, $4, $5)", [productId, customerId, rating, title, comment]);
  return await queryOne("SELECT pr.*, c.name AS customer_name FROM product_reviews pr JOIN customers c ON c.id = pr.customer_id ORDER BY pr.id DESC LIMIT 1");
}

async function getProductReviews(productId: string): Promise<any[]> {
  return await queryAll("SELECT pr.*, c.name AS customer_name FROM product_reviews pr JOIN customers c ON c.id = pr.customer_id WHERE pr.product_id = $1 ORDER BY pr.created_at DESC", [productId]);
}

async function getProductRating(productId: string): Promise<{ average: number; count: number }> {
  const row = await queryOne("SELECT AVG(rating) as avg, COUNT(*) as cnt FROM product_reviews WHERE product_id = $1", [productId]) as any;
  return { average: Number(row?.avg || 0), count: Number(row?.cnt || 0) };
}

async function hasCustomerReviewed(productId: string, customerId: number): Promise<boolean> {
  const row = await queryOne("SELECT id FROM product_reviews WHERE product_id = $1 AND customer_id = $2", [productId, customerId]);
  return !!row;
}

export {
  initDb, runMigrations, ensureDefaultSettings, ensureDefaultCategories, ensureAdminUser, ensureTechnicianUser,
  seedDemoProvider, seedDemoCustomer, assignInitialRoles, seedProductsIfEmpty, ensureDefaultSubscriptionPlans,
  listCategories, listPosCategories, getCategory, createCategory, updateCategory, deleteCategory, isValidCategory,
  listSubcategories, getSubcategory, createSubcategory, updateSubcategory, deleteSubcategory, getSubcategoriesForCategory,
  findStaffByUsername, findStaffByEmail, findStaffById, listStaff, updateStaffDetails, createStaff, updateStaffRole, changeStaffPassword, deleteStaff, findAdminByUsername,
  findCustomerByEmail, findCustomerById, updateCustomerLastLogin, updateCustomerStatus, deleteCustomer, deactivateOldCustomers, createCustomer, changeCustomerPassword, listAllCustomers, listActiveCustomers, getCustomerDetails,
  getSettings, updateSettings, getStoreSetting, setStoreSetting, getPaymentMethods, setPaymentMethods,
  listProducts, getProduct, setProductImageUrl, createProduct, updateProduct, deleteProduct, getPriceHistory,
  getProductImages, addProductImage, deleteProductImage, setProductImageOrder, setPrimaryImage,
  getMessagesForCustomer, getMessagesForProvider, sendMessage, markMessageRead, getUnreadMessageCount, listAllMessages,
  getCartItems, getCartCount, addToCart, setCartQuantity, removeFromCart, clearCart, generateProductId,
  getStockLevel, updateStockLevel, recordStockMovement, getStockMovements, getLowStockItems,
  createStockTransfer, getStockTransfer, listStockTransfers, completeStockTransfer, rejectStockTransfer,
  listSubscriptionPlans, getSubscriptionPlan, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
  listBranches, getBranch, createBranch, updateBranch, deleteBranch, getBranchCount, getMaxBranchesForShop, canCreateBranch,
  listClients, getClient, createClient, updateClient, deleteClient,
  listClientBranches, getClientBranch, createClientBranch, updateClientBranch, deleteClientBranch,
  findProviderByEmail, findProviderById, listProviders, createProvider, verifyProviderPin, updateProviderStatus, updateProvider,
  getProviderSubscription, assignPlanToProvider, getProviderAssignmentHistory,
  providerHasFeature,
  getWishlist, addToWishlist, removeFromWishlist, isInWishlist,
  generateQuoteNumber, createQuoteFromWishlist, createQuote, getQuote, listQuotesForCustomer, updateQuoteStatus, listAllQuotes,
  validateCoupon, listCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon, recordCouponUsage,
  createOrder, getOrder, updateOrderItemWarranty, listOrders, updateOrderStatus,
  recordProductView, getPopularProducts, getTotalViews,
  createInvoice, getInvoice, listInvoices, markInvoicePaid, generateProviderInvoice, getInvoiceRevenue,
  getEtimsMode, generateEtimsInvoiceNumber, createEtimsSalesTransaction,
  createOrderInvoice, listOrderInvoices, markOrderInvoicePaid,
  createCreditNote, submitCreditNoteToEtims, getCreditNote, listCreditNotes,
  getRepairImages, addRepairImage, deleteRepairImage,
  createPurchaseOrder, getPurchaseOrder, listPurchaseOrders, addPurchaseOrderItem, updatePurchaseOrderStatus, receivePurchaseOrderItem, autoReorderLowStock,
  getTechPerformanceReport, getSalesReport, getPurchaseReport, getSalesReportWithRange,
  getStockSummary, getEmployeeSalesPerformance, getTechnicianRepairStats,
  createStockTakeSession, getStockTakeSession, listStockTakeSessions, getStockTakeItems, recordStockCount, completeStockTakeSession,
  applyStockTakeAdjustments, getStockTakeVarianceReport, deleteStockTakeSession,
  createStockSnapshot, getStockSnapshot, listStockSnapshotDates, getCurrentStockLevels,
  logAudit, getAuditLog, addAuditLog, listAuditLogs,
  getShopPlan, setShopPlan,
  createSubscriptionRequest, listSubscriptionRequests, reviewSubscriptionRequest,
  getSpecTemplateFields, getAllSpecTemplateFields, createSpecTemplateField, updateSpecTemplateField, deleteSpecTemplateField,
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
  createReview, getProductReviews, getProductRating, hasCustomerReviewed,
  getLoyaltyPoints, earnLoyaltyPoints, redeemLoyaltyPoints, getLoyaltyTransactions, listAllLoyaltyCustomers,
  getDb,
  storeImage, getImage, deleteImageByRef,
};
