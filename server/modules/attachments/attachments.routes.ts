// @ts-nocheck
import { Hono } from "hono";
import { assertClueAccess, buildAccessContext } from "../access/access.service";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { execute, queryAll, queryOne } from "../../shared/db";
import { writeAuditLog } from "../../shared/audit";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function error(c: any, status: 400 | 403 | 404, code: string, message: string) {
  return c.json({ ok: false, error: { code, message, requestId: c.get("requestId") } }, status);
}

async function attachmentWithAccess(c: any, mode: "read" | "write") {
  const attachment = await queryOne<any>(c.env.DB, "SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL", c.req.param("id"));
  if (!attachment) return null;
  const user = c.get("user");
  await assertClueAccess(c.env.DB, await buildAccessContext(c.env.DB, user.id), attachment.clue_id, mode);
  return attachment;
}

export function registerAttachmentRoutes(app: Hono): void {
  app.get("/api/clues/:clueId/attachments", requireAuth, async (c) => {
    const user = c.get("user");
    const clueId = c.req.param("clueId");
    try { await assertClueAccess(c.env.DB, await buildAccessContext(c.env.DB, user.id), clueId, "read"); }
    catch { return error(c, 404, "NOT_FOUND", "线索不存在或无权访问"); }
    const items = await queryAll<any>(c.env.DB, "SELECT id, original_file_name, content_type, file_size, uploaded_at FROM attachments WHERE clue_id = ? AND deleted_at IS NULL ORDER BY uploaded_at DESC", clueId);
    return c.json({ ok: true, data: items });
  });

  app.post("/api/clues/:clueId/attachments", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const clueId = c.req.param("clueId");
    try { await assertClueAccess(c.env.DB, await buildAccessContext(c.env.DB, user.id), clueId, "write"); }
    catch { return error(c, 404, "NOT_FOUND", "线索不存在或无权编辑"); }
    const file = (await c.req.parseBody()).file;
    if (!(file instanceof File) || file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.has(file.type)) return error(c, 400, "INVALID_ATTACHMENT", "文件类型不支持或超过 10MB");
    const id = createId();
    const storageKey = `attachments/${clueId}/${id}`;
    const now = nowIsoUtc();
    await c.env.FILES.put(storageKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` } });
    try {
      await execute(c.env.DB, "INSERT INTO attachments (id, clue_id, storage_key, original_file_name, content_type, file_size, uploaded_by, uploaded_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, clueId, storageKey, file.name, file.type, file.size, user.id, now, now, user.id, now, user.id);
    } catch (cause) {
      await c.env.FILES.delete(storageKey);
      throw cause;
    }
    await writeAuditLog(c.env.DB, { actorId: user.id, action: "attachment:create", entityType: "attachment", entityId: id, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { clueId, fileName: file.name } });
    return c.json({ ok: true, data: { id, originalFileName: file.name } }, 201);
  });

  app.get("/api/attachments/:id/download", requireAuth, async (c) => {
    let attachment: any;
    try { attachment = await attachmentWithAccess(c, "read"); } catch { return error(c, 404, "NOT_FOUND", "附件不存在或无权访问"); }
    if (!attachment) return error(c, 404, "NOT_FOUND", "附件不存在");
    const object = await c.env.FILES.get(attachment.storage_key);
    if (!object) return error(c, 404, "NOT_FOUND", "附件文件不存在");
    return new Response(object.body, { headers: { "content-type": attachment.content_type, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_file_name)}` } });
  });

  app.delete("/api/attachments/:id", requireAuth, requireCsrf, async (c) => {
    let attachment: any;
    try { attachment = await attachmentWithAccess(c, "write"); } catch { return error(c, 404, "NOT_FOUND", "附件不存在或无权编辑"); }
    if (!attachment) return error(c, 404, "NOT_FOUND", "附件不存在");
    const user = c.get("user"); const now = nowIsoUtc();
    await c.env.FILES.delete(attachment.storage_key);
    await execute(c.env.DB, "UPDATE attachments SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ?", now, user.id, now, user.id, attachment.id);
    await writeAuditLog(c.env.DB, { actorId: user.id, action: "attachment:delete", entityType: "attachment", entityId: attachment.id, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { clueId: attachment.clue_id } });
    return c.json({ ok: true, data: null });
  });
}
