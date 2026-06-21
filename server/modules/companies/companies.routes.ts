// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { normalizeCompanyName } from "../../shared/normalize-company";
import { requireAuth } from "../../middleware/auth";

export function registerCompanyRoutes(app: Hono): void {
  // Search companies by name
  app.get("/api/companies/search", requireAuth, async (c) => {
    const q = c.req.query("q") || "";
    if (q.length < 1) return c.json({ ok: true, data: [] });

    const user = c.get("user");
    const db = c.env.DB;

    const companies = await queryAll<{ id: string; name: string; normalized_name: string; main_business: string; industry_code: string }>(
      db,
      `SELECT id, name, normalized_name, main_business, industry_code
       FROM companies
       WHERE deleted_at IS NULL AND (name LIKE ? OR normalized_name LIKE ?)
       ORDER BY name ASC
       LIMIT 20`,
      `%${q}%`,
      `%${normalizeCompanyName(q)}%`,
    );

    return c.json({ ok: true, data: companies });
  });

  // Check duplicate company by name
  app.post("/api/companies/check-duplicate", requireAuth, async (c) => {
    const body = await c.req.json() as { name: string; excludeId?: string };
    if (!body.name) return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "企业名称不能为空" } }, 400);

    const normalizedName = normalizeCompanyName(body.name);
    const db = c.env.DB;

    let existing;
    if (body.excludeId) {
      existing = await queryOne<{ id: string; name: string }>(
        db,
        "SELECT id, name FROM companies WHERE normalized_name = ? AND id != ? AND deleted_at IS NULL",
        normalizedName,
        body.excludeId,
      );
    } else {
      existing = await queryOne<{ id: string; name: string }>(
        db,
        "SELECT id, name FROM companies WHERE normalized_name = ? AND deleted_at IS NULL",
        normalizedName,
      );
    }

    if (existing) {
      return c.json({
        ok: true,
        data: { duplicate: true, existingId: existing.id, existingName: existing.name },
      });
    }

    return c.json({ ok: true, data: { duplicate: false } });
  });
}



