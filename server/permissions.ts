import { query, queryOne, queryAll } from "./db-helpers";

interface PermissionMap {
  [key: string]: string;
}

interface RoleInfo {
  id: string;
  name: string;
  description: string | null;
  isCustom: boolean;
  permissions: string[];
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
  "product:list": "View products",
  "product:create": "Create products",
  "product:update": "Update products",
  "product:delete": "Delete products",
  "stock:list": "View stock levels",
  "stock:update": "Update stock levels",
  "stock:view_low": "View low stock items",
  "stock:on_hand": "View stock on hand",
  "stock:transfer": "Transfer stock between branches",
  "settings:view": "View store settings",
  "settings:update": "Update store settings",
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
};

interface DefaultRoles {
  [key: string]: string[];
}

const DEFAULT_ROLES: DefaultRoles = {
  admin: [
    "staff:list", "staff:create", "staff:update", "staff:delete",
    "repair:list", "repair:create", "repair:view", "repair:update",
    "repair:assign", "repair:cancel",
    "product:list", "product:create", "product:update", "product:delete",
    "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer",
    "settings:view", "settings:update",
    "calendar:view", "calendar:schedule",
    "reports:view", "reports:export",
    "messaging:view", "messaging:send",
    "invoice:view", "invoice:download",
    "credit_note:view", "credit_note:create",
    "quote:view", "quote:create", "quote:update",
  ],
  technician: [
    "repair:list", "repair:view", "repair:update",
    "calendar:view", "calendar:schedule", "product:list",
    "messaging:view", "messaging:send",
  ],
  staff: [
    "repair:list", "repair:view", "repair:update",
    "calendar:view", "calendar:schedule", "product:list",
    "messaging:view", "messaging:send",
  ],
  manager: [
    "staff:list",
    "repair:list", "repair:view", "repair:update", "repair:assign",
    "product:list", "product:update",
    "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer",
    "calendar:view", "calendar:schedule",
    "reports:view", "reports:export",
    "messaging:view", "messaging:send",
    "invoice:view", "invoice:download",
    "credit_note:view", "credit_note:create",
    "quote:view", "quote:create",
  ],
  owner: [
    "staff:list", "staff:create", "staff:update", "staff:delete",
    "repair:list", "repair:create", "repair:view", "repair:update",
    "repair:assign", "repair:cancel",
    "product:list", "product:create", "product:update", "product:delete",
    "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer",
    "settings:view", "settings:update",
    "calendar:view", "calendar:schedule",
    "reports:view", "reports:export",
    "messaging:view", "messaging:send",
    "invoice:view", "invoice:download",
    "credit_note:view", "credit_note:create",
    "quote:view", "quote:create", "quote:update",
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
    SELECT r.id, r.name, r.description, r.is_custom,
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
    permissions: (row.permissions || "").split(",").filter(Boolean)
  }));
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
    permissions: permissions.map(p => p.permission)
  };
}

async function createRole(roleId: string, name: string, description: string, permissions: string[]): Promise<RoleInfo | null> {
  await query("INSERT INTO roles (id, name, description, is_custom) VALUES ($1, $2, $3, 1)", [roleId, name, description || ""]);

  for (const permission of permissions || []) {
    if (PERMISSIONS[permission]) {
      await query("INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roleId, permission]);
    }
  }

  return getRole(roleId);
}

async function updateRole(roleId: string, updates: { name?: string; description?: string; permissions?: string[] }): Promise<RoleInfo | null> {
  const role = await getRole(roleId);
  if (!role) return null;

  if (updates.name || updates.description) {
    await query("UPDATE roles SET name = $1, description = $2 WHERE id = $3", [updates.name || role.name, updates.description || role.description, roleId]);
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
  const role = await getRole(roleId);
  if (!role || !role.isCustom) return false;
  const r = await query("DELETE FROM roles WHERE id = $1", [roleId]);
  return (r.rowCount ?? 0) > 0;
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
  return Number(directResult?.count) > 0;
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
};
