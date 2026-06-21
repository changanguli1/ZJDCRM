// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne, execute } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";

export function registerContactRoutes(app: Hono): void {
  // List contacts for a clue
  app.get("/api/clues/:clueId/contacts", requireAuth, async (c) => {
    const db = c.env.DB;
    const clueId = c.req.param("clueId");
    const contacts = await queryAll(
      db,
      `SELECT ct.* FROM clue_contacts cc JOIN contacts ct ON cc.contact_id = ct.id
       WHERE cc.clue_id = ? AND ct.deleted_at IS NULL ORDER BY ct.is_primary_decision_maker DESC, ct.created_at ASC`,
      clueId,
    );
    return c.json({ ok: true, data: contacts });
  });

  // Add contact to clue
  app.post("/api/clues/:clueId/contacts", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("clueId");
    const body = await c.req.json() as Record<string, string>;
    const requestId = c.get("requestId");

    if (!body.name || !body.mobile) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "联系人姓名和手机号为必填项", requestId } }, 400);
    }

    // Check duplicate mobile
    const dup = await queryOne<{ id: string; name: string }>(
      db, "SELECT id, name FROM contacts WHERE mobile = ? AND deleted_at IS NULL", body.mobile,
    );
    if (dup) {
      return c.json({ ok: true, data: { duplicate: true, existingId: dup.id, existingName: dup.name } });
    }

    const now = nowIsoUtc();
    const contactId = createId();
    const clue = await queryOne<{ company_id: string }>(db, "SELECT company_id FROM clues WHERE id = ? AND deleted_at IS NULL", clueId);

    await execute(
      db,
      `INSERT INTO contacts (id, company_id, name, normalized_name, mobile, landline, email, title, department_name, is_primary_decision_maker, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      contactId, clue?.company_id || null, body.name, body.name.toLowerCase().trim(),
      body.mobile, body.landline || null, body.email || null, body.title || null,
      body.departmentName || null, body.isPrimaryDecisionMaker ? 1 : 0, body.notes || null,
      now, user.id, now, user.id,
    );

    await execute(
      db,
      `INSERT INTO clue_contacts (id, clue_id, contact_id, relation_type, is_primary, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, 'contact', ?, ?, ?, ?, ?, ?)`,
      createId(), clueId, contactId, body.isPrimaryDecisionMaker ? 1 : 0, now, user.id, now, user.id,
    );

    return c.json({ ok: true, data: { id: contactId } }, 201);
  });

  // Update contact
  app.put("/api/clues/:clueId/contacts/:contactId", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const { clueId, contactId } = c.req.param();
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();

    await execute(
      db,
      `UPDATE contacts SET name = ?, mobile = ?, title = ?, email = ?, is_primary_decision_maker = ?, notes = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`,
      body.name, body.mobile, body.title || null, body.email || null,
      body.isPrimaryDecisionMaker ? 1 : 0, body.notes || null, now, user.id, contactId,
    );

    return c.json({ ok: true, data: null });
  });

  // Delete contact
  app.delete("/api/clues/:clueId/contacts/:contactId", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const { clueId, contactId } = c.req.param();
    const now = nowIsoUtc();

    await execute(db, "UPDATE contacts SET deleted_at = ?, deleted_by = ? WHERE id = ?", now, user.id, contactId);
    await execute(db, "UPDATE clue_contacts SET deleted_at = ?, deleted_by = ? WHERE clue_id = ? AND contact_id = ?", now, user.id, clueId, contactId);

    return c.json({ ok: true, data: null });
  });
}



