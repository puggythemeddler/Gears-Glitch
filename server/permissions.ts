import Database = require("better-sqlite3");

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

type Db = Database.Database;

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
  ],
  technician: [
    "repair:list", "repair:view", "repair:update",
    "calendar:view", "calendar:schedule", "product:list",
  ],
  manager: [
    "staff:list",
    "repair:list", "repair:view", "repair:update", "repair:assign",
    "product:list", "product:update",
    "stock:list", "stock:update", "stock:view_low", "stock:on_hand", "stock:transfer",
    "calendar:view", "calendar:schedule",
    "reports:view", "reports:export",
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
  ],
};

function initRoles(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (role_id, permission),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      permission TEXT NOT NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, permission),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const roleInsert = db.prepare("INSERT OR IGNORE INTO roles (id, name, description, is_custom) VALUES (?, ?, ?, 0)");
  for (const [roleId] of Object.entries(DEFAULT_ROLES)) {
    roleInsert.run(roleId, roleId.charAt(0).toUpperCase() + roleId.slice(1), `Default ${roleId} role`);
  }

  const permInsert = db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)");
  for (const [roleId, permissions] of Object.entries(DEFAULT_ROLES)) {
    for (const permission of permissions) {
      permInsert.run(roleId, permission);
    }
  }
}

function getAllPermissions(): PermissionMap {
  return PERMISSIONS;
}

function listRoles(db: Db): RoleInfo[] {
  const rows: any[] = db.prepare(`
    SELECT r.id, r.name, r.description, r.is_custom,
           GROUP_CONCAT(rp.permission) AS permissions
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    GROUP BY r.id
    ORDER BY r.name
  `).all();

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isCustom: Boolean(row.is_custom),
    permissions: (row.permissions || "").split(",").filter(Boolean)
  }));
}

function getRole(db: Db, roleId: string): RoleInfo | null {
  const role: any = db.prepare("SELECT * FROM roles WHERE id = ?").get(roleId);
  if (!role) return null;

  const permissions: any[] = db.prepare("SELECT permission FROM role_permissions WHERE role_id = ? ORDER BY permission").all(roleId);
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isCustom: Boolean(role.is_custom),
    permissions: permissions.map(p => p.permission)
  };
}

function createRole(db: Db, roleId: string, name: string, description: string, permissions: string[]): RoleInfo | null {
  const insert = db.prepare("INSERT INTO roles (id, name, description, is_custom) VALUES (?, ?, ?, 1)");
  insert.run(roleId, name, description || "");

  const permInsert = db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)");
  for (const permission of permissions || []) {
    if (PERMISSIONS[permission]) {
      permInsert.run(roleId, permission);
    }
  }

  return getRole(db, roleId);
}

function updateRole(db: Db, roleId: string, updates: { name?: string; description?: string; permissions?: string[] }): RoleInfo | null {
  const role = getRole(db, roleId);
  if (!role) return null;

  if (updates.name || updates.description) {
    db.prepare("UPDATE roles SET name = ?, description = ? WHERE id = ?")
      .run(updates.name || role.name, updates.description || role.description, roleId);
  }

  if (updates.permissions) {
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
    const insert = db.prepare("INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)");
    for (const permission of updates.permissions) {
      if (PERMISSIONS[permission]) {
        insert.run(roleId, permission);
      }
    }
  }

  return getRole(db, roleId);
}

function deleteRole(db: Db, roleId: string): boolean {
  const role = getRole(db, roleId);
  if (!role || !role.isCustom) return false;
  return db.prepare("DELETE FROM roles WHERE id = ?").run(roleId).changes > 0;
}

function getUserRoles(db: Db, userId: number): UserRole[] {
  return db.prepare(`
    SELECT r.id, r.name, r.description
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = ?
    ORDER BY r.name
  `).all(userId) as UserRole[];
}

function getUserPermissions(db: Db, userId: number): string[] {
  const rolePerms: any[] = db.prepare(`
    SELECT DISTINCT rp.permission
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = ?
    ORDER BY rp.permission
  `).all(userId);

  const directPerms: any[] = db.prepare(`
    SELECT DISTINCT permission FROM user_permissions WHERE user_id = ? ORDER BY permission
  `).all(userId);

  const combined = [...rolePerms.map(p => p.permission), ...directPerms.map(p => p.permission)];
  return [...new Set(combined)].sort();
}

function getUserDirectPermissions(db: Db, userId: number): string[] {
  const perms: any[] = db.prepare("SELECT permission FROM user_permissions WHERE user_id = ? ORDER BY permission").all(userId);
  return perms.map(p => p.permission);
}

function setUserDirectPermissions(db: Db, userId: number, permissions: string[]): void {
  db.prepare("DELETE FROM user_permissions WHERE user_id = ?").run(userId);
  const insert = db.prepare("INSERT INTO user_permissions (user_id, permission) VALUES (?, ?)");
  for (const perm of permissions) {
    if (PERMISSIONS[perm]) {
      insert.run(userId, perm);
    }
  }
}

function hasPermission(db: Db, userId: number, permission: string): boolean {
  const roleResult: any = db.prepare(`
    SELECT COUNT(*) as count FROM role_permissions rp
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = ? AND rp.permission = ?
  `).get(userId, permission);
  if (roleResult.count > 0) return true;

  const directResult: any = db.prepare(`
    SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ? AND permission = ?
  `).get(userId, permission);
  return directResult.count > 0;
}

function assignRoleToUser(db: Db, userId: number, roleId: string): boolean {
  const role = getRole(db, roleId);
  if (!role) return false;

  try {
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(userId, roleId);
    return true;
  } catch {
    return false;
  }
}

function removeRoleFromUser(db: Db, userId: number, roleId: string): boolean {
  return db.prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = ?").run(userId, roleId).changes > 0;
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
