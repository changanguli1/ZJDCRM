// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne } from "../../shared/db";
import { buildAccessContext, buildClueScopeFilter } from "../access/access.service";
import { requireAuth } from "../../middleware/auth";

export function registerDashboardRoutes(app: Hono): void {
  app.get("/api/dashboard", requireAuth, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const access = await buildAccessContext(db, user.id);
    const filter = buildClueScopeFilter(access);
    const scopeSql = filter.sql ? `AND ${filter.sql}` : "";
    const scopeParams = filter.params;

    const startDate = c.req.query("startDate") || "2000-01-01";
    const endDate = c.req.query("endDate") || "2099-12-31";
    const dateFilter = "AND c.created_at >= ? AND c.created_at <= ?";
    const allParams = [...scopeParams, startDate, endDate];

    // New clues count
    const newClues = await queryOne<{ total: number }>(
      db, `SELECT COUNT(*) as total FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} ${dateFilter}`, ...allParams,
    );

    // Stage distribution
    const stageDist = await queryAll<{ stage_code: string; total: number }>(
      db, `SELECT c.stage_code, COUNT(*) as total FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} GROUP BY c.stage_code ORDER BY c.stage_code`, ...scopeParams,
    );

    // Source distribution
    const sourceDist = await queryAll<{ source_code: string; total: number }>(
      db, `SELECT c.source_code, COUNT(*) as total FROM clues c WHERE c.deleted_at IS NULL AND c.source_code IS NOT NULL ${scopeSql} GROUP BY c.source_code`, ...scopeParams,
    );

    // Signed + landed count
    const signedLanded = await queryOne<{ signed: number; landed: number }>(
      db, `SELECT SUM(CASE WHEN stage_code = 'signed' THEN 1 ELSE 0 END) as signed, SUM(CASE WHEN stage_code = 'landed' THEN 1 ELSE 0 END) as landed FROM clues c WHERE c.deleted_at IS NULL ${scopeSql}`, ...scopeParams,
    );

    // Total expected area
    const expectedArea = await queryOne<{ total: number }>(
      db, `SELECT COALESCE(SUM(c.desired_area), 0) as total FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} AND c.desired_area IS NOT NULL`, ...scopeParams,
    );

    // Total expected output/tax
    const expectedOutput = await queryOne<{ output: number; tax: number }>(
      db, `SELECT COALESCE(SUM(c.expected_output), 0) as output, COALESCE(SUM(c.expected_tax), 0) as tax FROM clues c WHERE c.deleted_at IS NULL ${scopeSql}`, ...scopeParams,
    );

    // Space status counts
    const spaceStatus = await queryAll<{ status_code: string; total: number }>(
      db, "SELECT status_code, COUNT(*) as total FROM spaces WHERE deleted_at IS NULL GROUP BY status_code",
    );

    // Upcoming reminders
    const reminders = await queryAll(
      db,
      `SELECT c.id, c.title, c.next_followup_at, u.display_name as owner_name
       FROM clues c LEFT JOIN users u ON c.owner_id = u.id
       WHERE c.deleted_at IS NULL AND c.next_followup_at IS NOT NULL AND c.next_followup_at <= ?
       ORDER BY c.next_followup_at ASC LIMIT 10`,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );

    return c.json({
      ok: true,
      data: {
        newClues: newClues?.total || 0,
        stageDistribution: stageDist,
        sourceDistribution: sourceDist,
        signedCount: signedLanded?.signed || 0,
        landedCount: signedLanded?.landed || 0,
        expectedArea: expectedArea?.total || 0,
        expectedOutput: expectedOutput?.output || 0,
        expectedTax: expectedOutput?.tax || 0,
        spaceStatus,
        upcomingReminders: reminders,
      },
    });
  });
}



