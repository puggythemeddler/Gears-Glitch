import { query, queryOne, queryAll, transaction } from "./db-helpers";

interface PermissionMap {
  [key: string]: string;
}

interface RoleInfo {
  id: string;
  name: string;
  description: string | null;
  isCustom: boolean;
  permissions: string[];
  features: string[];
}

interface UserRole {
  id: string;
  name: string;
  description: string | null;
}

const PERMISSIONS: PermissionMap = {
  "staff:list": "View staff members",
  "staff:create": "Create new staff",
  "staff:update": "Update staff details",
  "staff:delete": "Delete staff",
  "repair:list": "View repair tickets",
  "repair:create": "Create repair tickets",
  "repair:view": "View repair details",
  "repair:update": "Update repairs",
  "repair:assign": "Assign repairs to technicians",
  "repair:cancel": "Cancel repairs",
  "repair:payment": "Record and refund repair payments",
  "repair:payment:void": "Void repair payment or refund entries",
  "warranty:view": "View warranty claims",
  "warranty:manage": "Update warranty claims",
  "serial:view": "View serial number records",
  "serial:manage": "Create and reconcile serial number records",
  "purchase:view": "View purchase orders",
  "purchase:manage": "Create and receive purchase orders",
  "product:list": "View products",
  "product:create": "Create products",
  "product:update": "Update products",
  "product:delete": "Delete products",
  "stock:list": "View stock levels",
  "stock:update": "Update stock levels",
  "stock:view_low": "View low stock items",
  "stock:on_hand": "View stock on hand",
  "stock:transfer": "Transfer stock between branches",
  "stock_take:reopen": "Reopen completed stock takes for recount",
  "stock_take:reverse": "Reverse applied stock-take adjustments",
  "settings:view": "View store settings",
  "settings:update": "Update store settings",
  "pages:view": "View custom pages",
  "pages:manage": "Create, edit and delete custom pages",
  "calendar:view": "View repair calendar",
  "calendar:schedule": "Schedule repairs",
  "reports:view": "View reports",
  "reports:export": "Export reports",
  "messaging:view": "View messages",
  "messaging:send": "Send messages",
  "invoice:view": "View invoices",
  "invoice:download": "Download invoice PDFs",
  "credit_note:view": "View credit notes",
  "credit_note:create": "Create credit notes",
  "quote:view": "View quotes",
  "quote:create": "Create quotes",
  "quote:update": "Update quotes",
  "order:view": "View orders",
  "order:without_payment": "Advance a confirmed order without recorded payment",
  "customer:view": "View customers",
  "coupon:view": "View coupons",
  "giftcard:view": "View gift cards",
  "campaign:view": "View campaigns",
  "cart:view": "View abandoned carts",
  "provider:view": "View providers",
  "spec:view": "View spec templates",
  "supplier:view": "View suppliers",
  "branch:view": "View branches",
  "subscription:view": "View shop subscription",
  "about:view": "View about-us editor",
  "about:update": "Edit about-us content and banner image",
  "positioning:view": "View product positioning",
  "whatsapp:view": "View WhatsApp settings",
  "whatsapp:manage": "Create, edit and delete WhatsApp templates and send WhatsApp messages",
  "whatsapp:approve": "Approve or unapprove WhatsApp message templates",
  "review:view": "View product reviews",
  "audit:view": "View audit log",
  "data:backup": "Export a full database backup",
  "financing:view": "View financing applications and agreements",
  "financing:manage": "Create and edit financing applications and agreements",
  "financing:approve": "Approve or reject financing applications",
  "financing:payment": "Record and reverse financing payments",
};

