import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { imageUrlForProduct, deleteProductImages } from "./upload";
import { CATEGORIES } from "./categories";
import { initRoles, assignRoleToUser } from "./permissions";

type Db = Database.Database;

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
}

interface ProviderWithPassword extends Provider {
  password_hash: string;
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
  taxRate: number;
}

interface CategoryRow {
  id: string;
  label: string;
  group_name: string;
}

interface Category {
  id: string;
  label: string;
  group: string;
}

const DATA_DIR: string = path.join(__dirname, "..", "data");
const DB_PATH: string = path.join(DATA_DIR, "store.db");

let db: Db;

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

function runMigrations(): void {
  const productCols = getDb().prepare("PRAGMA table_info(products)").all() as any[];
  if (!productCols.find((c: any) => c.name === "image_url")) {
    getDb().exec(`ALTER TABLE products ADD COLUMN image_url TEXT NOT NULL DEFAULT ''`);
  }
  if (!productCols.find((c: any) => c.name === "is_non_stock")) {
    getDb().exec(`ALTER TABLE products ADD COLUMN is_non_stock INTEGER NOT NULL DEFAULT 0`);
  }
  if (!productCols.find((c: any) => c.name === "subcategory")) {
    getDb().exec(`ALTER TABLE products ADD COLUMN subcategory TEXT NOT NULL DEFAULT ''`);
  }
  if (!productCols.find((c: any) => c.name === "taxable")) {
    getDb().exec(`ALTER TABLE products ADD COLUMN taxable INTEGER NOT NULL DEFAULT 1`);
  }

  const logoSetting = getDb().prepare("SELECT value FROM settings WHERE key = 'storeLogo'").get();
  if (!logoSetting) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('storeLogo', '')").run();
  }

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cart_customer ON cart_items(customer_id);
  `);

  const userCols = getDb().prepare("PRAGMA table_info(users)").all() as any[];
  if (!userCols.find((c: any) => c.name === "role")) {
    getDb().exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'`);
    getDb().prepare(`UPDATE users SET role = 'admin' WHERE role IS NULL OR role = ''`).run();
  }
  if (!userCols.find((c: any) => c.name === "email")) {
    getDb().exec(`ALTER TABLE users ADD COLUMN email TEXT`);
    getDb().prepare(`UPDATE users SET email = username || '@gearandglitch.com' WHERE email IS NULL`).run();
  }

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS repair_tickets (
      id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      device_type TEXT NOT NULL,
      device_model TEXT NOT NULL DEFAULT '',
      issue_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      assigned_to INTEGER,
      eta_at TEXT NOT NULL,
      scheduled_at TEXT,
      diagnosis TEXT NOT NULL DEFAULT '',
      work_notes TEXT NOT NULL DEFAULT '',
      customer_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS repair_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      staff_id INTEGER,
      update_type TEXT NOT NULL DEFAULT 'note',
      message TEXT NOT NULL,
      customer_visible INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS repair_parts_used (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      description TEXT NOT NULL,
      product_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_repairs_customer ON repair_tickets(customer_id);
    CREATE INDEX IF NOT EXISTS idx_repairs_status ON repair_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_repairs_scheduled ON repair_tickets(scheduled_at);
    CREATE TABLE IF NOT EXISTS stock_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL UNIQUE,
      quantity_in_stock INTEGER NOT NULL DEFAULT 0,
      quantity_reserved INTEGER NOT NULL DEFAULT 0,
      quantity_sold INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_branch_id INTEGER NOT NULL,
      to_branch_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_by INTEGER,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (from_branch_id) REFERENCES branches(id),
      FOREIGN KEY (to_branch_id) REFERENCES branches(id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      tier_level INTEGER NOT NULL DEFAULT 0,
      max_products INTEGER,
      features TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'trial',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS provider_plan_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL,
      custom_price REAL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_provider_plan_provider ON provider_plan_assignments(provider_id);

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      shipping_name TEXT NOT NULL DEFAULT '',
      shipping_address TEXT NOT NULL DEFAULT '',
      shipping_city TEXT NOT NULL DEFAULT '',
      shipping_postcode TEXT NOT NULL DEFAULT '',
      shipping_phone TEXT NOT NULL DEFAULT '',
      shipping_county TEXT NOT NULL DEFAULT '',
      shipping_fee REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      subtotal REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      line_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE TABLE IF NOT EXISTS product_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      viewer_type TEXT NOT NULL DEFAULT 'anonymous',
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id);
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KES',
      status TEXT NOT NULL DEFAULT 'pending',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_provider ON invoices(provider_id);
    CREATE TABLE IF NOT EXISTS order_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KES',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_invoices_order ON order_invoices(order_id);
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      product_id TEXT,
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'customer' CHECK(sender_role IN ('customer','provider')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_provider ON messages(provider_id);
    CREATE TABLE IF NOT EXISTS repair_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      base_price REAL NOT NULL DEFAULT 0
    );
  `);

  // Seed repair types if empty
  const existingTypes = getDb().prepare("SELECT COUNT(*) AS c FROM repair_types").get() as { c: number };
  if (existingTypes.c === 0) {
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
    const stmt = getDb().prepare("INSERT INTO repair_types (id, name, description, base_price) VALUES (?, ?, ?, ?)");
    for (const t of types) stmt.run(t.id, t.name, t.description, t.base_price);
  }

  // Add repair pricing columns to repair_tickets if missing
  const repairCols = getDb().prepare("PRAGMA table_info(repair_tickets)").all() as any[];
  if (!repairCols.find((c: any) => c.name === "repair_type")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN repair_type TEXT`);
  }
  if (!repairCols.find((c: any) => c.name === "hardware_value")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN hardware_value REAL NOT NULL DEFAULT 0`);
  }
  if (!repairCols.find((c: any) => c.name === "labor_cost")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN labor_cost REAL NOT NULL DEFAULT 0`);
  }
  if (!repairCols.find((c: any) => c.name === "parts_cost")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN parts_cost REAL NOT NULL DEFAULT 0`);
  }
  if (!repairCols.find((c: any) => c.name === "software_install")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN software_install INTEGER NOT NULL DEFAULT 0`);
  }
  if (!repairCols.find((c: any) => c.name === "software_license")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN software_license INTEGER NOT NULL DEFAULT 0`);
  }
  if (!repairCols.find((c: any) => c.name === "total_cost")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN total_cost REAL NOT NULL DEFAULT 0`);
  }
  if (!repairCols.find((c: any) => c.name === "quote_sent_at")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN quote_sent_at TEXT`);
  }
  if (!repairCols.find((c: any) => c.name === "quote_responded_at")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN quote_responded_at TEXT`);
  }
  if (!repairCols.find((c: any) => c.name === "quote_response")) {
    getDb().exec(`ALTER TABLE repair_tickets ADD COLUMN quote_response TEXT`);
  }

  // Add repair_images table
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS repair_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_type TEXT NOT NULL DEFAULT 'before' CHECK(image_type IN ('before','after')),
      uploaded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_repair_images_ticket ON repair_images(ticket_id);
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      supplier_contact TEXT NOT NULL DEFAULT '',
      order_date TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ordered','received','cancelled')),
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      quantity_ordered INTEGER NOT NULL DEFAULT 1,
      quantity_received INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_items_order ON purchase_order_items(purchase_order_id);
  `);

  // Add wishlist table
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON wishlist(customer_id);
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      quote_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','declined')),
      notes TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Add min_tier column to products if missing
  const prodCols = getDb().prepare("PRAGMA table_info(products)").all() as any[];
  if (!prodCols.find((c: any) => c.name === "min_tier")) {
    getDb().exec(`ALTER TABLE products ADD COLUMN min_tier INTEGER NOT NULL DEFAULT 0`);
  }

  // Add shipping_county and shipping_fee to orders if missing
  const orderCols = getDb().prepare("PRAGMA table_info(orders)").all() as any[];
  if (!orderCols.find((c: any) => c.name === "shipping_county")) {
    getDb().exec(`ALTER TABLE orders ADD COLUMN shipping_county TEXT NOT NULL DEFAULT ''`);
  }
  if (!orderCols.find((c: any) => c.name === "shipping_fee")) {
    getDb().exec(`ALTER TABLE orders ADD COLUMN shipping_fee REAL NOT NULL DEFAULT 0`);
  }
  if (!orderCols.find((c: any) => c.name === "staff_id")) {
    getDb().exec(`ALTER TABLE orders ADD COLUMN staff_id INTEGER REFERENCES users(id)`);
  }

  const orderItemCols = getDb().prepare("PRAGMA table_info(order_items)").all() as any[];
  if (!orderItemCols.find((c: any) => c.name === "has_warranty")) {
    getDb().exec(`ALTER TABLE order_items ADD COLUMN has_warranty INTEGER NOT NULL DEFAULT 0`);
  }
  if (!orderItemCols.find((c: any) => c.name === "warranty_duration")) {
    getDb().exec(`ALTER TABLE order_items ADD COLUMN warranty_duration INTEGER NOT NULL DEFAULT 0`);
  }

  const prodCols2 = getDb().prepare("PRAGMA table_info(products)").all() as any[];
  if (!prodCols2.find((c: any) => c.name === "has_warranty")) {
    getDb().exec(`ALTER TABLE products ADD COLUMN has_warranty INTEGER NOT NULL DEFAULT 0`);
  }
  if (!prodCols2.find((c: any) => c.name === "warranty_duration")) {
    getDb().exec(`ALTER TABLE products ADD COLUMN warranty_duration INTEGER NOT NULL DEFAULT 0`);
  }

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS stock_take_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS stock_take_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES stock_take_sessions(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      system_quantity INTEGER NOT NULL DEFAULT 0,
      counted_quantity INTEGER,
      variance INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stock_take_items_session ON stock_take_items(session_id);
    CREATE INDEX IF NOT EXISTS idx_stock_take_items_product ON stock_take_items(product_id);
    CREATE TABLE IF NOT EXISTS stock_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(snapshot_date, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_snapshots_date ON stock_snapshots(snapshot_date);
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS subscription_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS spec_template_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT NOT NULL DEFAULT '[]',
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_spec_template_fields_category ON spec_template_fields(category);
  `);

  // Add actor_role column to audit_log if missing
  try { getDb().exec(`ALTER TABLE audit_log ADD COLUMN actor_role TEXT NOT NULL DEFAULT ''`); } catch {}

  // Ensure shop_plan_id exists in settings
  const existing = getDb().prepare("SELECT value FROM settings WHERE key = 'shop_plan_id'").get();
  if (!existing) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('shop_plan_id', 'starter')").run();
  }

  // Add last_login, is_active, phone to customers
  const custCols = getDb().prepare("PRAGMA table_info(customers)").all() as any[];
  if (!custCols.find((c: any) => c.name === "last_login")) {
    try { getDb().exec(`ALTER TABLE customers ADD COLUMN last_login TEXT`); } catch {}
  }
  if (!custCols.find((c: any) => c.name === "is_active")) {
    try { getDb().exec(`ALTER TABLE customers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`); } catch {}
  }
  if (!custCols.find((c: any) => c.name === "phone")) {
    try { getDb().exec(`ALTER TABLE customers ADD COLUMN phone TEXT NOT NULL DEFAULT ''`); } catch {}
  }

  // Add max_branches to subscription_plans if missing
  const planCols = getDb().prepare("PRAGMA table_info(subscription_plans)").all() as any[];
  if (!planCols.find((c: any) => c.name === "max_branches")) {
    getDb().exec(`ALTER TABLE subscription_plans ADD COLUMN max_branches INTEGER NOT NULL DEFAULT 1`);
    // Backfill proper values for known plans
    getDb().prepare("UPDATE subscription_plans SET max_branches = ? WHERE id = ?").run(1, "starter");
    getDb().prepare("UPDATE subscription_plans SET max_branches = ? WHERE id = ?").run(2, "basic");
    getDb().prepare("UPDATE subscription_plans SET max_branches = ? WHERE id = ?").run(5, "pro");
    getDb().prepare("UPDATE subscription_plans SET max_branches = ? WHERE id = ?").run(-1, "enterprise");

    // Backfill "Branch management" feature for non-starter plans
    const allPlans = getDb().prepare("SELECT id, features FROM subscription_plans").all() as any[];
    for (const p of allPlans) {
      if (p.id === "starter") continue;
      const feats: string[] = JSON.parse(p.features || "[]");
      if (!feats.some((f: string) => f.toLowerCase().trim() === "branch management")) {
        feats.push("Branch management");
        getDb().prepare("UPDATE subscription_plans SET features = ? WHERE id = ?").run(JSON.stringify(feats), p.id);
      }
    }
  }

  // Create branches table
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add branch_id to orders
  const ordCols = getDb().prepare("PRAGMA table_info(orders)").all() as any[];
  if (!ordCols.find((c: any) => c.name === "branch_id")) {
    getDb().exec(`ALTER TABLE orders ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL`);
  }

  // Ensure store_layout exists in settings
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'store_layout'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('store_layout', 'original')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'store_banners'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('store_banners', '[]')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'store_features'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('store_features', '[]')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'about_us'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('about_us', '{\"title\":\"About Us\",\"content\":\"We are a leading retailer of computers, laptops, and accessories.\",\"mission\":\"To provide quality tech products at affordable prices.\",\"vision\":\"To be the most trusted tech retailer in the region.\"}')").run();
  }

  initRoles(getDb());
  ensureTechnicianUser();

  // Create clients table for multi-tenant management
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      db_path TEXT NOT NULL DEFAULT '',
      settings TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'percentage' CHECK(type IN ('percentage','fixed')),
      value REAL NOT NULL DEFAULT 0,
      min_order_amount REAL NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS coupon_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id),
      order_id INTEGER NOT NULL REFERENCES orders(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      discount_amount REAL NOT NULL DEFAULT 0,
      used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  try { getDb().exec(`ALTER TABLE orders ADD COLUMN coupon_id INTEGER REFERENCES coupons(id)`); } catch {}
  try { getDb().exec(`ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0`); } catch {}

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id),
      old_price REAL NOT NULL DEFAULT 0,
      new_price REAL NOT NULL DEFAULT 0,
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
  `);

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title TEXT NOT NULL DEFAULT '',
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  getDb().exec(`
    CREATE TABLE IF NOT EXISTS loyalty_points (
      customer_id INTEGER PRIMARY KEY REFERENCES customers(id),
      points INTEGER NOT NULL DEFAULT 0,
      lifetime_earned INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      points INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('earn','redeem','expire','admin')),
      reference_type TEXT NOT NULL DEFAULT '',
      reference_id TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);
  `);

  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'loyalty_rate'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('loyalty_rate', '10')").run(); // 10 points per KES 100
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'loyalty_redemption_rate'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('loyalty_redemption_rate', '1')").run(); // 1 point = KES 1
  }

  // Seed default client entry for the existing shop if none exist
  const existingClientCount = getDb().prepare("SELECT COUNT(*) AS count FROM clients").get() as any;
  if (!existingClientCount || existingClientCount.count === 0) {
    const shopName = getStoreSetting("storeName") || "My Shop";
    const shopEmail = getStoreSetting("email") || "";
    const shopPhone = getStoreSetting("phone") || "";
    getDb().prepare(`
      INSERT INTO clients (name, email, phone, db_path, settings) VALUES (?, ?, ?, ?, ?)
    `).run(shopName, shopEmail, shopPhone, DB_PATH, JSON.stringify({ migrated: true }));
  }

  // eTIMS migration
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN etims_invoice_number TEXT`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN control_code TEXT`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN kra_pin TEXT`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN serial_number INTEGER`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN internal_data TEXT`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN signature_data TEXT`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN receipt_date TEXT`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN receipt_counter INTEGER`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN total_receipts INTEGER`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN tax_type TEXT NOT NULL DEFAULT 'A'`); } catch {}
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN payment_type TEXT NOT NULL DEFAULT '04'`); } catch {}
  try { getDb().exec(`ALTER TABLE order_items ADD COLUMN taxable INTEGER NOT NULL DEFAULT 1`); } catch {}
  // VSCU receipt counter
  try { getDb().exec(`ALTER TABLE order_invoices ADD COLUMN vscu_receipt_no INTEGER`); } catch {}
  // POS security columns
  try { getDb().exec(`ALTER TABLE orders ADD COLUMN processed_by TEXT`); } catch {}
  try { getDb().exec(`ALTER TABLE orders ADD COLUMN idempotency_key TEXT`); } catch {}
  try { getDb().exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key)`); } catch {}
  // OSCU / VSCU mode
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_mode'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_mode', 'vscu')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_branch_id'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_branch_id', '00')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_device_serial'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_device_serial', 'dvc001')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_vscu_url'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_vscu_url', 'http://localhost:8088')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_oscu_api_url'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_oscu_api_url', 'https://etims.kra.go.ke/api')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_oscu_consumer_key'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_oscu_consumer_key', '')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_oscu_consumer_secret'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_oscu_consumer_secret', '')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'kra_pin'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('kra_pin', 'P051234567Z')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_serial_prefix'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_serial_prefix', '01')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_last_serial'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_last_serial', '1')").run();
  }
  if (!getDb().prepare("SELECT value FROM settings WHERE key = 'etims_vscu_receipt_counter'").get()) {
    getDb().prepare("INSERT INTO settings (key, value) VALUES ('etims_vscu_receipt_counter', '0')").run();
  }
}

function initDb(): Db {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      specs TEXT NOT NULL DEFAULT '[]',
      in_stock INTEGER NOT NULL DEFAULT 1,
      image_alt TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      subcategory TEXT NOT NULL DEFAULT '',
      taxable INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  runMigrations();
  ensureDefaultSettings();
  ensureDefaultCategories();
  ensureAdminUser();
  ensureTechnicianUser();
  seedProductsIfEmpty();
  assignInitialRoles();
  ensureDefaultSubscriptionPlans();
  seedDemoProvider();
  seedDemoCustomer();

  // Backfill order invoices for existing shipped/delivered orders
  const currency = getSettings().currency;
  getDb().prepare(`
    INSERT OR IGNORE INTO order_invoices (order_id, amount, currency, status)
    SELECT o.id, (o.subtotal + o.shipping_fee), ?, 'pending'
    FROM orders o
    WHERE o.status IN ('shipped', 'delivered')
    AND NOT EXISTS (SELECT 1 FROM order_invoices oi WHERE oi.order_id = o.id)
  `).run(currency);

  return db;
}

function getDb(): Db {
  if (!db) initDb();
  return db;
}

function ensureDefaultSettings(): void {
  const defaults: { [key: string]: string } = {
    storeName: "Gear&Glitch",
    phone: "01234 567890",
    email: "sales@computerstore.example",
    currency: "KES",
    storeLogo: "",
  };

  const existing = getDb().prepare("SELECT COUNT(*) AS count FROM settings").get() as { count: number } | undefined;
  if (existing && existing.count > 0) return;

  const insert = getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value);
  }
}

function ensureDefaultCategories(): void {
  const existing = getDb().prepare("SELECT COUNT(*) AS count FROM categories").get() as { count: number } | undefined;
  if (existing && existing.count > 0) return;

  const insert = getDb().prepare("INSERT INTO categories (id, label, group_name) VALUES (?, ?, ?)");
  for (const category of CATEGORIES) {
    insert.run(category.id, category.label, category.group || "");
  }
}

function listCategories(): Category[] {
  return getDb()
    .prepare("SELECT id, label, group_name FROM categories ORDER BY group_name, label")
    .all()
    .map((row: any) => ({ id: row.id, label: row.label, group: row.group_name }));
}

function getCategory(id: string): CategoryRow | undefined {
  return getDb().prepare("SELECT id, label, group_name FROM categories WHERE id = ?").get(id) as CategoryRow | undefined;
}

function createCategory(category: { id: string; label: string; group?: string }): CategoryRow | undefined {
  getDb()
    .prepare("INSERT INTO categories (id, label, group_name) VALUES (@id, @label, @group)")
    .run({ id: category.id, label: category.label, group: category.group || "" });
  return getCategory(category.id);
}

function updateCategory(id: string, updates: { label?: string; group?: string }): CategoryRow | undefined | null {
  const existing = getCategory(id);
  if (!existing) return null;
  const label = updates.label ?? existing.label;
  const group = updates.group ?? existing.group_name;
  getDb()
    .prepare("UPDATE categories SET label = @label, group_name = @group WHERE id = @id")
    .run({ id, label, group });
  return getCategory(id);
}

function deleteCategory(id: string): boolean {
  const result = getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
  return result.changes > 0;
}

function isValidCategory(id: string): boolean {
  return Boolean(getCategory(id));
}

// ============ SUBCATEGORIES ============

function listSubcategories(): any[] {
  return getDb()
    .prepare("SELECT id, name, category_ids, created_at FROM subcategories ORDER BY name")
    .all()
    .map((row: any) => ({ ...row, category_ids: JSON.parse(row.category_ids || "[]") }));
}

function getSubcategory(id: string): any {
  const row = getDb().prepare("SELECT id, name, category_ids, created_at FROM subcategories WHERE id = ?").get(id) as any;
  if (!row) return undefined;
  return { ...row, category_ids: JSON.parse(row.category_ids || "[]") };
}

function createSubcategory(data: { id: string; name: string; category_ids?: string[] }): any {
  const ids = JSON.stringify(data.category_ids || []);
  getDb()
    .prepare("INSERT INTO subcategories (id, name, category_ids) VALUES (@id, @name, @ids)")
    .run({ id: data.id, name: data.name, ids });
  return getSubcategory(data.id);
}

function updateSubcategory(id: string, updates: { name?: string; category_ids?: string[] }): any {
  const existing = getSubcategory(id);
  if (!existing) return null;
  const name = updates.name ?? existing.name;
  const category_ids = updates.category_ids !== undefined ? JSON.stringify(updates.category_ids) : JSON.stringify(existing.category_ids);
  getDb()
    .prepare("UPDATE subcategories SET name = @name, category_ids = @ids WHERE id = @id")
    .run({ id, name, ids: category_ids });
  return getSubcategory(id);
}

function deleteSubcategory(id: string): boolean {
  const result = getDb().prepare("DELETE FROM subcategories WHERE id = ?").run(id);
  return result.changes > 0;
}

function getSubcategoriesForCategory(categoryId: string): any[] {
  return listSubcategories().filter((s) => s.category_ids.includes(categoryId));
}

function ensureAdminUser(): void {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number } | undefined;
  if (row && row.count > 0) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_EMAIL || "admin@gearandglitch.com";
  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      console.warn("ADMIN_PASSWORD not set — skipping admin user creation. Set ADMIN_PASSWORD in .env and restart.");
      return;
    }
    password = "admin123";
    console.warn("Using default admin password 'admin123' for development. Set ADMIN_PASSWORD in .env for production.");
  }
  const passwordHash = bcrypt.hashSync(password, 10);

  getDb()
    .prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(username, email, passwordHash);

  console.log(`Created admin user "${username}" (${email}).`);
}

function ensureTechnicianUser(): void {
  const techUser = process.env.TECH_USERNAME || "technician";
  const techEmail = process.env.TECH_EMAIL || "tech@gearandglitch.com";
  let password = process.env.TECH_PASSWORD || "";
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      console.warn("TECH_PASSWORD not set — skipping technician creation. Set TECH_PASSWORD in .env and restart.");
      return;
    }
    password = "tech123";
    console.warn("Using default tech password 'tech123' for development. Set TECH_PASSWORD in .env for production.");
  }

  const existing = getDb().prepare("SELECT id, email FROM users WHERE username = ?").get(techUser) as any;
  if (existing) {
    if (existing.email !== techEmail) {
      getDb().prepare("UPDATE users SET email = ? WHERE id = ?").run(techEmail, existing.id);
    }
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  getDb()
    .prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'technician')")
    .run(techUser, techEmail, passwordHash);

  console.log(`Created technician user "${techUser}" (${techEmail}).`);
}

function seedDemoProvider(): void {
  if (process.env.NODE_ENV === "production") return;
  const demoEmail = "provider@gearandglitch.com";
  const existing = findProviderByEmail(demoEmail);
  if (existing) return;

  const pwdHash = bcrypt.hashSync("provider123", 10);
  const result = getDb()
    .prepare("INSERT INTO providers (company_name, contact_name, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, 'active')")
    .run("Demo Company", "Demo Provider", demoEmail, "0123456789", pwdHash);
  const providerId = result.lastInsertRowid as number;

  const plan = getSubscriptionPlan("starter");
  if (plan) {
    const today = new Date().toISOString().slice(0, 10);
    getDb()
      .prepare("INSERT INTO provider_plan_assignments (provider_id, plan_id, status, start_date) VALUES (?, ?, 'active', ?)")
      .run(providerId, plan.id, today);
  }
  console.log(`Created demo provider (${demoEmail} / provider123).`);
}

function seedDemoCustomer(): void {
  if (process.env.NODE_ENV === "production") return;
  const demoEmail = "customer@gearandglitch.com";
  const existing = findCustomerByEmail(demoEmail);
  if (existing) return;

  const pwdHash = bcrypt.hashSync("customer123", 10);
  getDb()
    .prepare("INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)")
    .run("Demo Customer", demoEmail, pwdHash);
  console.log(`Created demo customer (${demoEmail} / customer123).`);
}

function assignInitialRoles(): void {
  const { getUserRoles } = require("./permissions");

  for (const role of ["admin", "owner", "technician"]) {
    const user = getDb().prepare("SELECT id FROM users WHERE role = ?").get(role) as { id: number } | undefined;
    if (user) {
      const existingRoles = getUserRoles(getDb(), user.id);
      if (!existingRoles.find((r: any) => r.id === role)) {
        assignRoleToUser(getDb(), user.id, role);
      }
    }
  }
}

function findStaffByUsername(username: string): StaffWithPassword | undefined {
  return getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as StaffWithPassword | undefined;
}

function findStaffByEmail(email: string): StaffWithPassword | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as StaffWithPassword | undefined;
}

function findStaffById(id: number): Staff | undefined {
  return getDb()
    .prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?")
    .get(id) as Staff | undefined;
}

function listStaff(): Staff[] {
  return getDb()
    .prepare("SELECT id, username, email, role FROM users ORDER BY username")
    .all() as Staff[];
}

function updateStaffDetails(id: number, data: { username?: string; email?: string }): Staff | null {
  const fields: string[] = [];
  const params: any[] = [];
  if (data.username !== undefined) { fields.push("username = ?"); params.push(data.username); }
  if (data.email !== undefined) { fields.push("email = ?"); params.push(data.email); }
  if (fields.length === 0) return null;
  params.push(id);
  const result = getDb().prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  if (result.changes === 0) return null;
  return findStaffById(id) || null;
}

function seedProductsIfEmpty(): void {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number } | undefined;
  if (row && row.count > 0) return;

  const seedPath = path.join(__dirname, "..", "products.json");
  if (!fs.existsSync(seedPath)) {
    console.log("No products.json seed file found; starting with empty catalog.");
    return;
  }

  const catalog = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const insert = getDb().prepare(`
    INSERT INTO products (id, category, name, price, specs, in_stock, image_alt, image_url)
    VALUES (@id, @category, @name, @price, @specs, @in_stock, @image_alt, @image_url)
  `);

  const insertMany = getDb().transaction((products: any[]) => {
    for (const product of products) {
      insert.run({
        id: product.id,
        category: product.category,
        name: product.name,
        price: product.price,
        specs: JSON.stringify(product.specs || []),
        in_stock: product.inStock ? 1 : 0,
        image_alt: product.imageAlt || "",
        image_url: product.imageUrl || "",
      });
    }
  });

  insertMany(catalog.products || []);
  console.log(`Seeded ${catalog.products.length} products from products.json`);
}

function getSettings(): Settings {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings: { [key: string]: string } = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return {
    storeName: settings.storeName || "Gear&Glitch",
    phone: settings.phone || "",
    email: settings.email || "",
    currency: settings.currency || "KES",
    storeLogo: settings.storeLogo || "",
    taxRate: Number(settings.taxRate) || 0,
  };
}

interface PaymentMethod {
  id: string;
  name: string;
  kraCode: string;
  needsTender: boolean;
}

function getPaymentMethods(): PaymentMethod[] {
  const raw = getStoreSetting("payment_methods");
  if (raw) { try { return JSON.parse(raw); } catch {} }
  const defaults: PaymentMethod[] = [
    { id: "cash", name: "Cash", kraCode: "01", needsTender: true },
    { id: "mpesa", name: "M-Pesa", kraCode: "04", needsTender: false },
    { id: "card", name: "Card", kraCode: "02", needsTender: false },
  ];
  return defaults;
}

function setPaymentMethods(methods: PaymentMethod[]): void {
  setStoreSetting("payment_methods", JSON.stringify(methods));
}

function updateSettings(updates: { [key: string]: any }): Settings {
  const allowed = ["storeName", "phone", "email", "currency", "storeLogo", "taxRate"];
  if (updates.paymentMethods) {
    setPaymentMethods(updates.paymentMethods);
  }
  const stmt = getDb().prepare(`
    INSERT INTO settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  getDb().transaction((data: { [key: string]: any }) => {
    for (const key of allowed) {
      if (data[key] !== undefined) {
        stmt.run({ key, value: String(data[key]) });
      }
    }
  })(updates);

  return getSettings();
}

function getStoreSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
  return row ? row.value : null;
}

function setStoreSetting(key: string, value: string): void {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

function listProducts(options: { category?: string; minTier?: number } = {}): Product[] {
  let sql = "SELECT * FROM products WHERE 1=1";
  const params: any[] = [];
  if (options.category) { sql += " AND category = ?"; params.push(options.category); }
  if (options.minTier !== undefined) { sql += " AND (min_tier IS NULL OR min_tier <= ?)"; params.push(options.minTier); }
  sql += " ORDER BY category, name COLLATE NOCASE";
  const rows = getDb().prepare(sql).all(...params) as ProductRow[];
  return rows.map(mapProduct).filter((p): p is Product => p !== null);
}

function getProduct(id: string): Product | null {
  const row = getDb().prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  return mapProduct(row || null);
}

function setProductImageUrl(id: string, imageUrl: string): Product | null {
  getDb()
    .prepare(`UPDATE products SET image_url = @image_url, updated_at = datetime('now') WHERE id = @id`)
    .run({ id, image_url: imageUrl });
  return getProduct(id);
}

interface ProductImage {
  id: number;
  product_id: string;
  image_url: string;
  sort_order: number;
  is_primary: number;
  created_at: string;
}

function getProductImages(productId: string): ProductImage[] {
  return getDb()
    .prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC")
    .all(productId) as ProductImage[];
}

function addProductImage(productId: string, imageUrl: string, sortOrder?: number): ProductImage {
  const maxSort = getDb()
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = ?")
    .get(productId) as { next: number };
  const order = sortOrder ?? maxSort.next;
  const result = getDb()
    .prepare("INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)")
    .run(productId, imageUrl, order);
  return getDb()
    .prepare("SELECT * FROM product_images WHERE id = ?")
    .get(result.lastInsertRowid) as ProductImage;
}

function deleteProductImage(imageId: number): boolean {
  const result = getDb().prepare("DELETE FROM product_images WHERE id = ?").run(imageId);
  return result.changes > 0;
}

function setProductImageOrder(imageId: number, sortOrder: number): void {
  getDb().prepare("UPDATE product_images SET sort_order = ? WHERE id = ?").run(sortOrder, imageId);
}

function setPrimaryImage(productId: string, imageId: number): void {
  getDb().prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ?").run(productId);
  getDb().prepare("UPDATE product_images SET is_primary = 1 WHERE id = ? AND product_id = ?").run(imageId, productId);
}

// ============ MESSAGES ============

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

function getMessagesForCustomer(customerId: number): Message[] {
  return getDb().prepare(`
    SELECT m.*, p.company_name AS providerName
    FROM messages m
    LEFT JOIN providers p ON p.id = m.provider_id
    WHERE m.customer_id = ?
    ORDER BY m.created_at DESC
  `).all(customerId) as Message[];
}

function getMessagesForProvider(providerId: number): Message[] {
  return getDb().prepare(`
    SELECT m.*, c.name AS customerName
    FROM messages m
    LEFT JOIN customers c ON c.id = m.customer_id
    WHERE m.provider_id = ?
    ORDER BY m.created_at DESC
  `).all(providerId) as Message[];
}

function sendMessage(msg: { customerId: number; providerId: number; productId?: string; subject?: string; body: string; senderRole: "customer" | "provider" }): Message | null {
  const result = getDb().prepare(`
    INSERT INTO messages (customer_id, provider_id, product_id, subject, body, sender_role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.customerId, msg.providerId, msg.productId || null, msg.subject || "", msg.body, msg.senderRole);
  return getDb().prepare("SELECT * FROM messages WHERE id = ?").get(result.lastInsertRowid) as Message | null;
}

function markMessageRead(messageId: number): boolean {
  const result = getDb().prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ? AND read_at IS NULL").run(messageId);
  return result.changes > 0;
}

function getUnreadMessageCount(providerId: number): number {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM messages WHERE provider_id = ? AND read_at IS NULL AND sender_role = 'customer'").get(providerId) as any;
  return row?.count || 0;
}

function createProduct(product: { id: string; category: string; name: string; price: number; specs: any[]; inStock: boolean; isNonStock?: boolean; subcategory?: string; hasWarranty?: boolean; warrantyDuration?: number; taxable?: boolean; imageAlt?: string; imageUrl?: string }): Product | null {
  getDb()
    .prepare(`
      INSERT INTO products (id, category, name, price, specs, in_stock, is_non_stock, subcategory, has_warranty, warranty_duration, taxable, image_alt, image_url, updated_at)
      VALUES (@id, @category, @name, @price, @specs, @in_stock, @is_non_stock, @subcategory, @has_warranty, @warranty_duration, @taxable, @image_alt, @image_url, datetime('now'))
    `)
    .run({
      id: product.id,
      category: product.category,
      name: product.name,
      price: product.price,
      specs: JSON.stringify(product.specs || []),
      in_stock: product.inStock ? 1 : 0,
      is_non_stock: product.isNonStock ? 1 : 0,
      subcategory: product.subcategory || "",
      has_warranty: product.hasWarranty ? 1 : 0,
      warranty_duration: product.warrantyDuration || 0,
      taxable: product.taxable !== false ? 1 : 0,
      image_alt: product.imageAlt || "",
      image_url: product.imageUrl || "",
    });
  return getProduct(product.id);
}

function updateProduct(id: string, updates: any): Product | null {
  const existing = getProduct(id);
  if (!existing) return null;

  const merged = {
    category: updates.category ?? existing.category,
    name: updates.name ?? existing.name,
    price: updates.price ?? existing.price,
    specs: updates.specs ?? existing.specs,
    inStock: updates.inStock ?? existing.inStock,
    isNonStock: updates.isNonStock ?? existing.isNonStock,
    subcategory: updates.subcategory ?? existing.subcategory,
    hasWarranty: updates.hasWarranty ?? existing.hasWarranty,
    warrantyDuration: updates.warrantyDuration ?? existing.warrantyDuration,
    taxable: updates.taxable ?? existing.taxable,
    imageAlt: updates.imageAlt ?? existing.imageAlt,
    imageUrl: updates.imageUrl ?? existing.imageUrl,
  };

  if (updates.price !== undefined && Number(updates.price) !== existing.price) {
    getDb().prepare("INSERT INTO price_history (product_id, old_price, new_price) VALUES (?, ?, ?)").run(id, existing.price, Number(updates.price));
  }

  getDb()
    .prepare(`
      UPDATE products SET
        category = @category, name = @name, price = @price,
        specs = @specs, in_stock = @in_stock, is_non_stock = @is_non_stock,
        subcategory = @subcategory, has_warranty = @has_warranty, warranty_duration = @warranty_duration,
        taxable = @taxable, image_alt = @image_alt, image_url = @image_url, updated_at = datetime('now')
      WHERE id = @id
    `)
    .run({
      id,
      category: merged.category,
      name: merged.name,
      price: merged.price,
      specs: JSON.stringify(merged.specs),
      in_stock: merged.inStock ? 1 : 0,
      is_non_stock: merged.isNonStock ? 1 : 0,
      subcategory: merged.subcategory,
      has_warranty: merged.hasWarranty ? 1 : 0,
      warranty_duration: merged.warrantyDuration || 0,
      taxable: merged.taxable !== false ? 1 : 0,
      image_alt: merged.imageAlt,
      image_url: merged.imageUrl,
    });

  return getProduct(id);
}

function deleteProduct(id: string): boolean {
  const result = getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
  if (result.changes > 0) {
    deleteProductImages(id);
  }
  return result.changes > 0;
}

function getPriceHistory(productId: string): any[] {
  return getDb().prepare("SELECT * FROM price_history WHERE product_id = ? ORDER BY changed_at DESC LIMIT 50").all(productId);
}

function findAdminByUsername(username: string): StaffWithPassword | undefined {
  return findStaffByUsername(username);
}

function findCustomerByEmail(email: string): CustomerWithPassword | undefined {
  return getDb().prepare("SELECT * FROM customers WHERE email = ?").get(email) as CustomerWithPassword | undefined;
}

function findCustomerById(id: number): Customer | undefined {
  return getDb().prepare("SELECT id, name, email, phone, is_active, last_login, created_at FROM customers WHERE id = ?").get(id) as Customer | undefined;
}

function updateCustomerLastLogin(customerId: number): void {
  getDb().prepare("UPDATE customers SET last_login = datetime('now') WHERE id = ?").run(customerId);
}

function updateCustomerStatus(customerId: number, isActive: number): void {
  getDb().prepare("UPDATE customers SET is_active = ? WHERE id = ?").run(isActive, customerId);
}

function deleteCustomer(customerId: number): boolean {
  const result = getDb().prepare("DELETE FROM customers WHERE id = ?").run(customerId);
  return result.changes > 0;
}

function deactivateOldCustomers(): number {
  const result = getDb().prepare(
    "UPDATE customers SET is_active = 0 WHERE is_active = 1 AND last_login IS NOT NULL AND last_login < datetime('now', '-1 year')"
  ).run();
  return result.changes;
}

function createCustomer(name: string, email: string, password: string, phone: string = ""): Customer | undefined {
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = getDb()
    .prepare("INSERT INTO customers (name, email, password_hash, phone) VALUES (?, ?, ?, ?)")
    .run(name, email, passwordHash, phone);
  return findCustomerById(result.lastInsertRowid as number);
}

function getCartItems(customerId: number): CartItem[] {
  const rows = getDb()
    .prepare(`
      SELECT ci.product_id, ci.quantity, p.name, p.price, p.in_stock, p.image_url, p.image_alt, p.category
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.customer_id = ?
      ORDER BY ci.updated_at DESC
    `)
    .all(customerId) as any[];

  return rows.map((row) => {
    const product = getProduct(row.product_id);
    return {
      productId: row.product_id,
      quantity: row.quantity,
      name: row.name,
      price: row.price,
      inStock: Boolean(row.in_stock),
      imageUrl: product?.imageUrl || "",
      imageAlt: row.image_alt || row.name,
      lineTotal: row.price * row.quantity,
      hasWarranty: product?.hasWarranty || false,
      warrantyDuration: product?.warrantyDuration || 0,
    };
  });
}

function getCartCount(customerId: number): number {
  const row = getDb()
    .prepare(`SELECT COALESCE(SUM(quantity), 0) AS count FROM cart_items WHERE customer_id = ?`)
    .get(customerId) as { count: number };
  return row.count;
}

function addToCart(customerId: number, productId: string, quantity: number = 1): { ok: boolean; error?: string } {
  const product = getProduct(productId);
  if (!product) return { ok: false, error: "Product not found." };

  const existing = getDb()
    .prepare("SELECT * FROM cart_items WHERE customer_id = ? AND product_id = ?")
    .get(customerId, productId);

  if (existing) {
    getDb()
      .prepare(`UPDATE cart_items SET quantity = quantity + @qty, updated_at = datetime('now')
                WHERE customer_id = @customer_id AND product_id = @product_id`)
      .run({ customer_id: customerId, product_id: productId, qty: quantity });
  } else {
    getDb()
      .prepare(`INSERT INTO cart_items (customer_id, product_id, quantity) VALUES (?, ?, ?)`)
      .run(customerId, productId, quantity);
  }

  return { ok: true };
}

function setCartQuantity(customerId: number, productId: string, quantity: number): boolean {
  if (quantity < 1) {
    return removeFromCart(customerId, productId);
  }

  const result = getDb()
    .prepare(`UPDATE cart_items SET quantity = @quantity, updated_at = datetime('now')
              WHERE customer_id = @customer_id AND product_id = @product_id`)
    .run({ customer_id: customerId, product_id: productId, quantity });

  return result.changes > 0;
}

function removeFromCart(customerId: number, productId: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM cart_items WHERE customer_id = ? AND product_id = ?")
    .run(customerId, productId);
  return result.changes > 0;
}

function clearCart(customerId: number): void {
  getDb().prepare("DELETE FROM cart_items WHERE customer_id = ?").run(customerId);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function generateProductId(name: string): string {
  const base = slugify(name) || "product";
  let id = base;
  let n = 1;
  while (getProduct(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function createStaff(username: string, password: string, role: string = "technician", email?: string): { ok: boolean; error?: string; staff?: Staff } {
  const existing = findStaffByUsername(username);
  if (existing) {
    return { ok: false, error: "Username already exists." };
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const staffEmail = email || `${username}@gearandglitch.com`;
  const result = getDb()
    .prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(username, staffEmail, passwordHash, role);

  assignRoleToUser(getDb(), Number(result.lastInsertRowid), role);

  return { ok: true, staff: findStaffById(result.lastInsertRowid as number) };
}

function updateStaffRole(userId: number, newRole: string): Staff | null {
  const result = getDb()
    .prepare("UPDATE users SET role = ? WHERE id = ?")
    .run(newRole, userId);

  if (result.changes > 0) {
    getDb().prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
    assignRoleToUser(getDb(), userId, newRole);
    return findStaffById(userId) || null;
  }
  return null;
}

function changeStaffPassword(userId: number, newPassword: string): boolean {
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const result = getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, userId);
  return result.changes > 0;
}

function updateCustomer(customerId: number, data: { name?: string; phone?: string }): boolean {
  const fields: string[] = [];
  const params: any[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
  if (data.phone !== undefined) { fields.push("phone = ?"); params.push(data.phone); }
  if (fields.length === 0) return false;
  params.push(customerId);
  const result = getDb().prepare(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  return result.changes > 0;
}

function changeCustomerPassword(customerId: number, newPassword: string): boolean {
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const result = getDb()
    .prepare("UPDATE customers SET password_hash = ? WHERE id = ?")
    .run(passwordHash, customerId);
  return result.changes > 0;
}

function deleteStaff(userId: number): boolean {
  const result = getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
  return result.changes > 0;
}

function getStockLevel(productId: string): StockLevel {
  const row = getDb()
    .prepare(`SELECT * FROM stock_levels WHERE product_id = ?`)
    .get(productId) as any | undefined;

  if (!row) {
    getDb()
      .prepare(`INSERT INTO stock_levels (product_id, quantity_in_stock) VALUES (?, 0)`)
      .run(productId);
    return {
      productId,
      quantityInStock: 0,
      quantityReserved: 0,
      quantitySold: 0,
      lowStockThreshold: 5,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    productId: row.product_id,
    quantityInStock: row.quantity_in_stock,
    quantityReserved: row.quantity_reserved,
    quantitySold: row.quantity_sold,
    lowStockThreshold: row.low_stock_threshold,
    updatedAt: row.updated_at,
  };
}

function updateStockLevel(productId: string, updates: any): StockLevel {
  const current = getStockLevel(productId);

  const quantityInStock = updates.quantityInStock ?? current.quantityInStock;
  const quantityReserved = updates.quantityReserved ?? current.quantityReserved;
  const quantitySold = updates.quantitySold ?? current.quantitySold;
  const lowStockThreshold = updates.lowStockThreshold ?? current.lowStockThreshold;

  getDb()
    .prepare(`UPDATE stock_levels SET
      quantity_in_stock = ?, quantity_reserved = ?, quantity_sold = ?,
      low_stock_threshold = ?, updated_at = datetime('now')
      WHERE product_id = ?`)
    .run(quantityInStock, quantityReserved, quantitySold, lowStockThreshold, productId);

  return getStockLevel(productId);
}

function recordStockMovement(productId: string, movementType: string, quantity: number, options: any = {}): void {
  const { referenceType, referenceId, notes, createdBy } = options;
  getDb()
    .prepare(`INSERT INTO stock_movements
      (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(productId, movementType, quantity, referenceType || null, referenceId || null, notes || null, createdBy || null);
}

function getStockMovements(productId: string, limit: number = 50): StockMovement[] {
  const rows = getDb()
    .prepare(`SELECT * FROM stock_movements
      WHERE product_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(productId, limit) as any[];

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    movementType: row.movement_type,
    quantity: row.quantity,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

function getLowStockItems(threshold: number | null = null): LowStockItem[] {
  const rows = getDb()
    .prepare(`SELECT p.id, p.name, p.price, sl.quantity_in_stock, sl.low_stock_threshold
      FROM stock_levels sl
      JOIN products p ON sl.product_id = p.id
      WHERE sl.quantity_in_stock <= (
        CASE WHEN ? IS NOT NULL THEN ? ELSE sl.low_stock_threshold END
      )
      ORDER BY sl.quantity_in_stock ASC`)
    .all(threshold, threshold) as any[];

  return rows.map((row) => ({
    productId: row.id,
    name: row.name,
    price: row.price,
    quantityInStock: row.quantity_in_stock,
    lowStockThreshold: row.low_stock_threshold,
  }));
}

// ============ STOCK TRANSFERS ============

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

function createStockTransfer(fromBranchId: number, toBranchId: number, productId: string, quantity: number, notes?: string, createdBy?: number): StockTransfer | undefined {
  const result = getDb()
    .prepare("INSERT INTO stock_transfers (from_branch_id, to_branch_id, product_id, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .run(fromBranchId, toBranchId, productId, quantity, notes || null, createdBy || null);
  return getStockTransfer(result.lastInsertRowid as number);
}

function getStockTransfer(id: number): StockTransfer | undefined {
  const row = getDb().prepare("SELECT * FROM stock_transfers WHERE id = ?").get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id, fromBranchId: row.from_branch_id, toBranchId: row.to_branch_id,
    productId: row.product_id, quantity: row.quantity, status: row.status,
    notes: row.notes, createdBy: row.created_by,
    completedAt: row.completed_at, createdAt: row.created_at,
  };
}

function listStockTransfers(status?: string): StockTransfer[] {
  let sql = "SELECT * FROM stock_transfers";
  const params: any[] = [];
  if (status) { sql += " WHERE status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC";
  return getDb().prepare(sql).all(...params).map((row: any) => ({
    id: row.id, fromBranchId: row.from_branch_id, toBranchId: row.to_branch_id,
    productId: row.product_id, quantity: row.quantity, status: row.status,
    notes: row.notes, createdBy: row.created_by,
    completedAt: row.completed_at, createdAt: row.created_at,
  }));
}

function completeStockTransfer(id: number): StockTransfer | undefined {
  const transfer = getStockTransfer(id);
  if (!transfer || transfer.status !== "pending") return undefined;
  getDb().prepare("UPDATE stock_transfers SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(id);
  return getStockTransfer(id);
}

function rejectStockTransfer(id: number): StockTransfer | undefined {
  const transfer = getStockTransfer(id);
  if (!transfer || transfer.status !== "pending") return undefined;
  getDb().prepare("UPDATE stock_transfers SET status = 'rejected', completed_at = datetime('now') WHERE id = ?").run(id);
  return getStockTransfer(id);
}

// ============ SUBSCRIPTION PLANS ============

function ensureDefaultSubscriptionPlans(): void {
  const existing = getDb().prepare("SELECT COUNT(*) AS count FROM subscription_plans").get() as { count: number } | undefined;
  if (existing && existing.count > 0) return;

  const insert = getDb().prepare(`INSERT INTO subscription_plans (id, name, description, price, tier_level, max_products, max_branches, features, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  insert.run("starter", "Starter", "For individual shoppers exploring the catalog", 0, 0, 10, 1, JSON.stringify(["Browse catalog", "View product details", "Wishlist", "Price alerts"]));
  insert.run("basic", "Basic", "For small business owners and resellers", 2500, 1, 100, 2, JSON.stringify(["Browse catalog", "View product details", "Wholesale pricing", "Email support", "Branch management", "Bulk discounts", "Order history export"]));
  insert.run("pro", "Professional", "For medium enterprises with multiple branches", 7500, 2, 500, 5, JSON.stringify(["Browse catalog", "View product details", "Wholesale pricing", "Priority support", "Bulk ordering", "Messaging", "Branch management", "API access", "Stock alerts", "Sales reports"]));
  insert.run("premium", "Premium", "For large businesses needing full integration", 15000, 3, 2000, 10, JSON.stringify(["Browse catalog", "View product details", "Wholesale pricing", "Dedicated support", "Bulk ordering", "API access", "Custom pricing", "Messaging", "Branch management", "Stock alerts", "Sales reports", "Multi-currency", "Dedicated account manager"]));
  insert.run("enterprise", "Enterprise", "Unlimited everything with white-glove service", 35000, 4, null, -1, JSON.stringify(["Browse catalog", "View product details", "Wholesale pricing", "Dedicated support", "Bulk ordering", "API access", "Custom pricing", "Messaging", "Branch management", "Stock alerts", "Sales reports", "Multi-currency", "Dedicated account manager", "Custom development", "SLA guarantee"]));
}

function listSubscriptionPlans(includeInactive: boolean = false): SubscriptionPlan[] {
  const sql = includeInactive
    ? "SELECT * FROM subscription_plans ORDER BY tier_level"
    : "SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY tier_level";
  return getDb().prepare(sql).all().map((row: any) => mapPlan(row));
}

function getSubscriptionPlan(id: string): SubscriptionPlan | undefined {
  const row = getDb().prepare("SELECT * FROM subscription_plans WHERE id = ?").get(id) as any;
  return row ? mapPlan(row) : undefined;
}

function createSubscriptionPlan(plan: { id: string; name: string; description?: string; price?: number; tierLevel?: number; maxProducts?: number | null; maxBranches?: number; features?: string[] }): SubscriptionPlan | undefined {
  getDb()
    .prepare("INSERT INTO subscription_plans (id, name, description, price, tier_level, max_products, max_branches, features, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)")
    .run(plan.id, plan.name, plan.description || "", plan.price || 0, plan.tierLevel || 0, plan.maxProducts ?? null, plan.maxBranches ?? 1, JSON.stringify(plan.features || []));
  return getSubscriptionPlan(plan.id);
}

function updateSubscriptionPlan(id: string, updates: any): SubscriptionPlan | undefined | null {
  const existing = getDb().prepare("SELECT * FROM subscription_plans WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const name = updates.name ?? existing.name;
  const description = updates.description ?? existing.description;
  const price = updates.price ?? existing.price;
  const tierLevel = updates.tierLevel ?? updates.tier_level ?? existing.tier_level;
  const maxProducts = updates.maxProducts !== undefined ? updates.maxProducts : existing.max_products;
  const maxBranches = updates.maxBranches !== undefined ? updates.maxBranches : existing.max_branches;
  const features = updates.features ? JSON.stringify(updates.features) : existing.features;
  const isActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : existing.is_active;
  getDb()
    .prepare("UPDATE subscription_plans SET name=?, description=?, price=?, tier_level=?, max_products=?, max_branches=?, features=?, is_active=? WHERE id=?")
    .run(name, description, price, tierLevel, maxProducts, maxBranches, features, isActive, id);
  return getSubscriptionPlan(id);
}

function deleteSubscriptionPlan(id: string): boolean {
  const result = getDb().prepare("DELETE FROM subscription_plans WHERE id = ?").run(id);
  return result.changes > 0;
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

// ============ BRANCHES ============

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

function listBranches(managerId?: number): Branch[] {
  let sql = `
    SELECT b.*, u.username AS manager_username
    FROM branches b
    LEFT JOIN users u ON u.id = b.manager_id
  `;
  const params: any[] = [];
  if (managerId !== undefined) {
    sql += " WHERE b.manager_id = ?";
    params.push(managerId);
  }
  sql += " ORDER BY b.name";
  return getDb().prepare(sql).all(...params).map((row: any) => mapBranch(row));
}

function getBranch(id: number): Branch | undefined {
  const row = getDb().prepare(`
    SELECT b.*, u.username AS manager_username
    FROM branches b
    LEFT JOIN users u ON u.id = b.manager_id
    WHERE b.id = ?
  `).get(id) as any;
  return row ? mapBranch(row) : undefined;
}

function createBranch(data: { name: string; address?: string; phone?: string; email?: string; managerId?: number | null }): Branch | undefined {
  const result = getDb()
    .prepare("INSERT INTO branches (name, address, phone, email, manager_id) VALUES (?, ?, ?, ?, ?)")
    .run(data.name, data.address || "", data.phone || "", data.email || "", data.managerId ?? null);
  return getBranch(result.lastInsertRowid as number);
}

function updateBranch(id: number, data: { name?: string; address?: string; phone?: string; email?: string; managerId?: number | null; isActive?: boolean }): Branch | undefined | null {
  const existing = getDb().prepare("SELECT * FROM branches WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const name = data.name ?? existing.name;
  const address = data.address ?? existing.address;
  const phone = data.phone ?? existing.phone;
  const email = data.email ?? existing.email;
  const managerId = data.managerId !== undefined ? data.managerId : existing.manager_id;
  const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active;
  getDb()
    .prepare("UPDATE branches SET name=?, address=?, phone=?, email=?, manager_id=?, is_active=? WHERE id=?")
    .run(name, address, phone, email, managerId, isActive, id);
  return getBranch(id);
}

function deleteBranch(id: number): boolean {
  const result = getDb().prepare("DELETE FROM branches WHERE id = ?").run(id);
  return result.changes > 0;
}

function getBranchCount(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM branches").get() as any;
  return row?.count ?? 0;
}

function getMaxBranchesForShop(): number {
  const plan = getShopPlan();
  if (!plan) return 1;
  return plan.maxBranches;
}

function canCreateBranch(): { allowed: boolean; current: number; max: number } {
  const current = getBranchCount();
  const max = getMaxBranchesForShop();
  return { allowed: max === -1 || current < max, current, max };
}

// ============ CLIENTS (Multi-Tenant) ============

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

const CLIENT_DATA_DIR = path.join(DATA_DIR, "clients");

function getClientSchemaSQL(): string {
  return `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      specs TEXT NOT NULL DEFAULT '[]',
      in_stock INTEGER NOT NULL DEFAULT 1,
      image_alt TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      subcategory TEXT NOT NULL DEFAULT '',
      min_tier INTEGER NOT NULL DEFAULT 0,
      has_warranty INTEGER NOT NULL DEFAULT 0,
      warranty_duration INTEGER NOT NULL DEFAULT 0,
      is_non_stock INTEGER NOT NULL DEFAULT 0,
      taxable INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      last_login TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      phone TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cart_customer ON cart_items(customer_id);
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      shipping_name TEXT NOT NULL DEFAULT '',
      shipping_address TEXT NOT NULL DEFAULT '',
      shipping_city TEXT NOT NULL DEFAULT '',
      shipping_postcode TEXT NOT NULL DEFAULT '',
      shipping_phone TEXT NOT NULL DEFAULT '',
      shipping_county TEXT NOT NULL DEFAULT '',
      shipping_fee REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      subtotal REAL NOT NULL DEFAULT 0,
      staff_id INTEGER REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      line_total REAL NOT NULL DEFAULT 0,
      has_warranty INTEGER NOT NULL DEFAULT 0,
      warranty_duration INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE TABLE IF NOT EXISTS stock_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL UNIQUE,
      quantity_in_stock INTEGER NOT NULL DEFAULT 0,
      quantity_reserved INTEGER NOT NULL DEFAULT 0,
      quantity_sold INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_branch_id INTEGER NOT NULL,
      to_branch_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_by INTEGER,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (from_branch_id) REFERENCES branches(id),
      FOREIGN KEY (to_branch_id) REFERENCES branches(id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      tier_level INTEGER NOT NULL DEFAULT 0,
      max_products INTEGER,
      max_branches INTEGER NOT NULL DEFAULT 1,
      features TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'trial',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS provider_plan_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL,
      custom_price REAL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_provider_plan_provider ON provider_plan_assignments(provider_id);
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
    CREATE TABLE IF NOT EXISTS product_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      viewer_type TEXT NOT NULL DEFAULT 'anonymous',
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id);
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KES',
      status TEXT NOT NULL DEFAULT 'pending',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_provider ON invoices(provider_id);
    CREATE TABLE IF NOT EXISTS order_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KES',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_invoices_order ON order_invoices(order_id);
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      product_id TEXT,
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'customer' CHECK(sender_role IN ('customer','provider')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_provider ON messages(provider_id);
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL DEFAULT '{}',
      actor_role TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS repair_tickets (
      id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      device_type TEXT NOT NULL,
      device_model TEXT NOT NULL DEFAULT '',
      issue_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      assigned_to INTEGER,
      eta_at TEXT NOT NULL,
      scheduled_at TEXT,
      diagnosis TEXT NOT NULL DEFAULT '',
      work_notes TEXT NOT NULL DEFAULT '',
      customer_notes TEXT NOT NULL DEFAULT '',
      repair_type TEXT,
      hardware_value REAL NOT NULL DEFAULT 0,
      labor_cost REAL NOT NULL DEFAULT 0,
      parts_cost REAL NOT NULL DEFAULT 0,
      software_install INTEGER NOT NULL DEFAULT 0,
      software_license INTEGER NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      quote_sent_at TEXT,
      quote_responded_at TEXT,
      quote_response TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS repair_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      staff_id INTEGER,
      update_type TEXT NOT NULL DEFAULT 'note',
      message TEXT NOT NULL,
      customer_visible INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS repair_parts_used (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      description TEXT NOT NULL,
      product_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_repairs_customer ON repair_tickets(customer_id);
    CREATE INDEX IF NOT EXISTS idx_repairs_status ON repair_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_repairs_scheduled ON repair_tickets(scheduled_at);
    CREATE TABLE IF NOT EXISTS repair_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      base_price REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS repair_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_type TEXT NOT NULL DEFAULT 'before' CHECK(image_type IN ('before','after')),
      uploaded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_repair_images_ticket ON repair_images(ticket_id);
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      supplier_contact TEXT NOT NULL DEFAULT '',
      order_date TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ordered','received','cancelled')),
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      quantity_ordered INTEGER NOT NULL DEFAULT 1,
      quantity_received INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_items_order ON purchase_order_items(purchase_order_id);
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON wishlist(customer_id);
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      quote_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','declined')),
      notes TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE TABLE IF NOT EXISTS stock_take_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS stock_take_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES stock_take_sessions(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      system_quantity INTEGER NOT NULL DEFAULT 0,
      counted_quantity INTEGER,
      variance INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stock_take_items_session ON stock_take_items(session_id);
    CREATE INDEX IF NOT EXISTS idx_stock_take_items_product ON stock_take_items(product_id);
    CREATE TABLE IF NOT EXISTS stock_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(snapshot_date, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_snapshots_date ON stock_snapshots(snapshot_date);
    CREATE TABLE IF NOT EXISTS subscription_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS spec_template_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_label TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      options TEXT NOT NULL DEFAULT '[]',
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_spec_template_fields_category ON spec_template_fields(category);
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      PRIMARY KEY (role_id, permission),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
  `;
}

const clientDbCache = new Map<number, Database.Database>();

function provisionClientDb(clientId: number, dbPath?: string): Database.Database {
  if (!fs.existsSync(CLIENT_DATA_DIR)) {
    fs.mkdirSync(CLIENT_DATA_DIR, { recursive: true });
  }
  const path_ = dbPath || path.join(CLIENT_DATA_DIR, `client_${clientId}.db`);
  const clientDb = new Database(path_);
  clientDb.exec(getClientSchemaSQL());
  // Seed default settings
  const insertSetting = clientDb.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  insertSetting.run("storeName", "New Shop");
  insertSetting.run("phone", "");
  insertSetting.run("email", "");
  insertSetting.run("currency", "KES");
  insertSetting.run("storeLogo", "");
  insertSetting.run("store_layout", "original");
  insertSetting.run("store_banners", "[]");
  insertSetting.run("store_features", "[]");
  insertSetting.run("about_us", '{"title":"About Us","content":"Welcome to our store.","mission":"","vision":""}');
  insertSetting.run("shop_plan_id", "starter");
  // Seed default subscription plans
  const insertPlan = clientDb.prepare("INSERT OR IGNORE INTO subscription_plans (id, name, description, price, tier_level, max_products, max_branches, features, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)");
  insertPlan.run("starter", "Starter", "Free plan for small businesses", 0, 0, 20, 1, JSON.stringify(["Browse catalog", "View product details"]));
  insertPlan.run("basic", "Basic", "Access to essential products", 29.99, 1, 50, 2, JSON.stringify(["Browse catalog", "View product details", "Wholesale pricing", "Email support", "Branch management"]));
  insertPlan.run("pro", "Professional", "Full product access for growing businesses", 99.99, 2, 200, 5, JSON.stringify(["Browse catalog", "View product details", "Wholesale pricing", "Priority support", "Bulk ordering", "Messaging", "Branch management"]));
  insertPlan.run("enterprise", "Enterprise", "Unlimited access with premium support", 299.99, 3, null, -1, JSON.stringify(["Browse catalog", "View product details", "Wholesale pricing", "Dedicated support", "Bulk ordering", "API access", "Custom pricing", "Messaging", "Branch management"]));
  // Seed default categories
  const insertCat = clientDb.prepare("INSERT OR IGNORE INTO categories (id, label, group_name) VALUES (?, ?, ?)");
  insertCat.run("laptops", "Laptops", "Computing");
  insertCat.run("desktops", "Desktops", "Computing");
  insertCat.run("accessories", "Accessories", "Peripherals");
  insertCat.run("monitors", "Monitors", "Displays");
  insertCat.run("printers", "Printers", "Office");
  insertCat.run("networking", "Networking", "Infrastructure");
  insertCat.run("software", "Software", "Digital");
  insertCat.run("tablets", "Tablets", "Mobile");
  // Seed default repair types
  const insertRepairType = clientDb.prepare("INSERT OR IGNORE INTO repair_types (id, name, description, base_price) VALUES (?, ?, ?, ?)");
  insertRepairType.run("screen", "Screen Repair", "Broken or cracked screen replacement", 0);
  insertRepairType.run("battery", "Battery Replacement", "Battery not holding charge", 0);
  insertRepairType.run("keyboard", "Keyboard Repair", "Faulty or damaged keyboard", 0);
  insertRepairType.run("software", "Software Issue", "OS reinstall, virus removal, troubleshooting", 0);
  insertRepairType.run("hardware", "Hardware Repair", "Motherboard, RAM, storage, etc.", 0);
  insertRepairType.run("diagnostic", "Diagnostic", "General diagnostic service", 0);
  clientDbCache.set(clientId, clientDb);
  return clientDb;
}

function getClientDb(clientId: number): Database.Database {
  const client = getClient(clientId);
  if (!client) throw new Error(`Client ${clientId} not found`);
  // If the client's DB is the master DB, reuse the global connection
  if (client.dbPath && path.resolve(client.dbPath) === path.resolve(DB_PATH)) {
    return getDb();
  }
  const cached = clientDbCache.get(clientId);
  if (cached) return cached;
  if (client.dbPath && fs.existsSync(client.dbPath)) {
    return provisionClientDb(clientId, client.dbPath);
  }
  return provisionClientDb(clientId);
}

function listClients(): Client[] {
  return getDb().prepare("SELECT * FROM clients ORDER BY name").all().map((r: any) => mapClient(r));
}

function getClient(id: number): Client | undefined {
  const row = getDb().prepare("SELECT * FROM clients WHERE id = ?").get(id) as any;
  return row ? mapClient(row) : undefined;
}

function createClient(data: { name: string; email?: string; phone?: string; address?: string }): Client | undefined {
  const result = getDb()
    .prepare("INSERT INTO clients (name, email, phone, address) VALUES (?, ?, ?, ?)")
    .run(data.name, data.email || "", data.phone || "", data.address || "");
  const clientId = result.lastInsertRowid as number;
  // Provision the client's database
  const dbPath = path.join(CLIENT_DATA_DIR, `client_${clientId}.db`);
  provisionClientDb(clientId, dbPath);
  // Update the db_path
  getDb().prepare("UPDATE clients SET db_path = ? WHERE id = ?").run(dbPath, clientId);
  return getClient(clientId);
}

function updateClient(id: number, data: { name?: string; email?: string; phone?: string; address?: string; isActive?: boolean; settings?: string }): Client | undefined | null {
  const existing = getDb().prepare("SELECT * FROM clients WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const name = data.name ?? existing.name;
  const email = data.email ?? existing.email;
  const phone = data.phone ?? existing.phone;
  const address = data.address ?? existing.address;
  const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active;
  const settings = data.settings ?? existing.settings;
  getDb()
    .prepare("UPDATE clients SET name=?, email=?, phone=?, address=?, is_active=?, settings=?, updated_at=datetime('now') WHERE id=?")
    .run(name, email, phone, address, isActive, settings, id);
  return getClient(id);
}

function deleteClient(id: number): boolean {
  const client = getClient(id);
  if (!client) return false;
  // Remove cached DB connection
  clientDbCache.delete(id);
  // Delete the database file
  if (client.dbPath && fs.existsSync(client.dbPath)) {
    try { fs.unlinkSync(client.dbPath); } catch {}
  }
  const result = getDb().prepare("DELETE FROM clients WHERE id = ?").run(id);
  return result.changes > 0;
}

// Per-client branch functions
function listClientBranches(clientId: number): Branch[] {
  const clientDb = getClientDb(clientId);
  return clientDb.prepare(`
    SELECT b.*, u.username AS manager_username
    FROM branches b
    LEFT JOIN users u ON u.id = b.manager_id
    ORDER BY b.name
  `).all().map((row: any) => mapBranch(row));
}

function getClientBranch(clientId: number, branchId: number): Branch | undefined {
  const clientDb = getClientDb(clientId);
  const row = clientDb.prepare(`
    SELECT b.*, u.username AS manager_username
    FROM branches b
    LEFT JOIN users u ON u.id = b.manager_id
    WHERE b.id = ?
  `).get(branchId) as any;
  return row ? mapBranch(row) : undefined;
}

function createClientBranch(clientId: number, data: { name: string; address?: string; phone?: string; email?: string; managerId?: number | null }): Branch | undefined {
  const clientDb = getClientDb(clientId);
  const result = clientDb
    .prepare("INSERT INTO branches (name, address, phone, email, manager_id) VALUES (?, ?, ?, ?, ?)")
    .run(data.name, data.address || "", data.phone || "", data.email || "", data.managerId ?? null);
  return getClientBranch(clientId, result.lastInsertRowid as number);
}

function updateClientBranch(clientId: number, branchId: number, data: { name?: string; address?: string; phone?: string; email?: string; managerId?: number | null; isActive?: boolean }): Branch | undefined | null {
  const clientDb = getClientDb(clientId);
  const existing = clientDb.prepare("SELECT * FROM branches WHERE id = ?").get(branchId) as any;
  if (!existing) return null;
  const name = data.name ?? existing.name;
  const address = data.address ?? existing.address;
  const phone = data.phone ?? existing.phone;
  const email = data.email ?? existing.email;
  const managerId = data.managerId !== undefined ? data.managerId : existing.manager_id;
  const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active;
  clientDb
    .prepare("UPDATE branches SET name=?, address=?, phone=?, email=?, manager_id=?, is_active=? WHERE id=?")
    .run(name, address, phone, email, managerId, isActive, branchId);
  return getClientBranch(clientId, branchId);
}

function deleteClientBranch(clientId: number, branchId: number): boolean {
  const clientDb = getClientDb(clientId);
  const result = clientDb.prepare("DELETE FROM branches WHERE id = ?").run(branchId);
  return result.changes > 0;
}

// ============ PROVIDERS ============

function findProviderByEmail(email: string): ProviderWithPassword | undefined {
  return getDb().prepare("SELECT * FROM providers WHERE email = ?").get(email) as ProviderWithPassword | undefined;
}

function findProviderById(id: number): Provider | undefined {
  return getDb()
    .prepare("SELECT id, company_name, contact_name, email, phone, status, created_at FROM providers WHERE id = ?")
    .get(id) as any;
}

function listProviders(): Provider[] {
  return getDb()
    .prepare("SELECT id, company_name, contact_name, email, phone, status, created_at FROM providers ORDER BY company_name")
    .all() as any[];
}

function createProvider(companyName: string, contactName: string, email: string, password: string, phone: string = ""): Provider | undefined {
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = getDb()
    .prepare("INSERT INTO providers (company_name, contact_name, email, password_hash, phone, status) VALUES (?, ?, ?, ?, ?, 'trial')")
    .run(companyName, contactName, email, passwordHash, phone);
  return findProviderById(result.lastInsertRowid as number);
}

function updateProviderStatus(id: number, status: string): boolean {
  const result = getDb().prepare("UPDATE providers SET status = ? WHERE id = ?").run(status, id);
  return result.changes > 0;
}

function updateProvider(id: number, fields: { company_name?: string; contact_name?: string; phone?: string }): boolean {
  const sets: string[] = [];
  const vals: any[] = [];
  if (fields.company_name !== undefined) { sets.push("company_name = ?"); vals.push(fields.company_name); }
  if (fields.contact_name !== undefined) { sets.push("contact_name = ?"); vals.push(fields.contact_name); }
  if (fields.phone !== undefined) { sets.push("phone = ?"); vals.push(fields.phone); }
  if (sets.length === 0) return false;
  vals.push(id);
  const result = getDb().prepare(`UPDATE providers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return result.changes > 0;
}

// ============ PROVIDER PLAN ASSIGNMENTS ============

function getProviderSubscription(providerId: number): ProviderPlanAssignment | undefined {
  const row = getDb()
    .prepare(`SELECT ppa.*, sp.name AS plan_name FROM provider_plan_assignments ppa
      JOIN subscription_plans sp ON sp.id = ppa.plan_id
      WHERE ppa.provider_id = ? AND ppa.status = 'active'
      ORDER BY ppa.created_at DESC LIMIT 1`)
    .get(providerId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    providerId: row.provider_id,
    planId: row.plan_id,
    planName: row.plan_name,
    customPrice: row.custom_price,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    notes: row.notes,
  };
}

function assignPlanToProvider(providerId: number, planId: string, options: { customPrice?: number | null; startDate?: string; endDate?: string | null; notes?: string; createdBy?: number }): boolean {
  const startDate = options.startDate || new Date().toISOString().slice(0, 10);
  getDb()
    .prepare("UPDATE provider_plan_assignments SET status = 'cancelled' WHERE provider_id = ? AND status = 'active'")
    .run(providerId);
  const result = getDb()
    .prepare("INSERT INTO provider_plan_assignments (provider_id, plan_id, custom_price, start_date, end_date, status, notes, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)")
    .run(providerId, planId, options.customPrice ?? null, startDate, options.endDate ?? null, options.notes || "", options.createdBy ?? null);
  return result.changes > 0;
}

function getProviderAssignmentHistory(providerId: number): ProviderPlanAssignment[] {
  return getDb()
    .prepare(`SELECT ppa.*, sp.name AS plan_name FROM provider_plan_assignments ppa
      JOIN subscription_plans sp ON sp.id = ppa.plan_id
      WHERE ppa.provider_id = ?
      ORDER BY ppa.created_at DESC`)
    .all(providerId)
    .map((row: any) => ({
      id: row.id,
      providerId: row.provider_id,
      planId: row.plan_id,
      planName: row.plan_name,
      customPrice: row.custom_price,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      notes: row.notes,
    }));
}

// ============ WISHLIST ============

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

function getWishlist(customerId: number): WishlistItem[] {
  return getDb().prepare(`
    SELECT w.*, p.name AS product_name, p.price AS product_price, p.image_url AS product_image
    FROM wishlist w JOIN products p ON p.id = w.product_id
    WHERE w.customer_id = ? ORDER BY w.created_at DESC
  `).all(customerId).map((r: any) => ({
    id: r.id, customerId: r.customer_id, productId: r.product_id, notes: r.notes, createdAt: r.created_at,
    productName: r.product_name, productPrice: r.product_price, productImage: r.product_image,
  }));
}

function addToWishlist(customerId: number, productId: string, notes?: string): { ok: boolean; error?: string } {
  const product = getProduct(productId);
  if (!product) return { ok: false, error: "Product not found." };
  try {
    getDb().prepare("INSERT OR IGNORE INTO wishlist (customer_id, product_id, notes) VALUES (?, ?, ?)").run(customerId, productId, notes || "");
    return { ok: true };
  } catch { return { ok: false, error: "Could not add to wishlist." }; }
}

function removeFromWishlist(customerId: number, productId: string): boolean {
  return getDb().prepare("DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?").run(customerId, productId).changes > 0;
}

function isInWishlist(customerId: number, productId: string): boolean {
  return Boolean(getDb().prepare("SELECT 1 FROM wishlist WHERE customer_id = ? AND product_id = ?").get(customerId, productId));
}

// ============ QUOTES ============

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

function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const count = (getDb().prepare("SELECT COUNT(*) AS c FROM quotes").get() as any).c + 1;
  return `QTE-${year}-${String(count).padStart(4, "0")}`;
}

function createQuoteFromWishlist(customerId: number, note?: string): Quote | undefined {
  const wishlist = getWishlist(customerId);
  if (!wishlist.length) return undefined;
  const qn = generateQuoteNumber();
  const result = getDb().prepare("INSERT INTO quotes (customer_id, quote_number, status, notes) VALUES (?, ?, 'draft', ?)").run(customerId, qn, note || "");
  const quoteId = result.lastInsertRowid as number;
  let total = 0;
  const stmt = getDb().prepare("INSERT INTO quote_items (quote_id, product_id, product_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)");
  for (const item of wishlist) {
    const lineTotal = (item.productPrice || 0);
    stmt.run(quoteId, item.productId, item.productName || item.productId, 1, item.productPrice || 0, lineTotal);
    total += lineTotal;
  }
  getDb().prepare("UPDATE quotes SET total = ? WHERE id = ?").run(total, quoteId);
  return getQuote(quoteId);
}

function createQuote(customerId: number, notes: string, items: { productId: string; productName: string; quantity: number; unitPrice: number }[]): Quote {
  const qn = generateQuoteNumber();
  const result = getDb().prepare("INSERT INTO quotes (customer_id, quote_number, status, notes) VALUES (?, ?, 'draft', ?)").run(customerId, qn, notes);
  const quoteId = result.lastInsertRowid as number;
  let total = 0;
  const stmt = getDb().prepare("INSERT INTO quote_items (quote_id, product_id, product_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)");
  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    stmt.run(quoteId, item.productId, item.productName, item.quantity, item.unitPrice, lineTotal);
    total += lineTotal;
  }
  getDb().prepare("UPDATE quotes SET total = ? WHERE id = ?").run(total, quoteId);
  return getQuote(quoteId)!;
}

function getQuote(id: number): Quote | undefined {
  const row = getDb().prepare("SELECT * FROM quotes WHERE id = ?").get(id) as any;
  if (!row) return undefined;
  const items = getDb().prepare("SELECT * FROM quote_items WHERE quote_id = ? ORDER BY id").all(id).map((r: any) => ({
    id: r.id, quoteId: r.quote_id, productId: r.product_id, productName: r.product_name, quantity: r.quantity, unitPrice: r.unit_price, lineTotal: r.line_total,
  }));
  return { id: row.id, customerId: row.customer_id, quoteNumber: row.quote_number, status: row.status, notes: row.notes, total: row.total, createdAt: row.created_at, updatedAt: row.updated_at, items };
}

function listQuotesForCustomer(customerId: number): Quote[] {
  return getDb().prepare("SELECT id FROM quotes WHERE customer_id = ? ORDER BY created_at DESC").all(customerId).map((r: any) => getQuote(r.id)!);
}

function updateQuoteStatus(id: number, status: string): boolean {
  return getDb().prepare("UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id).changes > 0;
}

function listAllQuotes(): Quote[] {
  return getDb().prepare("SELECT id FROM quotes ORDER BY created_at DESC").all().map((r: any) => getQuote(r.id)!);
}

// ============ COUPONS ============

function validateCoupon(code: string, subtotal: number): { coupon: any; discount: number; error?: string } {
  const coupon = getDb().prepare("SELECT * FROM coupons WHERE code = ?").get(code) as any;
  if (!coupon) return { coupon: null, discount: 0, error: "Invalid coupon code." };
  if (!coupon.is_active) return { coupon: null, discount: 0, error: "This coupon is no longer active." };
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) return { coupon: null, discount: 0, error: "This coupon has reached its usage limit." };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { coupon: null, discount: 0, error: "This coupon has expired." };
  if (subtotal < coupon.min_order_amount) return { coupon: null, discount: 0, error: `Minimum order amount is ${coupon.min_order_amount.toLocaleString()}.` };
  let discount = coupon.type === "percentage" ? subtotal * (coupon.value / 100) : coupon.value;
  if (discount > subtotal) discount = subtotal;
  return { coupon, discount };
}

function listCoupons(): any[] {
  return getDb().prepare("SELECT * FROM coupons ORDER BY created_at DESC").all();
}

function getCoupon(id: number): any {
  return getDb().prepare("SELECT * FROM coupons WHERE id = ?").get(id);
}

function createCoupon(data: any): any {
  const existing = getDb().prepare("SELECT id FROM coupons WHERE code = ?").get(String(data.code).trim());
  if (existing) return null;
  getDb().prepare("INSERT INTO coupons (code, type, value, min_order_amount, max_uses, used_count, is_active, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
    .run(String(data.code).trim(), data.type, Number(data.value) || 0, Number(data.min_order_amount) || 0, Number(data.max_uses) || 0, data.is_active !== false ? 1 : 0, data.expires_at || null);
  return getDb().prepare("SELECT * FROM coupons WHERE code = ?").get(String(data.code).trim());
}

function updateCoupon(id: number, data: any): any {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const k of ["code", "type", "value", "min_order_amount", "max_uses", "is_active", "expires_at"]) {
    if (data[k] !== undefined) { sets.push(`${k} = ?`); vals.push(k === "code" ? String(data[k]).trim() : data[k]); }
  }
  if (sets.length === 0) return getCoupon(id);
  vals.push(id);
  getDb().prepare(`UPDATE coupons SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getCoupon(id);
}

function deleteCoupon(id: number): boolean {
  return getDb().prepare("DELETE FROM coupons WHERE id = ?").run(id).changes > 0;
}

function recordCouponUsage(couponId: number, orderId: number, customerId: number, discount: number): void {
  getDb().prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?").run(couponId);
  getDb().prepare("INSERT INTO coupon_usage (coupon_id, order_id, customer_id, discount_amount) VALUES (?, ?, ?, ?)").run(couponId, orderId, customerId, discount);
}

// ============ ORDERS ============

function createOrder(customerId: number, shipping: { name: string; address: string; city: string; county: string; postcode: string; phone: string; shippingFee: number }, notes: string, branchId?: number, couponCode?: string, redeemPoints?: number): Order | undefined {
  const items = getCartItems(customerId);
  const rawSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  if (rawSubtotal <= 0) return undefined;
  let discountAmount = 0;
  let couponId: number | null = null;
  if (couponCode) {
    const result = validateCoupon(couponCode, rawSubtotal);
    if (!result.error && result.coupon) {
      discountAmount = result.discount;
      couponId = result.coupon.id;
    }
  }
  let pointsDiscount = 0;
  if (redeemPoints && redeemPoints > 0) {
    const current = getDb().prepare("SELECT points FROM loyalty_points WHERE customer_id = ?").get(customerId) as any;
    if (current && current.points >= redeemPoints) {
  const rate = Number((getDb().prepare("SELECT value FROM settings WHERE key = 'loyalty_redemption_rate'").get() as any)?.value || 1);
      pointsDiscount = redeemPoints * rate;
      getDb().prepare("UPDATE loyalty_points SET points = points - ?, updated_at = datetime('now') WHERE customer_id = ?").run(redeemPoints, customerId);
    }
  }
  const totalDiscount = discountAmount + pointsDiscount;
  const subtotal = rawSubtotal - totalDiscount;
  const result = getDb()
    .prepare("INSERT INTO orders (customer_id, status, shipping_name, shipping_address, shipping_city, shipping_county, shipping_postcode, shipping_phone, shipping_fee, notes, subtotal, branch_id, coupon_id, discount_amount) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(customerId, shipping.name, shipping.address, shipping.city, shipping.county, shipping.postcode, shipping.phone, shipping.shippingFee, notes, subtotal, branchId ?? null, couponId, totalDiscount);
  const orderId = result.lastInsertRowid as number;
  if (couponId) recordCouponUsage(couponId, orderId, customerId, discountAmount);
  if (pointsDiscount > 0) {
    getDb().prepare("INSERT INTO loyalty_transactions (customer_id, points, type, reference_type, reference_id, description) VALUES (?, ?, 'redeem', 'order', ?, ?)").run(customerId, -redeemPoints!, "order", String(orderId), `Redeemed ${redeemPoints} points on order #${orderId}`);
  }
  const insertItem = getDb().prepare("INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total, has_warranty, warranty_duration, taxable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of items) {
    const product = getProduct(item.productId);
    const hw = product?.hasWarranty ? 1 : 0;
    const wd = product?.warrantyDuration || 0;
    const tx = (product?.taxable !== false) ? 1 : 0;
    insertItem.run(orderId, item.productId, item.name, item.price, item.quantity, item.lineTotal, hw, wd, tx);
  }
  clearCart(customerId);
  return getOrder(orderId);
}

function getOrder(id: number): Order | undefined {
  const row = getDb().prepare(`SELECT o.*, c.name AS customer_name, c.email AS customer_email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`).get(id) as any;
  if (!row) return undefined;
  const items = getDb().prepare("SELECT * FROM order_items WHERE order_id = ?").all(id).map((r: any) => ({
    id: r.id, orderId: r.order_id, productId: r.product_id, name: r.name, price: r.price, quantity: r.quantity, lineTotal: r.line_total, hasWarranty: r.has_warranty || 0, warrantyDuration: r.warranty_duration || 0, taxable: r.taxable !== 0,
  }));
  return {
    id: row.id, customerId: row.customer_id, customerName: row.customer_name, customerEmail: row.customer_email,
    status: row.status, shippingName: row.shipping_name, shippingAddress: row.shipping_address, shippingCity: row.shipping_city,
    shippingCounty: row.shipping_county || "", shippingPostcode: row.shipping_postcode, shippingPhone: row.shipping_phone,
    shippingFee: row.shipping_fee || 0, notes: row.notes, subtotal: row.subtotal,
    createdAt: row.created_at, updatedAt: row.updated_at, branchId: row.branch_id, items,
    couponId: row.coupon_id, discountAmount: row.discount_amount || 0,
    processedBy: row.processed_by, idempotencyKey: row.idempotency_key,
  };
}

function updateOrderItemWarranty(itemId: number, hasWarranty: number, warrantyDuration?: number): boolean {
  if (warrantyDuration !== undefined) {
    return getDb().prepare("UPDATE order_items SET has_warranty = ?, warranty_duration = ? WHERE id = ?").run(hasWarranty, warrantyDuration, itemId).changes > 0;
  }
  return getDb().prepare("UPDATE order_items SET has_warranty = ? WHERE id = ?").run(hasWarranty, itemId).changes > 0;
}

function listOrders(customerId?: number): Order[] {
  let sql = `SELECT o.*, c.name AS customer_name, c.email AS customer_email FROM orders o JOIN customers c ON c.id = o.customer_id`;
  const params: any[] = [];
  if (customerId) { sql += " WHERE o.customer_id = ?"; params.push(customerId); }
  sql += " ORDER BY o.created_at DESC";
  return getDb().prepare(sql).all(...params).map((row: any) => {
    const items = getDb().prepare("SELECT * FROM order_items WHERE order_id = ?").all(row.id).map((r: any) => ({
      id: r.id, orderId: r.order_id, productId: r.product_id, name: r.name, price: r.price, quantity: r.quantity, lineTotal: r.line_total, hasWarranty: r.has_warranty || 0, warrantyDuration: r.warranty_duration || 0, taxable: r.taxable !== 0,
    }));
    return {
      id: row.id, customerId: row.customer_id, customerName: row.customer_name, customerEmail: row.customer_email,
      status: row.status, shippingName: row.shipping_name, shippingAddress: row.shipping_address, shippingCity: row.shipping_city,
      shippingCounty: row.shipping_county || "", shippingPostcode: row.shipping_postcode, shippingPhone: row.shipping_phone,
      shippingFee: row.shipping_fee || 0, notes: row.notes, subtotal: row.subtotal,
      createdAt: row.created_at, updatedAt: row.updated_at, branchId: row.branch_id, items,
      couponId: row.coupon_id, discountAmount: row.discount_amount || 0,
      processedBy: row.processed_by, idempotencyKey: row.idempotency_key,
    };
  });
}

function updateOrderStatus(id: number, status: string): boolean {
  const ok = getDb().prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id).changes > 0;
  if (ok) {
    const order = getOrder(id);
    if (order) {
      if (status === "shipped" || status === "delivered") {
        const currency = getSettings().currency;
        const total = order.subtotal + (order.shippingFee || 0);
        createOrderInvoice(id, total, currency);
      }
      if (status === "delivered") {
        earnLoyaltyPoints(order.customerId, order.subtotal + (order.shippingFee || 0), "order", String(id));
      }
    }
  }
  return ok;
}

// ============ PRODUCT VIEWS ============

function recordProductView(productId: string, viewerType: string = "anonymous"): void {
  getDb().prepare("INSERT INTO product_views (product_id, viewer_type) VALUES (?, ?)").run(productId, viewerType);
}

function getPopularProducts(limit: number = 10): { productId: string; name: string; views: number }[] {
  return getDb()
    .prepare(`SELECT pv.product_id, p.name, COUNT(*) AS views FROM product_views pv
      JOIN products p ON p.id = pv.product_id
      GROUP BY pv.product_id ORDER BY views DESC LIMIT ?`)
    .all(limit) as any[];
}

function getTotalViews(since?: string): number {
  const sql = since ? "SELECT COUNT(*) AS c FROM product_views WHERE viewed_at >= ?" : "SELECT COUNT(*) AS c FROM product_views";
  return (getDb().prepare(sql).get(since) as any).c;
}

// ============ INVOICES ============

function createInvoice(providerId: number, planId: string, amount: number, currency: string, periodStart: string, periodEnd: string): Invoice | undefined {
  const result = getDb()
    .prepare("INSERT INTO invoices (provider_id, plan_id, amount, currency, status, period_start, period_end) VALUES (?, ?, ?, ?, 'pending', ?, ?)")
    .run(providerId, planId, amount, currency, periodStart, periodEnd);
  return getInvoice(result.lastInsertRowid as number);
}

function getInvoice(id: number): Invoice | undefined {
  const row = getDb().prepare("SELECT i.*, sp.name AS plan_name FROM invoices i JOIN subscription_plans sp ON sp.id = i.plan_id WHERE i.id = ?").get(id) as any;
  if (!row) return undefined;
  return { id: row.id, providerId: row.provider_id, planId: row.plan_id, planName: row.plan_name, amount: row.amount, currency: row.currency, status: row.status, periodStart: row.period_start, periodEnd: row.period_end, paidAt: row.paid_at, createdAt: row.created_at };
}

function listInvoices(providerId?: number): Invoice[] {
  let sql = "SELECT i.*, sp.name AS plan_name FROM invoices i JOIN subscription_plans sp ON sp.id = i.plan_id";
  const params: any[] = [];
  if (providerId) { sql += " WHERE i.provider_id = ?"; params.push(providerId); }
  sql += " ORDER BY i.created_at DESC";
  return getDb().prepare(sql).all(...params).map((row: any) => ({
    id: row.id, providerId: row.provider_id, planId: row.plan_id, planName: row.plan_name, amount: row.amount, currency: row.currency,
    status: row.status, periodStart: row.period_start, periodEnd: row.period_end, paidAt: row.paid_at, createdAt: row.created_at,
  }));
}

function markInvoicePaid(id: number): boolean {
  return getDb().prepare("UPDATE invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(id).changes > 0;
}

function generateProviderInvoice(providerId: number): Invoice | undefined {
  const sub = getProviderSubscription(providerId);
  if (!sub || !sub.planId) return undefined;
  const plan = getSubscriptionPlan(sub.planId);
  if (!plan || plan.price <= 0) return undefined;
  const amount = sub.customPrice ?? plan.price;
  const now = new Date();
  const periodStart = now.toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().slice(0, 10);
  return createInvoice(providerId, sub.planId, amount, "KES", periodStart, periodEnd);
}

function getInvoiceRevenue(): { total: number; paid: number; pending: number } {
  const rowAll = (getDb().prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status != 'cancelled'").get() as any).total;
  const rowPaid = (getDb().prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status = 'paid'").get() as any).total;
  const rowPending = (getDb().prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status = 'pending'").get() as any).total;
  return { total: rowAll, paid: rowPaid, pending: rowPending };
}

// ============ ORDER INVOICES (eTIMS VSCU v2.0) ============
// Simulates the two-step VSCU flow:
// Step 1: saveSales — register the sales transaction
// Step 2: saveSalesInvc — register the invoice, get InternalData + SignatureData

function getEtimsMode(): string {
  return (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_mode'").get() as any)?.value || "vscu";
}

function generateEtimsInvoiceNumber(): { etimsInvoiceNumber: string; controlCode: string; serialNumber: number } {
  const kraPin = (getDb().prepare("SELECT value FROM settings WHERE key = 'kra_pin'").get() as any)?.value || "P051234567Z";
  const prefix = (getDb().prepare("SELECT value FROM settings WHERE key = 'etims_serial_prefix'").get() as any)?.value || "01";
  let serial = Number((getDb().prepare("SELECT value FROM settings WHERE key = 'etims_last_serial'").get() as any)?.value || 0);
  serial++;
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('etims_last_serial', ?)").run(String(serial));
  const serialPadded = String(serial).padStart(4, "0");
  // Format for VSCU: PINAASSCCCCCCCC (PIN + 2-char prefix + 4-digit serial + 8-char control code)
  // Format for OSCU: same structure, different control code source
  const uid = `${kraPin}${prefix}${serialPadded}`;
  const crypto = require("crypto");
  const raw = `${kraPin}|${prefix}|${serialPadded}|${new Date().toISOString().slice(0, 10)}`;
  const controlCode = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 8).toUpperCase();
  return { etimsInvoiceNumber: uid, controlCode, serialNumber: serial };
}

// Step 1: Register the sales transaction with eTIMS (simulated VSCU/OSCU call)
function createEtimsSalesTransaction(orderId: number, order: any): boolean {
  const existing = getDb().prepare("SELECT id FROM etims_sales_transactions WHERE order_id = ?").get(orderId) as any;
  if (existing) return true;
  try {
    getDb().exec(`CREATE TABLE IF NOT EXISTS etims_sales_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      tx_date TEXT NOT NULL,
      customer_name TEXT,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  } catch {}
  getDb().prepare("INSERT OR IGNORE INTO etims_sales_transactions (order_id, tx_date, customer_name, total_amount) VALUES (?, ?, ?, ?)")
    .run(orderId, order.createdAt, order.shippingName || order.customerName, order.subtotal + (order.shippingFee || 0));
  return true;
}

// Step 2: Register the sales invoice, simulate VSCU/OSCU response with InternalData + SignatureData
function createOrderInvoice(orderId: number, amount: number, currency: string): OrderInvoice | undefined {
  const existing = getDb().prepare("SELECT * FROM order_invoices WHERE order_id = ?").get(orderId) as any;
  if (existing) return existing;

  // Step 1 must happen first
  const order = getOrder(orderId);
  if (order) createEtimsSalesTransaction(orderId, order);

  const { etimsInvoiceNumber, controlCode, serialNumber } = generateEtimsInvoiceNumber();
  const kraPin = (getDb().prepare("SELECT value FROM settings WHERE key = 'kra_pin'").get() as any)?.value || "P051234567Z";
  const mode = getEtimsMode();

  // Simulate VSCU/OSCU response: generate InternalData and SignatureData
  let vscuReceiptCnt = Number((getDb().prepare("SELECT value FROM settings WHERE key = 'etims_vscu_receipt_counter'").get() as any)?.value || 0);
  vscuReceiptCnt++;
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('etims_vscu_receipt_counter', ?)").run(String(vscuReceiptCnt));

  const crypto = require("crypto");
  const receiptDate = new Date().toISOString().slice(0, 19).replace("T", " ");
  const modePrefix = mode === "vscu" ? "VSCU" : "OSCU";
  const internalData = crypto.createHash("sha256").update(`${modePrefix}_INTERNAL_${kraPin}_${serialNumber}_${receiptDate}`).digest("hex").toUpperCase();
  const signatureData = crypto.createHash("sha256").update(`${modePrefix}_SIG_${kraPin}_${serialNumber}_${internalData}`).digest("hex").toUpperCase();

  // Determine tax type — check if ALL items are non-taxable → use 'E' (Not Subject), else 'A' (16% VAT)
  const items = order?.items || [];
  const allNonTaxable = items.length > 0 && items.every((i: any) => i.taxable === false);
  const taxType = allNonTaxable ? "E" : "A";

  // Payment type default 04 (Mobile Payment / M-Pesa)
  const paymentType = "04";

  const result = getDb().prepare(`INSERT INTO order_invoices
    (order_id, amount, currency, status, etims_invoice_number, control_code, kra_pin, serial_number,
     internal_data, signature_data, receipt_date, receipt_counter, total_receipts, tax_type, payment_type, vscu_receipt_no)
    VALUES (?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(orderId, amount, currency, etimsInvoiceNumber, controlCode, kraPin, serialNumber,
         internalData, signatureData, receiptDate, 1, 1, taxType, paymentType, vscuReceiptCnt);
  return getDb().prepare("SELECT * FROM order_invoices WHERE id = ?").get(result.lastInsertRowid) as any;
}

function listOrderInvoices(): any[] {
  return getDb().prepare("SELECT oi.*, o.shipping_name AS customer_name FROM order_invoices oi JOIN orders o ON o.id = oi.order_id ORDER BY oi.created_at DESC").all().map((r: any) => ({
    id: r.id, orderId: r.order_id, amount: r.amount, currency: r.currency, status: r.status, createdAt: r.created_at, customer_name: r.customer_name,
    etimsInvoiceNumber: r.etims_invoice_number, controlCode: r.control_code, kraPin: r.kra_pin, serialNumber: r.serial_number,
    internalData: r.internal_data, signatureData: r.signature_data, receiptDate: r.receipt_date,
    receiptCounter: r.receipt_counter, totalReceipts: r.total_receipts, taxType: r.tax_type, paymentType: r.payment_type,
  }));
}

function markOrderInvoicePaid(id: number): boolean {
  return getDb().prepare("UPDATE order_invoices SET status = 'paid' WHERE id = ?").run(id).changes > 0;
}

// ============ REPAIR IMAGES ============

interface RepairImage {
  id: number;
  ticketId: string;
  imageUrl: string;
  imageType: "before" | "after";
  uploadedBy: number | null;
  createdAt: string;
}

function getRepairImages(ticketId: string): RepairImage[] {
  return getDb().prepare("SELECT * FROM repair_images WHERE ticket_id = ? ORDER BY image_type, id").all(ticketId).map((r: any) => ({
    id: r.id,
    ticketId: r.ticket_id,
    imageUrl: r.image_url,
    imageType: r.image_type,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  }));
}

function addRepairImage(ticketId: string, imageUrl: string, imageType: "before" | "after", uploadedBy?: number): RepairImage {
  const result = getDb().prepare("INSERT INTO repair_images (ticket_id, image_url, image_type, uploaded_by) VALUES (?, ?, ?, ?)").run(ticketId, imageUrl, imageType, uploadedBy || null);
  return getDb().prepare("SELECT * FROM repair_images WHERE id = ?").get(result.lastInsertRowid) as RepairImage;
}

function deleteRepairImage(imageId: number): boolean {
  return getDb().prepare("DELETE FROM repair_images WHERE id = ?").run(imageId).changes > 0;
}

// ============ PURCHASE ORDERS ============

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

function createPurchaseOrder(data: { supplierName: string; supplierContact?: string; notes?: string; createdBy?: number }): PurchaseOrder | undefined {
  const result = getDb().prepare("INSERT INTO purchase_orders (supplier_name, supplier_contact, notes, created_by) VALUES (?, ?, ?, ?)").run(data.supplierName, data.supplierContact || "", data.notes || "", data.createdBy || null);
  return getPurchaseOrder(result.lastInsertRowid as number);
}

function getPurchaseOrder(id: number): PurchaseOrder | undefined {
  const row = getDb().prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as any;
  if (!row) return undefined;
  const items = getDb().prepare("SELECT poi.*, p.name AS product_name FROM purchase_order_items poi LEFT JOIN products p ON p.id = poi.product_id WHERE poi.purchase_order_id = ? ORDER BY poi.id").all(id).map((r: any) => ({
    id: r.id, purchaseOrderId: r.purchase_order_id, productId: r.product_id, productName: r.product_name, quantityOrdered: r.quantity_ordered, quantityReceived: r.quantity_received, unitCost: r.unit_cost,
  }));
  const totalCost = items.reduce((sum, i) => sum + i.unitCost * i.quantityOrdered, 0);
  return { id: row.id, supplierName: row.supplier_name, supplierContact: row.supplier_contact, orderDate: row.order_date, status: row.status, notes: row.notes, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, items, totalCost };
}

function listPurchaseOrders(): PurchaseOrder[] {
  return getDb().prepare("SELECT * FROM purchase_orders ORDER BY created_at DESC").all().map((row: any) => {
    const po = getPurchaseOrder(row.id);
    return po!;
  });
}

function addPurchaseOrderItem(poId: number, data: { productId: string; quantityOrdered: number; unitCost: number }): PurchaseOrderItem | undefined {
  getDb().prepare("INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, unit_cost) VALUES (?, ?, ?, ?)").run(poId, data.productId, data.quantityOrdered, data.unitCost);
  getDb().prepare("UPDATE purchase_orders SET updated_at = datetime('now') WHERE id = ?").run(poId);
  const item = getDb().prepare("SELECT poi.*, p.name AS product_name FROM purchase_order_items poi LEFT JOIN products p ON p.id = poi.product_id WHERE poi.id = last_insert_rowid()").get() as any;
  return item ? { id: item.id, purchaseOrderId: item.purchase_order_id, productId: item.product_id, productName: item.product_name, quantityOrdered: item.quantity_ordered, quantityReceived: item.quantity_received, unitCost: item.unit_cost } : undefined;
}

function updatePurchaseOrderStatus(id: number, status: string): boolean {
  return getDb().prepare("UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id).changes > 0;
}

function receivePurchaseOrderItem(itemId: number, quantityReceived: number): boolean {
  const item = getDb().prepare("SELECT poi.*, po.product_id FROM purchase_order_items poi WHERE poi.id = ?").get(itemId) as any;
  if (!item) return false;
  getDb().prepare("UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?").run(quantityReceived, itemId);
  // Update product stock
  const currentStock = getStockLevel(item.product_id);
  updateStockLevel(item.product_id, { quantityInStock: currentStock.quantityInStock + (quantityReceived - item.quantity_received) });
  recordStockMovement(item.product_id, "purchase_receive", quantityReceived - item.quantity_received, { referenceType: "purchase_order", referenceId: String(item.purchase_order_id) });
  return true;
}

function autoReorderLowStock(): { created: number; skipped: number } {
  const lowItems = getLowStockItems();
  let created = 0, skipped = 0;
  const pendingPOs = listPurchaseOrders().filter(po => po.status === "pending");
  const alreadyOrdered = new Set<string>();
  for (const po of pendingPOs) {
    for (const item of po.items) alreadyOrdered.add(item.productId);
  }
  let autoPO: PurchaseOrder | undefined;
  for (const item of lowItems) {
    if (alreadyOrdered.has(item.productId)) { skipped++; continue; }
    if (!autoPO) autoPO = createPurchaseOrder({ supplierName: "Auto-Reorder", notes: "Auto-generated low stock reorder" });
    if (autoPO) {
      const product = getProduct(item.productId);
      addPurchaseOrderItem(autoPO.id, { productId: item.productId, quantityOrdered: Math.max(item.lowStockThreshold * 2, 10), unitCost: product?.price ?? 0 });
      created++;
    }
  }
  return { created, skipped };
}

// ============ REPORTS ============

interface TechPerformanceReport {
  staffId: number;
  staffName: string;
  ticketsCompleted: number;
  ticketsAssigned: number;
  totalEarned: number;
}

function getTechPerformanceReport(): TechPerformanceReport[] {
  const staff = getDb().prepare("SELECT id, username FROM users WHERE role IN ('technician','admin')").all() as any[];
  return staff.map((s: any) => {
    const completed = getDb().prepare("SELECT COUNT(*) AS c, COALESCE(SUM(total_cost), 0) AS earned FROM repair_tickets WHERE assigned_to = ? AND status = 'collected'").get(s.id) as any;
    const assigned = getDb().prepare("SELECT COUNT(*) AS c FROM repair_tickets WHERE assigned_to = ? AND status != 'cancelled'").get(s.id) as any;
    return { staffId: s.id, staffName: s.username, ticketsCompleted: completed?.c || 0, ticketsAssigned: assigned?.c || 0, totalEarned: completed?.earned || 0 };
  });
}

interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  paidInvoices: number;
  invoiceRevenue: number;
  topProducts: { productId: string; name: string; totalSold: number; revenue: number }[];
}

function getSalesReport(): SalesReport {
  const orders = getDb().prepare("SELECT COUNT(*) AS c, COALESCE(SUM(subtotal + shipping_fee), 0) AS rev FROM orders WHERE status != 'cancelled'").get() as any;
  const invoices = getDb().prepare("SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS rev FROM invoices WHERE status = 'paid'").get() as any;
  const topProducts = getDb().prepare(`
    SELECT oi.product_id, p.name, SUM(oi.quantity) AS total_sold, SUM(oi.line_total) AS revenue
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
    GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 10
  `).all() as any[];
  return {
    totalRevenue: orders?.rev || 0, totalOrders: orders?.c || 0,
    paidInvoices: invoices?.c || 0, invoiceRevenue: invoices?.rev || 0,
    topProducts: topProducts.map((r: any) => ({ productId: r.product_id, name: r.name, totalSold: r.total_sold, revenue: r.revenue })),
  };
}

interface PurchaseReport {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
  receivedOrders: number;
}

function getPurchaseReport(): PurchaseReport {
  const all = getDb().prepare("SELECT COUNT(*) AS c, COALESCE(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS spent FROM purchase_orders po JOIN purchase_order_items poi ON poi.purchase_order_id = po.id WHERE po.status != 'cancelled'").get() as any;
  const pending = getDb().prepare("SELECT COUNT(*) AS c FROM purchase_orders WHERE status = 'pending'").get() as any;
  const received = getDb().prepare("SELECT COUNT(*) AS c FROM purchase_orders WHERE status = 'received'").get() as any;
  return { totalOrders: all?.c || 0, totalSpent: all?.spent || 0, pendingOrders: pending?.c || 0, receivedOrders: received?.c || 0 };
}

// ============ SHOP OWNER FUNCTIONS ============

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

function listAllCustomers(): Customer[] {
  return getDb().prepare("SELECT id, name, email, phone, is_active, last_login, created_at FROM customers ORDER BY created_at DESC").all() as Customer[];
}

function listActiveCustomers(): Customer[] {
  return getDb().prepare("SELECT id, name, email, phone, is_active, last_login, created_at FROM customers WHERE is_active = 1 ORDER BY created_at DESC").all() as Customer[];
}

function getCustomerDetails(id: number): any {
  const customer = findCustomerById(id);
  if (!customer) return null;
  const stats = getDb().prepare("SELECT COUNT(*) AS orderCount, COALESCE(SUM(subtotal + shipping_fee), 0) AS totalSpent FROM orders WHERE customer_id = ?").get(id) as any;
  return { ...customer, orderCount: stats?.orderCount || 0, totalSpent: stats?.totalSpent || 0 };
}

function getLoyaltyPoints(customerId: number): { points: number; lifetimeEarned: number } {
  const row = getDb().prepare("SELECT points, lifetime_earned FROM loyalty_points WHERE customer_id = ?").get(customerId) as any;
  return row ? { points: row.points, lifetimeEarned: row.lifetime_earned } : { points: 0, lifetimeEarned: 0 };
}

function earnLoyaltyPoints(customerId: number, amount: number, referenceType: string, referenceId: string): void {
  const rate = Number((getDb().prepare("SELECT value FROM settings WHERE key = 'loyalty_rate'").get() as any)?.value || 10);
  const pointsEarned = Math.floor(amount / 100 * rate);
  if (pointsEarned <= 0) return;
  getDb().prepare(`
    INSERT INTO loyalty_points (customer_id, points, lifetime_earned, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(customer_id) DO UPDATE SET points = points + ?, lifetime_earned = lifetime_earned + ?, updated_at = datetime('now')
  `).run(customerId, pointsEarned, pointsEarned, pointsEarned, pointsEarned);
  getDb().prepare("INSERT INTO loyalty_transactions (customer_id, points, type, reference_type, reference_id, description) VALUES (?, ?, 'earn', ?, ?, ?)").run(customerId, pointsEarned, referenceType, referenceId, `Earned from ${referenceType} #${referenceId}`);
}

function redeemLoyaltyPoints(customerId: number, pointsToRedeem: number, referenceType: string, referenceId: string): number {
  const current = getDb().prepare("SELECT points FROM loyalty_points WHERE customer_id = ?").get(customerId) as any;
  if (!current || current.points < pointsToRedeem) return 0;
  const rate = Number((getDb().prepare("SELECT value FROM settings WHERE key = 'loyalty_redemption_rate'").get() as any)?.value || 1);
  const discount = pointsToRedeem * rate;
  getDb().prepare("UPDATE loyalty_points SET points = points - ?, updated_at = datetime('now') WHERE customer_id = ?").run(pointsToRedeem, customerId);
  getDb().prepare("INSERT INTO loyalty_transactions (customer_id, points, type, reference_type, reference_id, description) VALUES (?, ?, 'redeem', ?, ?, ?)").run(customerId, -pointsToRedeem, referenceType, referenceId, `Redeemed on ${referenceType} #${referenceId}`);
  return discount;
}

function getLoyaltyTransactions(customerId: number, limit = 20): any[] {
  return getDb().prepare("SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?").all(customerId, limit) as any[];
}

function listAllLoyaltyCustomers(): any[] {
  return getDb().prepare(`
    SELECT lp.*, c.name AS customer_name, c.email AS customer_email
    FROM loyalty_points lp JOIN customers c ON c.id = lp.customer_id
    ORDER BY lp.points DESC
  `).all() as any[];
}

function listAllMessages(): any[] {
  return getDb().prepare(`
    SELECT m.*, c.name AS customer_name, c.email AS customer_email, p.company_name AS provider_company
    FROM messages m
    LEFT JOIN customers c ON c.id = m.customer_id
    LEFT JOIN providers p ON p.id = m.provider_id
    ORDER BY m.created_at DESC
  `).all() as any[];
}

function getSalesReportWithRange(from: string, to: string, branchId?: number): SalesReport & { orders: any[]; branchBreakdown?: { branchId: number; branchName: string; orders: number; revenue: number }[] } {
  let orderSql = `
    SELECT o.*, c.name AS customer_name
    FROM orders o JOIN customers c ON c.id = o.customer_id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'cancelled'
  `;
  const params: any[] = [from, to];
  if (branchId) {
    orderSql += " AND o.branch_id = ?";
    params.push(branchId);
  }
  orderSql += " ORDER BY o.created_at DESC";

  const orders = getDb().prepare(orderSql).all(...params) as any[];
  const totalRevenue = orders.reduce((s: number, o: any) => s + (o.subtotal || 0) + (o.shipping_fee || 0), 0);
  const paidInvoices = getDb().prepare("SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS rev FROM invoices WHERE status='paid' AND paid_at >= ? AND paid_at <= ?").get(from, to) as any;

  let topSql = `
    SELECT oi.product_id, p.name, SUM(oi.quantity) AS total_sold, SUM(oi.line_total) AS revenue
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'cancelled'
  `;
  const topParams: any[] = [from, to];
  if (branchId) {
    topSql += " AND o.branch_id = ?";
    topParams.push(branchId);
  }
  topSql += " GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 10";

  const topProducts = getDb().prepare(topSql).all(...topParams) as any[];

  let branchBreakdown: { branchId: number; branchName: string; orders: number; revenue: number }[] | undefined;
  if (!branchId) {
    const branchRows = getDb().prepare(`
      SELECT b.id, b.name, COUNT(o.id) AS orders, COALESCE(SUM(o.subtotal + o.shipping_fee), 0) AS revenue
      FROM branches b
      LEFT JOIN orders o ON o.branch_id = b.id AND o.created_at >= ? AND o.created_at <= ? AND o.status != 'cancelled'
      WHERE b.is_active = 1
      GROUP BY b.id ORDER BY b.name
    `).all(from, to) as any[];
    branchBreakdown = branchRows.map((r: any) => ({ branchId: r.id, branchName: r.name, orders: r.orders, revenue: r.revenue }));
  }

  return {
    totalRevenue, totalOrders: orders.length,
    paidInvoices: paidInvoices?.c || 0, invoiceRevenue: paidInvoices?.rev || 0,
    topProducts: topProducts.map((r: any) => ({ productId: r.product_id, name: r.name, totalSold: r.total_sold, revenue: r.revenue })),
    orders,
    branchBreakdown,
  };
}

function getStockSummary(): { productId: string; name: string; category: string; quantityInStock: number; quantityReserved: number; quantitySold: number; lowStockThreshold: number }[] {
  return getDb().prepare(`
    SELECT p.id AS product_id, p.name, p.category,
      COALESCE(sl.quantity_in_stock, 0) AS quantity_in_stock,
      COALESCE(sl.quantity_reserved, 0) AS quantity_reserved,
      COALESCE(sl.quantity_sold, 0) AS quantity_sold,
      COALESCE(sl.low_stock_threshold, 5) AS low_stock_threshold
    FROM products p
    LEFT JOIN stock_levels sl ON sl.product_id = p.id
    ORDER BY p.name
  `).all() as any[];
}

function getEmployeeSalesPerformance(from: string, to: string): any[] {
  const staff = getDb().prepare("SELECT id, username, role FROM users").all() as any[];
  return staff.map((s: any) => {
    const repairs = getDb().prepare(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(total_cost), 0) AS earned
      FROM repair_tickets WHERE assigned_to = ? AND status = 'collected'
      AND completed_at >= ? AND completed_at <= ?
    `).get(s.id, from, to) as any;
    const assigned = getDb().prepare(`
      SELECT COUNT(*) AS cnt FROM repair_tickets WHERE assigned_to = ? AND created_at >= ? AND created_at <= ?
    `).get(s.id, from, to) as any;
    return {
      staffId: s.id, staffName: s.username, role: s.role,
      ticketsCompleted: repairs?.cnt || 0, totalEarned: repairs?.earned || 0,
      ticketsAssigned: assigned?.cnt || 0,
    };
  });
}

function getTechnicianRepairStats(from: string, to: string): any[] {
  return getDb().prepare(`
    SELECT u.id AS staff_id, u.username,
      COUNT(rt.id) AS total_repairs,
      SUM(CASE WHEN rt.status = 'collected' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN rt.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      COALESCE(SUM(rt.total_cost), 0) AS total_revenue
    FROM users u
    LEFT JOIN repair_tickets rt ON rt.assigned_to = u.id AND rt.created_at >= ? AND rt.created_at <= ?
    WHERE u.role IN ('technician', 'admin')
    GROUP BY u.id
    ORDER BY total_repairs DESC
  `).all(from, to) as any[];
}

// ============ STOCK TAKE ============

function createStockTakeSession(createdBy: number, notes: string = ""): StockTakeSession | null {
  const products = getDb().prepare("SELECT id, COALESCE((SELECT quantity_in_stock FROM stock_levels WHERE product_id = p.id), 0) AS qty FROM products p").all() as any[];
  const sessionId = getDb().transaction((): number | null => {
    const r = getDb().prepare("INSERT INTO stock_take_sessions (status, notes, created_by) VALUES ('in_progress', ?, ?)").run(notes, createdBy);
    const sid = Number(r.lastInsertRowid);
    if (!sid) return null;
    const insert = getDb().prepare("INSERT INTO stock_take_items (session_id, product_id, system_quantity) VALUES (?, ?, ?)");
    for (const p of products) insert.run(sid, p.id, p.qty);
    return sid;
  })();
  if (sessionId === null) return null;
  return getStockTakeSession(sessionId);
}

function getStockTakeSession(id: number): StockTakeSession | null {
  const s = getDb().prepare("SELECT * FROM stock_take_sessions WHERE id = ?").get(id) as any;
  if (!s) return null;
  return { id: s.id, status: s.status, notes: s.notes, createdBy: s.created_by, completedAt: s.completed_at, createdAt: s.created_at };
}

function listStockTakeSessions(): StockTakeSession[] {
  return getDb().prepare("SELECT * FROM stock_take_sessions ORDER BY created_at DESC").all() as any[];
}

function getStockTakeItems(sessionId: number): StockTakeItem[] {
  return getDb().prepare(`
    SELECT sti.*, p.name AS product_name
    FROM stock_take_items sti JOIN products p ON p.id = sti.product_id
    WHERE sti.session_id = ? ORDER BY p.name
  `).all(sessionId).map((r: any) => ({
    id: r.id, sessionId: r.session_id, productId: r.product_id, productName: r.product_name,
    systemQuantity: r.system_quantity, countedQuantity: r.counted_quantity, variance: r.variance, notes: r.notes,
  }));
}

function recordStockCount(itemId: number, countedQuantity: number, notes: string = ""): boolean {
  const item = getDb().prepare("SELECT * FROM stock_take_items WHERE id = ?").get(itemId) as any;
  if (!item) return false;
  const variance = countedQuantity - item.system_quantity;
  getDb().prepare("UPDATE stock_take_items SET counted_quantity = ?, variance = ?, notes = ? WHERE id = ?").run(countedQuantity, variance, notes, itemId);
  return true;
}

function completeStockTakeSession(sessionId: number): { ok: boolean; report?: any; error?: string } {
  const session = getStockTakeSession(sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "completed") return { ok: false, error: "Session already completed." };

  const items = getDb().prepare("SELECT * FROM stock_take_items WHERE session_id = ? AND counted_quantity IS NOT NULL").all(sessionId) as any[];
  let adjusted = 0;
  for (const item of items) {
    const current = getStockLevel(item.product_id);
    const diff = item.counted_quantity - current.quantityInStock;
    if (diff === 0) continue;
    updateStockLevel(item.product_id, { quantityInStock: Math.max(0, item.counted_quantity) });
    recordStockMovement(item.product_id, "stock_take_adjust", diff, { referenceType: "stock_take", referenceId: String(sessionId), notes: `Stock take #${sessionId} adjustment` });
    adjusted++;
  }

  getDb().prepare("UPDATE stock_take_sessions SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(sessionId);
  createStockSnapshot();
  const report = getStockTakeVarianceReport(sessionId);

  return { ok: true, report: { ...report, adjusted } };
}

function applyStockTakeAdjustments(sessionId: number): number {
  const items = getDb().prepare("SELECT * FROM stock_take_items WHERE session_id = ? AND counted_quantity IS NOT NULL").all(sessionId) as any[];
  let adjusted = 0;
  for (const item of items) {
    const current = getStockLevel(item.product_id);
    const diff = item.counted_quantity - current.quantityInStock;
    if (diff === 0) continue;
    updateStockLevel(item.product_id, { quantityInStock: Math.max(0, item.counted_quantity) });
    recordStockMovement(item.product_id, "stock_take_adjust", diff, { referenceType: "stock_take", referenceId: String(sessionId), notes: `Stock take #${sessionId} adjustment` });
    adjusted++;
  }
  return adjusted;
}

// ============ SHOP SUBSCRIPTION ============

function getShopPlan(): SubscriptionPlan | undefined {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'shop_plan_id'").get() as any;
  if (!row) return undefined;
  return getSubscriptionPlan(row.value);
}

function setShopPlan(planId: string): boolean {
  const plan = getSubscriptionPlan(planId);
  if (!plan) return false;
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('shop_plan_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(planId);
  return true;
}

function shopHasFeature(feature: string): boolean {
  const plan = getShopPlan();
  if (!plan) return false;
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];
  return features.some((f) => f.toLowerCase().trim() === feature.toLowerCase().trim());
}

// ============ SPEC TEMPLATES ============

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

function getSpecTemplateFields(category: string): SpecFieldDef[] {
  return getDb().prepare("SELECT * FROM spec_template_fields WHERE category = ? ORDER BY sort_order, id").all(category).map((r: any) => ({
    id: r.id, category: r.category, fieldKey: r.field_key, fieldLabel: r.field_label,
    fieldType: r.field_type, options: JSON.parse(r.options || "[]"), required: !!r.required, sortOrder: r.sort_order,
  }));
}

function getAllSpecTemplateFields(): SpecFieldDef[] {
  return getDb().prepare("SELECT * FROM spec_template_fields ORDER BY category, sort_order, id").all().map((r: any) => ({
    id: r.id, category: r.category, fieldKey: r.field_key, fieldLabel: r.field_label,
    fieldType: r.field_type, options: JSON.parse(r.options || "[]"), required: !!r.required, sortOrder: r.sort_order,
  }));
}

function createSpecTemplateField(field: { category: string; fieldKey: string; fieldLabel: string; fieldType?: string; options?: string[]; required?: boolean; sortOrder?: number }): SpecFieldDef | null {
  const r = getDb().prepare("INSERT INTO spec_template_fields (category, field_key, field_label, field_type, options, required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    field.category, field.fieldKey, field.fieldLabel, field.fieldType || "text", JSON.stringify(field.options || []), field.required ? 1 : 0, field.sortOrder ?? 0
  );
  return getDb().prepare("SELECT * FROM spec_template_fields WHERE id = ?").get(Number(r.lastInsertRowid)) as any || null;
}

function updateSpecTemplateField(id: number, updates: { fieldKey?: string; fieldLabel?: string; fieldType?: string; options?: string[]; required?: boolean; sortOrder?: number }): boolean {
  const existing = getDb().prepare("SELECT * FROM spec_template_fields WHERE id = ?").get(id) as any;
  if (!existing) return false;
  getDb().prepare("UPDATE spec_template_fields SET field_key = ?, field_label = ?, field_type = ?, options = ?, required = ?, sort_order = ? WHERE id = ?").run(
    updates.fieldKey ?? existing.field_key, updates.fieldLabel ?? existing.field_label,
    updates.fieldType ?? existing.field_type, JSON.stringify(updates.options ?? JSON.parse(existing.options || "[]")),
    updates.required !== undefined ? (updates.required ? 1 : 0) : existing.required, updates.sortOrder ?? existing.sort_order, id
  );
  return true;
}

function deleteSpecTemplateField(id: number): boolean {
  const r = getDb().prepare("DELETE FROM spec_template_fields WHERE id = ?").run(id);
  return r.changes > 0;
}

// ============ PRODUCT REVIEWS ============

function createReview(productId: string, customerId: number, rating: number, title: string, comment: string): any {
  getDb().prepare("INSERT INTO product_reviews (product_id, customer_id, rating, title, comment) VALUES (?, ?, ?, ?, ?)").run(productId, customerId, rating, title, comment);
  return getDb().prepare("SELECT pr.*, c.name AS customer_name FROM product_reviews pr JOIN customers c ON c.id = pr.customer_id WHERE pr.id = (SELECT MAX(id) FROM product_reviews)").get();
}

function getProductReviews(productId: string): any[] {
  return getDb().prepare("SELECT pr.*, c.name AS customer_name FROM product_reviews pr JOIN customers c ON c.id = pr.customer_id WHERE pr.product_id = ? ORDER BY pr.created_at DESC").all(productId);
}

function getProductRating(productId: string): { average: number; count: number } {
  const row = getDb().prepare("SELECT AVG(rating) as avg, COUNT(*) as cnt FROM product_reviews WHERE product_id = ?").get(productId) as any;
  return { average: row?.avg || 0, count: row?.cnt || 0 };
}

function hasCustomerReviewed(productId: string, customerId: number): boolean {
  return !!getDb().prepare("SELECT id FROM product_reviews WHERE product_id = ? AND customer_id = ?").get(productId, customerId);
}

// ============ SUPPLIERS ============

function listSuppliers(): any[] {
  return getDb().prepare("SELECT * FROM suppliers ORDER BY name ASC").all();
}

function getSupplier(id: number): any {
  return getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
}

function createSupplier(data: any): any {
  getDb().prepare("INSERT INTO suppliers (name, contact_name, email, phone, address, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(String(data.name || "").trim(), String(data.contact_name || "").trim(), String(data.email || "").trim(), String(data.phone || "").trim(), String(data.address || "").trim(), String(data.notes || "").trim(), data.is_active !== false ? 1 : 0);
  return getDb().prepare("SELECT * FROM suppliers ORDER BY id DESC LIMIT 1").get();
}

function updateSupplier(id: number, data: any): any {
  const sets: string[] = [];
  const vals: any[] = [];
  for (const k of ["name", "contact_name", "email", "phone", "address", "notes", "is_active"]) {
    if (data[k] !== undefined) { sets.push(`${k} = ?`); vals.push(data[k]); }
  }
  if (sets.length === 0) return getSupplier(id);
  vals.push(id);
  getDb().prepare(`UPDATE suppliers SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals);
  return getSupplier(id);
}

function deleteSupplier(id: number): boolean {
  return getDb().prepare("DELETE FROM suppliers WHERE id = ?").run(id).changes > 0;
}

function createSubscriptionRequest(planId: string, createdBy: number, notes: string = ""): boolean {
  const plan = getSubscriptionPlan(planId);
  if (!plan) return false;
  getDb().prepare("INSERT INTO subscription_requests (requested_plan_id, status, notes, created_by) VALUES (?, 'pending', ?, ?)").run(planId, notes, createdBy);
  return true;
}

function listSubscriptionRequests(status?: string): any[] {
  let sql = `SELECT sr.*, sp.name AS plan_name FROM subscription_requests sr JOIN subscription_plans sp ON sp.id = sr.requested_plan_id`;
  const params: any[] = [];
  if (status) { sql += " WHERE sr.status = ?"; params.push(status); }
  sql += " ORDER BY sr.created_at DESC";
  return getDb().prepare(sql).all(...params) as any[];
}

function reviewSubscriptionRequest(id: number, status: string, reviewedBy: number): boolean {
  if (!["approved", "rejected"].includes(status)) return false;
  const req = getDb().prepare("SELECT * FROM subscription_requests WHERE id = ? AND status = 'pending'").get(id) as any;
  if (!req) return false;
  getDb().prepare("UPDATE subscription_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?").run(status, reviewedBy, id);
  if (status === "approved") {
    setShopPlan(req.requested_plan_id);
  }
  return true;
}

// ============ AUDIT LOG ============

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

function logAudit(userId: number | null, userName: string, action: string, entityType: string, entityId: string | null, details: any = {}, actorRole: string = ""): void {
  getDb().prepare("INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, actor_role) VALUES (?, ?, ?, ?, ?, ?, ?)").run(userId, userName, action, entityType, entityId, JSON.stringify(details), actorRole);
}

function getAuditLog(limit: number = 200, entityType?: string, excludeRole?: string): AuditEntry[] {
  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const params: any[] = [];
  if (entityType) { sql += " AND entity_type = ?"; params.push(entityType); }
  if (excludeRole) { sql += " AND actor_role != ?"; params.push(excludeRole); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  return getDb().prepare(sql).all(...params).map((r: any) => ({
    id: r.id, userId: r.user_id, userName: r.user_name,
    action: r.action, entityType: r.entity_type, entityId: r.entity_id,
    details: r.details, createdAt: r.created_at,
  }));
}

function providerHasFeature(providerId: number, feature: string): boolean {
  const sub = getProviderSubscription(providerId);
  if (!sub) return false;
  const plan = getSubscriptionPlan(sub.planId);
  if (!plan) return false;
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];
  return features.some((f) => f.toLowerCase().trim() === feature.toLowerCase().trim());
}

function getStockTakeVarianceReport(sessionId: number): { totalItems: number; counted: number; withVariance: number; totalVariance: number; items: StockTakeItem[] } {
  const items = getStockTakeItems(sessionId);
  const counted = items.filter((i) => i.countedQuantity !== null);
  const withVariance = counted.filter((i) => i.variance !== 0);
  const totalVariance = counted.reduce((s, i) => s + Math.abs(i.variance), 0);
  return { totalItems: items.length, counted: counted.length, withVariance: withVariance.length, totalVariance, items };
}

function deleteStockTakeSession(sessionId: number): { ok: boolean; error?: string } {
  const session = getStockTakeSession(sessionId);
  if (!session) return { ok: false, error: "Session not found." };
  const counted = getDb().prepare("SELECT COUNT(*) AS c FROM stock_take_items WHERE session_id = ? AND counted_quantity IS NOT NULL").get(sessionId) as any;
  if (counted.c > 0) return { ok: false, error: "Cannot delete session with counted items." };
  getDb().prepare("DELETE FROM stock_take_items WHERE session_id = ?").run(sessionId);
  getDb().prepare("DELETE FROM stock_take_sessions WHERE id = ?").run(sessionId);
  return { ok: true };
}

// ============ STOCK SNAPSHOTS ============

function createStockSnapshot(snapshotDate?: string): boolean {
  const date = snapshotDate || new Date().toISOString().slice(0, 10);
  const products = getDb().prepare(`
    SELECT p.id, p.name, COALESCE(sl.quantity_in_stock, 0) AS qty
    FROM products p
    LEFT JOIN stock_levels sl ON sl.product_id = p.id
  `).all() as any[];

  getDb().transaction(() => {
    getDb().prepare("DELETE FROM stock_snapshots WHERE snapshot_date = ?").run(date);
    const insert = getDb().prepare("INSERT INTO stock_snapshots (snapshot_date, product_id, product_name, quantity) VALUES (?, ?, ?, ?)");
    for (const p of products) insert.run(date, p.id, p.name, p.qty);
  })();
  return true;
}

function getStockSnapshot(snapshotDate: string): { date: string; items: { productId: string; productName: string; quantity: number }[] } {
  const rows = getDb().prepare("SELECT * FROM stock_snapshots WHERE snapshot_date = ? ORDER BY product_name").all(snapshotDate) as any[];
  return { date: snapshotDate, items: rows.map((r: any) => ({ productId: r.product_id, productName: r.product_name, quantity: r.quantity })) };
}

function listStockSnapshotDates(): { date: string; createdAt: string }[] {
  return getDb().prepare("SELECT DISTINCT snapshot_date AS date, MAX(created_at) AS createdAt FROM stock_snapshots GROUP BY snapshot_date ORDER BY snapshot_date DESC").all() as any[];
}

function getCurrentStockLevels(): { productId: string; productName: string; quantity: number }[] {
  return getDb().prepare("SELECT p.id AS productId, p.name AS productName, COALESCE(sl.quantity_in_stock, 0) AS quantity FROM products p LEFT JOIN stock_levels sl ON sl.product_id = p.id ORDER BY p.name").all() as any[];
}

export {
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
  getPriceHistory,
  findAdminByUsername,
  findStaffByUsername,
  findStaffByEmail,
  findStaffById,
  listStaff,
  findCustomerByEmail,
  findCustomerById,
  createCustomer,
  getCartItems,
  getCartCount,
  addToCart,
  setCartQuantity,
  removeFromCart,
  clearCart,
  generateProductId,
  mapProduct,
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
  // Stock transfers
  createStockTransfer,
  getStockTransfer,
  listStockTransfers,
  completeStockTransfer,
  rejectStockTransfer,
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
  // Subscription plans
  listSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  // Providers
  findProviderByEmail,
  findProviderById,
  listProviders,
  createProvider,
  updateProvider,
  updateProviderStatus,
  // Provider plan assignments
  getProviderSubscription,
  assignPlanToProvider,
  getProviderAssignmentHistory,
  // Coupons
  validateCoupon,
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  // Orders
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
  updateOrderItemWarranty,
  // Product images
  getProductImages,
  addProductImage,
  deleteProductImage,
  setProductImageOrder,
  setPrimaryImage,
  // Product views
  recordProductView,
  getPopularProducts,
  getTotalViews,
  // Invoices
  createInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  generateProviderInvoice,
  getInvoiceRevenue,
  listOrderInvoices,
  markOrderInvoicePaid,
  generateEtimsInvoiceNumber,
  // Messages
  getMessagesForCustomer,
  getMessagesForProvider,
  sendMessage,
  markMessageRead,
  getUnreadMessageCount,
  // Repair images
  getRepairImages,
  addRepairImage,
  deleteRepairImage,
  // Purchase orders
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  addPurchaseOrderItem,
  updatePurchaseOrderStatus,
  receivePurchaseOrderItem,
  // Reports
  getTechPerformanceReport,
  getSalesReport,
  getPurchaseReport,
  // Wishlist
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  // Quotes
  createQuoteFromWishlist,
  createQuote,
  getQuote,
  listQuotesForCustomer,
  listAllQuotes,
  updateQuoteStatus,
  // Shop owner
  listAllCustomers,
  listActiveCustomers,
  updateCustomerLastLogin,
  updateCustomerStatus,
  deleteCustomer,
  deactivateOldCustomers,
  getCustomerDetails,
  listAllMessages,
  getSalesReportWithRange,
  getStockSummary,
  getEmployeeSalesPerformance,
  getTechnicianRepairStats,
  providerHasFeature,
  logAudit,
  getAuditLog,
  getStoreSetting,
  setStoreSetting,
  getShopPlan,
  setShopPlan,
  createSubscriptionRequest,
  listSubscriptionRequests,
  reviewSubscriptionRequest,
  // Stock take
  createStockTakeSession,
  getStockTakeSession,
  listStockTakeSessions,
  getStockTakeItems,
  recordStockCount,
  completeStockTakeSession,
  applyStockTakeAdjustments,
  getStockTakeVarianceReport,
  deleteStockTakeSession,
  // Stock snapshots
  createStockSnapshot,
  getStockSnapshot,
  listStockSnapshotDates,
  getCurrentStockLevels,
  // Branches
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchCount,
  getMaxBranchesForShop,
  canCreateBranch,
  // Clients (multi-tenant)
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
  // Spec templates
  getSpecTemplateFields,
  getAllSpecTemplateFields,
  createSpecTemplateField,
  updateSpecTemplateField,
  deleteSpecTemplateField,
  // Suppliers
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  // Product reviews
  createReview,
  getProductReviews,
  getProductRating,
  hasCustomerReviewed,
  // Auto reorder
  autoReorderLowStock,
  // Loyalty points
  getLoyaltyPoints,
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
  getLoyaltyTransactions,
  listAllLoyaltyCustomers,
  // Payment methods
  getPaymentMethods,
  setPaymentMethods,
};
