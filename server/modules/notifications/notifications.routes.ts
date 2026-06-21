// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, execute } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";

/**
 * Create notification helper (internal, exported for use by other modules).
 */
export async function createNotification(
  db: D1Database, recipientId: string, type: string, title: string, body: string,
  relatedEntityType?: string, relatedEntityId?: string, actorId?: string,
): Promise<void> {
  const now = nowIsoUtc();
  await execute(
    db,
    `INSERT INTO notifications (id, recipient_id, actor_id, notification_type, title, body, related_entity_type, related_entity_id, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId(), recipientId, actorId || null, type, title, body,
    relatedEntityType || null, relatedEntityId || null, now, actorId || recipientId, now, actorId || recipientId,
  );
}

export function registerNotificationRoutes(app: Hono): void {
  // List notifications for current user
  app.get("/api/notifications", requireAuth, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const unreadOnly = c.req.query("unreadOnly") === "true";
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query("pageSize") || "20")));
    const offset = (page - 1) * pageSize;

    const where = unreadOnly ? "n.recipient_id = ? AND n.read_at IS NULL AND n.deleted_at IS NULL" : "n.recipient_id = ? AND n.deleted_at IS NULL";

    const total = (await db.prepare(`SELECT COUNT(*) as total FROM notifications n WHERE ${where}`).bind(user.id).first<{ total: number }>())?.total || 0;
    const items = await queryAll(
      db,
      `SELECT n.*, u.display_name as actor_name
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       WHERE ${where}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      user.id, pageSize, offset,
    );

    return c.json({ ok: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const now = nowIsoUtc();
    await execute(db, "UPDATE notifications SET read_at = ?, read_by = ? WHERE id = ? AND recipient_id = ?", now, user.id, c.req.param("id"), user.id);
    return c.json({ ok: true, data: null });
  });

  // Mark all as read
  app.post("/api/notifications/read-all", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const now = nowIsoUtc();
    await execute(db, "UPDATE notifications SET read_at = ?, read_by = ? WHERE recipient_id = ? AND read_at IS NULL", now, user.id, user.id);
    return c.json({ ok: true, data: null });
  });

}



