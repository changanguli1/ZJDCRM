// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne, execute, batch } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { hashPassword } from "../../shared/crypto";
import { buildAccessContext, hasPermission } from "../access/access.service";
import { writeAuditLog } from "../../shared/audit";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";

const ADMIN_PERM = "system:admin:access";

function adminGuard() {
  return async (c: any, next: any) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: { code: "NOT_AUTHENTICATED", message: "未登录" } }, 401);

    const access = await buildAccessContext(c.env.DB, user.id);
    if (!hasPermission(access, ADMIN_PERM) && !user.isSuperAdmin) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "没有管理后台访问权限" } }, 403);
    }
    c.set("access", access);
    await next();
  };
}

export function registerAdminRoutes(app: Hono): void {
  // ==================== USERS ====================
  app.get("/api/admin/users", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "20")));
    const offset = (page - 1) * pageSize;

    const total = (await db.prepare("SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL").first<{ total: number }>())?.total || 0;
    const users = await queryAll(
      db,
      `SELECT u.id, u.account, u.display_name, u.mobile, u.email, u.department_id, u.status, u.is_super_admin, u.last_login_at, d.name as department_name
       FROM users u LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      pageSize, offset,
    );
    return c.json({ ok: true, data: { items: users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });

  app.post("/api/admin/users", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, string>;
    const now = nowIsoUtc();
    const id = createId();
    const { hash, salt, iterations } = await hashPassword(body.password || "changeme123");

    await execute(
      db,
      `INSERT INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, mobile, email, department_id, status, is_super_admin, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, body.account, body.account.toLowerCase().trim(), body.displayName,
      hash, salt, iterations, body.mobile || null, body.email || null,
      body.departmentId || null, body.status || "active", body.isSuperAdmin ? 1 : 0,
      now, user.id, now, user.id,
    );

    const ipAddress = c.req.header("cf-connecting-ip") || null;
    const userAgent = c.req.header("user-agent") || null;
    await writeAuditLog(db, {
      actorId: user.id, action: "admin:user:create", entityType: "user", entityId: id,
      ipAddress, userAgent, requestId: c.get("requestId"), summary: { account: body.account },
    });
    return c.json({ ok: true, data: { id } }, 201);
  });

  app.put("/api/admin/users/:id", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const userId = c.req.param("id");
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();

    await execute(
      db,
      "UPDATE users SET display_name = ?, mobile = ?, email = ?, department_id = ?, status = ?, is_super_admin = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
      body.displayName, body.mobile || null, body.email || null,
      body.departmentId || null, body.status || "active", body.isSuperAdmin ? 1 : 0,
      now, user.id, userId,
    );
    return c.json({ ok: true, data: null });
  });

  // ==================== DEPARTMENTS ====================
  app.get("/api/admin/departments", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const depts = await queryAll(db, "SELECT * FROM departments WHERE deleted_at IS NULL ORDER BY sort_order, name");
    return c.json({ ok: true, data: depts });
  });

  app.post("/api/admin/departments", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      db,
      "INSERT INTO departments (id, parent_id, code, name, sort_order, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, body.parentId || null, body.code, body.name, body.sortOrder || 0, body.status || "active", now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  // ==================== ROLES ====================
  app.get("/api/admin/roles", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const roles = await queryAll(db, "SELECT * FROM roles WHERE deleted_at IS NULL ORDER BY name");
    return c.json({ ok: true, data: roles });
  });

  app.post("/api/admin/roles", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      db,
      "INSERT INTO roles (id, code, name, description, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, body.code, body.name, body.description || null, 0, body.status || "active", now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  // ==================== DICTIONARIES ====================
  app.get("/api/admin/dictionaries", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const dicts = await queryAll(db, "SELECT * FROM dictionaries WHERE deleted_at IS NULL ORDER BY code");
    const items = await queryAll(db, "SELECT * FROM dictionary_items WHERE deleted_at IS NULL ORDER BY dictionary_id, sort_order");
    return c.json({ ok: true, data: { dictionaries: dicts, items } });
  });

  app.post("/api/admin/dictionaries", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      db,
      "INSERT INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, body.code, body.name, body.category || null, body.description || null, body.status || "active", now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  // ==================== AUDIT LOGS ====================
  app.get("/api/admin/audit-logs", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "20")));
    const offset = (page - 1) * pageSize;
    const actorId = c.req.query("actorId");
    const action = c.req.query("action");

    const conditions = ["1=1"];
    const params: unknown[] = [];
    if (actorId) { conditions.push("actor_id = ?"); params.push(actorId); }
    if (action) { conditions.push("action = ?"); params.push(action); }

    const where = conditions.join(" AND ");
    const total = (await db.prepare(`SELECT COUNT(*) as total FROM audit_logs WHERE ${where}`).bind(...params).first<{ total: number }>())?.total || 0;
    const logs = await queryAll(
      db,
      `SELECT al.*, u.display_name as actor_name FROM audit_logs al LEFT JOIN users u ON al.actor_id = u.id WHERE ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      ...params, pageSize, offset,
    );
    return c.json({ ok: true, data: { items: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });

  // ==================== SETTINGS ====================
  app.get("/api/admin/settings", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const settings = await queryAll(db, "SELECT * FROM system_settings WHERE deleted_at IS NULL");
    return c.json({ ok: true, data: settings });
  });

  app.put("/api/admin/settings", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Array<{ key: string; value: string }>;
    const now = nowIsoUtc();

    const stmts = body.map((s) => ({
      sql: "INSERT INTO system_settings (id, setting_key, setting_value, setting_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, 'text', 'active', ?, ?, ?, ?) ON CONFLICT(setting_key) WHERE deleted_at IS NULL DO UPDATE SET setting_value = ?, updated_at = ?, updated_by = ?",
      values: [createId(), s.key, s.value, now, user.id, now, user.id, s.value, now, user.id],
    }));
    await batch(db, stmts);
    return c.json({ ok: true, data: null });
  });

  // ==================== DELETED RECORDS ====================
  app.get("/api/admin/deleted-records", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const entityType = c.req.query("type") || "clues";
    const rows = await queryAll(
      db,
      `SELECT * FROM ${entityType} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100`,
    );
    return c.json({ ok: true, data: rows });
  });

  app.post("/api/admin/deleted-records/:type/:id/restore", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const entityType = c.req.param("type");
    const entityId = c.req.param("id");
    const now = nowIsoUtc();

    await execute(
      db,
      `UPDATE ${entityType} SET deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ? WHERE id = ?`,
      now, user.id, entityId,
    );
    return c.json({ ok: true, data: null });
  });

  // ==================== LOGIN LOGS ====================
  app.get("/api/admin/login-logs", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "50")));
    const offset = (page - 1) * pageSize;
    const total = (await db.prepare("SELECT COUNT(*) as total FROM login_logs").first<{ total: number }>())?.total || 0;
    const logs = await queryAll(db, "SELECT * FROM login_logs ORDER BY created_at DESC LIMIT ? OFFSET ?", pageSize, offset);
    return c.json({ ok: true, data: { items: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });
}