// Plan entitlements constrain role and direct permissions at the API boundary.
// When a plan is edited, the matching permission choices appear automatically;
// permissions for disabled features remain stored but cannot be assigned or used.
const PERMISSION_FEATURES: Record<string, string[]> = {
  "staff:list": ["Multiple staff accounts"], "staff:create": ["Multiple staff accounts"],
  "staff:update": ["Multiple staff accounts"], "staff:delete": ["Multiple staff accounts"],
  "repair:list": ["Repair ticketing"], "repair:create": ["Repair ticketing"], "repair:view": ["Repair ticketing"],
  "repair:update": ["Repair ticketing"], "repair:assign": ["Repair ticketing"], "repair:cancel": ["Repair ticketing"],
  "repair:payment": ["Repair ticketing"], "repair:payment:void": ["Repair ticketing"],
  "warranty:view": ["Warranty management"], "warranty:manage": ["Warranty management"],
  "serial:view": ["Serial number tracking"], "serial:manage": ["Serial number tracking"],
  "purchase:view": ["Purchase order management"], "purchase:manage": ["Purchase order management"],
  "calendar:view": ["Repair ticketing"], "calendar:schedule": ["Repair ticketing"],
  "product:list": ["Product listing"], "product:create": ["Product listing"],
  "product:update": ["Product listing"], "product:delete": ["Product listing"],
  "stock:list": ["Stock control", "Stock take", "Stock take / inventory count"],
  "stock:update": ["Stock control"], "stock:view_low": ["Low stock alerts"],
  "stock:on_hand": ["Stock control"], "stock:transfer": ["Stock transfers"],
  "stock_take:reopen": ["Stock take", "Stock take / inventory count"],
  "stock_take:reverse": ["Stock take", "Stock take / inventory count"],
  "reports:view": ["Analytics dashboard"], "reports:export": ["Analytics dashboard"],
  "messaging:view": ["Messaging"], "messaging:send": ["Messaging"],
  "invoice:view": ["Invoice/quote PDF downloads"], "invoice:download": ["Invoice/quote PDF downloads"],
  "credit_note:view": ["Credit notes"], "credit_note:create": ["Credit notes"],
  "quote:view": ["Quotations"], "quote:create": ["Quotations"], "quote:update": ["Quotations"],
  "order:view": ["Order management"], "order:without_payment": ["Order management"],
  "customer:view": ["Customer management"], "coupon:view": ["Discount/coupon management"],
  "giftcard:view": ["Gift cards"], "campaign:view": ["Campaign pages"], "cart:view": ["Cart recovery"],
  "provider:view": ["Payment method configuration"], "spec:view": ["Spec templates"],
  "supplier:view": ["Supplier management"], "branch:view": ["Branch management"],
  "subscription:view": ["Shop subscription"], "positioning:view": ["Product positioning"],
  "pages:view": ["Custom pages & landing pages"], "pages:manage": ["Custom pages & landing pages"],
  "whatsapp:view": ["WhatsApp integration"], "whatsapp:manage": ["WhatsApp integration"],
  "whatsapp:approve": ["WhatsApp integration"], "review:view": ["Product reviews & ratings", "Customer reviews"],
  "audit:view": ["Audit log"], "financing:view": ["Lipa Mdogo Mdogo"],
  "data:backup": ["Database backup and export"],
  "financing:manage": ["Lipa Mdogo Mdogo"], "financing:approve": ["Lipa Mdogo Mdogo"],
  "financing:payment": ["Lipa Mdogo Mdogo"],
};

function isPermissionAvailableForFeatures(permission: string, features: string[]): boolean {
  const required = PERMISSION_FEATURES[permission];
  if (!required) return true;
  const enabled = new Set(features.map((feature) => feature.toLowerCase().trim()));
  return required.some((feature) => enabled.has(feature.toLowerCase().trim()));
}

function filterPermissionsForFeatures<T extends Record<string, unknown>>(permissions: T, features: string[]): T {
  return Object.fromEntries(Object.entries(permissions).filter(([permission]) => isPermissionAvailableForFeatures(permission, features))) as T;
}

interface DefaultRoles {
  [key: string]: string[];
}

const DEFAULT_ROLES: DefaultRoles = {
  admin: [
    "staff:list", "staff:create", "staff:update", "staff:delete",
    "repair:list", "repair:create", "repair:view", "repair:update",
    "repair:assign", "repair:cancel", "repair:payment", "repair:payment:void",
    "warranty:view", "warranty:manage", "serial:view", "serial:manage", "purchase:view", "purchase:manage",
    "product:list", "product:create", "product:update", "product:delete",
    "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer", "stock_take:reopen", "stock_take:reverse",
    "settings:view", "settings:update", "pages:view", "pages:manage",
    "calendar:view", "calendar:schedule",
    "reports:view", "reports:export",
    "messaging:view", "messaging:send",
    "invoice:view", "invoice:download",
    "credit_note:view", "credit_note:create",
    "quote:view", "quote:create", "quote:update",
    "order:view", "order:without_payment", "customer:view", "coupon:view", "giftcard:view",
    "campaign:view", "cart:view", "provider:view", "spec:view",
    "supplier:view", "branch:view", "subscription:view", "about:view", "about:update",
    "positioning:view", "whatsapp:view", "whatsapp:manage", "whatsapp:approve", "review:view", "audit:view", "data:backup",
    "financing:view", "financing:manage", "financing:approve", "financing:payment",
  ],
  technician: [
    "repair:list", "repair:view", "repair:update",
    "calendar:view", "calendar:schedule", "product:list", "serial:view",
  ],
  staff: [
    "repair:list", "repair:view", "repair:update",
    "calendar:view", "calendar:schedule", "product:list", "serial:view",
  ],
  manager: [
    "staff:list", "warranty:view", "serial:view", "serial:manage", "purchase:view",
    "repair:list", "repair:view", "repair:update", "repair:assign",
    "product:list", "product:update",
    "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer",
    "calendar:view", "calendar:schedule",
    "reports:view", "reports:export",
    "messaging:view", "messaging:send",
    "invoice:view", "invoice:download",
    "credit_note:view", "credit_note:create",
    "quote:view", "quote:create",
    "order:view", "customer:view", "repair:payment",
    "financing:view", "financing:manage", "financing:payment",
  ],
  provider: [
    "repair:list", "repair:view", "repair:update",
    "product:list", "product:update",
    "stock:list", "stock:update", "stock:view_low",
    "calendar:view", "calendar:schedule",
    "order:view", "customer:view",
    "messaging:view", "messaging:send",
    "provider:view",
  ],
  owner: [
    "staff:list", "staff:create", "staff:update", "staff:delete",
    "repair:list", "repair:create", "repair:view", "repair:update",
    "repair:assign", "repair:cancel", "repair:payment", "repair:payment:void",
    "warranty:view", "warranty:manage", "serial:view", "serial:manage", "purchase:view", "purchase:manage",
    "product:list", "product:create", "product:update", "product:delete",
    "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer", "stock_take:reopen", "stock_take:reverse",
    "settings:view", "settings:update", "pages:view", "pages:manage",
    "calendar:view", "calendar:schedule",
    "reports:view", "reports:export",
    "messaging:view", "messaging:send",
    "invoice:view", "invoice:download",
    "credit_note:view", "credit_note:create",
    "quote:view", "quote:create", "quote:update",
    "order:view", "order:without_payment", "customer:view", "coupon:view", "giftcard:view",
    "campaign:view", "cart:view", "provider:view", "spec:view",
    "supplier:view", "branch:view", "subscription:view", "about:view", "about:update",
    "positioning:view", "whatsapp:view", "whatsapp:manage", "whatsapp:approve", "review:view", "audit:view", "data:backup",
    "financing:view", "financing:manage", "financing:approve", "financing:payment",
  ],
};

async function initRoles(): Promise<void> {
  for (const [roleId] of Object.entries(DEFAULT_ROLES)) {
    const name = roleId.charAt(0).toUpperCase() + roleId.slice(1);
    await query("INSERT INTO roles (id, name, description, is_custom) VALUES ($1, $2, $3, 0) ON CONFLICT(id) DO NOTHING", [roleId, name, `Default ${roleId} role`]);
  }

  for (const [roleId, permissions] of Object.entries(DEFAULT_ROLES)) {
    for (const permission of permissions) {
      await query("INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT(role_id, permission) DO NOTHING", [roleId, permission]);
    }
  }
}

function getAllPermissions(): PermissionMap {
  return PERMISSIONS;
}

async function listRoles(): Promise<RoleInfo[]> {
  const rows: any[] = await queryAll(`
    SELECT r.id, r.name, r.description, r.is_custom, r.features,
           STRING_AGG(rp.permission, ',') AS permissions
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    GROUP BY r.id
    ORDER BY r.name
  `);

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isCustom: Boolean(row.is_custom),
    permissions: (row.permissions || "").split(",").filter(Boolean),
    features: parseFeatures(row.features),
  }));
}

function parseFeatures(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
    return raw.split(",").map((s: string) => s.trim()).filter(Boolean);
  }
  return [];
}

async function getRole(roleId: string): Promise<RoleInfo | null> {
  const role: any = await queryOne("SELECT * FROM roles WHERE id = $1", [roleId]);
  if (!role) return null;

  const permissions: any[] = await queryAll("SELECT permission FROM role_permissions WHERE role_id = $1 ORDER BY permission", [roleId]);
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isCustom: Boolean(role.is_custom),
    permissions: permissions.map(p => p.permission),
    features: parseFeatures(role.features),
  };
}

async function createRole(roleId: string, name: string, description: string, permissions: string[], features?: string[]): Promise<RoleInfo | null> {
  await query("INSERT INTO roles (id, name, description, features, is_custom) VALUES ($1, $2, $3, $4, 1)", [roleId, name, description || "", JSON.stringify(features || [])]);

  for (const permission of permissions || []) {
    if (PERMISSIONS[permission]) {
      await query("INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roleId, permission]);
    }
  }

  return getRole(roleId);
}

async function updateRole(roleId: string, updates: { name?: string; description?: string; permissions?: string[]; features?: string[] }): Promise<RoleInfo | null> {
  const role = await getRole(roleId);
  if (!role) return null;

  if (updates.name || updates.description) {
    await query("UPDATE roles SET name = $1, description = $2 WHERE id = $3", [updates.name || role.name, updates.description || role.description, roleId]);
  }

  if (updates.features) {
    await query("UPDATE roles SET features = $1 WHERE id = $2", [JSON.stringify(updates.features), roleId]);
  }

  if (updates.permissions) {
    await query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);
    for (const permission of updates.permissions) {
      if (PERMISSIONS[permission]) {
        await query("INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2)", [roleId, permission]);
      }
    }
  }

  return getRole(roleId);
}

async function deleteRole(roleId: string): Promise<boolean> {
  if (roleId === "admin") return false;
  const role = await getRole(roleId);
  if (!role) return false;
  // Tombstone the id so default roles the client has deleted are not re-seeded
  // on restart. The tombstone lives in this client's own database, so other
  // clients are never affected.
  await transaction(async (client) => {
    await client.query("DELETE FROM roles WHERE id = $1", [roleId]);
    await client.query("INSERT INTO deleted_roles (id) VALUES ($1) ON CONFLICT DO NOTHING", [roleId]);
  });
  return true;
}

async function getUserRoles(userId: number): Promise<UserRole[]> {
  return await queryAll(`
    SELECT r.id, r.name, r.description
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1
    ORDER BY r.name
  `, [userId]) as UserRole[];
}

async function getUserPermissions(userId: number): Promise<string[]> {
  const rolePerms: any[] = await queryAll(`
    SELECT DISTINCT rp.permission
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = $1
    ORDER BY rp.permission
  `, [userId]);

  const directPerms: any[] = await queryAll(`
    SELECT DISTINCT permission FROM user_permissions WHERE user_id = $1 ORDER BY permission
  `, [userId]);

  const combined = [...rolePerms.map(p => p.permission), ...directPerms.map(p => p.permission)];
  return [...new Set(combined)].sort();
}

async function getUserDirectPermissions(userId: number): Promise<string[]> {
  const perms: any[] = await queryAll("SELECT permission FROM user_permissions WHERE user_id = $1 ORDER BY permission", [userId]);
  return perms.map(p => p.permission);
}

// Union of features across a user's roles. Roles with an empty feature list
// are treated as unrestricted, so if ANY of the user's roles has no features
// configured the user inherits the full plan. Returns null when unrestricted.
async function getUserRoleFeatures(userId: number): Promise<string[] | null> {
  const rows: any[] = await queryAll(`
    SELECT r.features FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = $1
  `, [userId]);
  if (!rows.length) return null;

  const merged = new Set<string>();
  let allRestricted = true;
  for (const row of rows) {
    const features = parseFeatures(row.features);
    if (features.length === 0) {
      allRestricted = false;
    } else {
      for (const f of features) merged.add(f);
    }
  }
  return allRestricted ? [...merged] : null;
}

async function setUserDirectPermissions(userId: number, permissions: string[]): Promise<void> {
  await query("DELETE FROM user_permissions WHERE user_id = $1", [userId]);
  for (const perm of permissions) {
    if (PERMISSIONS[perm]) {
      await query("INSERT INTO user_permissions (user_id, permission) VALUES ($1, $2)", [userId, perm]);
    }
  }
}

async function hasPermission(userId: number, permission: string): Promise<boolean> {
  const roleResult: any = await queryOne(`
    SELECT COUNT(*) as count FROM role_permissions rp
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = $1 AND rp.permission = $2
  `, [userId, permission]);
  if (Number(roleResult?.count) > 0) return true;

  const directResult: any = await queryOne(`
    SELECT COUNT(*) as count FROM user_permissions WHERE user_id = $1 AND permission = $2
  `, [userId, permission]);
  if (Number(directResult?.count) > 0) return true;

  // Z-1 safety fallback: a user's base role (users.role) also grants its permissions.
  // createStaff/updateStaffRole set users.role directly without touching user_roles,
  // so without this fallback a staff member could be locked out of their own role's
  // actions. Explicit user_roles/user_permissions still take precedence (checked above).
  const base: any = await queryOne("SELECT role FROM users WHERE id = $1", [userId]);
  if (base?.role) {
    const baseRole: any = await queryOne(
      "SELECT COUNT(*) as count FROM role_permissions WHERE role_id = $1 AND permission = $2",
      [base.role, permission]
    );
    if (Number(baseRole?.count) > 0) return true;
  }
  return false;
}

async function assignRoleToUser(userId: number, roleId: string): Promise<boolean> {
  const role = await getRole(roleId);
  if (!role) return false;

  try {
    await query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, roleId]);
    return true;
  } catch {
    return false;
  }
}

async function removeRoleFromUser(userId: number, roleId: string): Promise<boolean> {
  const r = await query("DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2", [userId, roleId]);
  return (r.rowCount ?? 0) > 0;
}

export {
  PERMISSIONS,
  DEFAULT_ROLES,
  initRoles,
  getAllPermissions,
  isPermissionAvailableForFeatures,
  filterPermissionsForFeatures,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getUserRoles,
  getUserPermissions,
  getUserRoleFeatures,
  getUserDirectPermissions,
  setUserDirectPermissions,
  hasPermission,
  assignRoleToUser,
  removeRoleFromUser,
};
