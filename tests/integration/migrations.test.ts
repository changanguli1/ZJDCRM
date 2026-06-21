import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import coreMigration from "../../migrations/0001_core.sql?raw";
import businessMigration from "../../migrations/0002_business.sql?raw";
import workflowMigration from "../../migrations/0003_workflows.sql?raw";
import indexMigration from "../../migrations/0004_indexes.sql?raw";

type MigrationFile = {
  name: string;
  sql: string;
};

const migrations: MigrationFile[] = [
  { name: "0001_core.sql", sql: coreMigration },
  { name: "0002_business.sql", sql: businessMigration },
  { name: "0003_workflows.sql", sql: workflowMigration },
  { name: "0004_indexes.sql", sql: indexMigration },
];

function splitSqlStatements(sql: string) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

const requiredTables = [
  "users",
  "departments",
  "roles",
  "permissions",
  "user_roles",
  "role_permissions",
  "role_data_scopes",
  "sessions",
  "login_logs",
  "dictionaries",
  "dictionary_items",
  "system_settings",
  "companies",
  "clues",
  "contacts",
  "clue_contacts",
  "followups",
  "stage_histories",
  "tags",
  "clue_tags",
  "clue_collaborators",
  "attachments",
  "parks",
  "buildings",
  "floors",
  "spaces",
  "clue_space_matches",
  "clue_landings",
  "notifications",
  "import_jobs",
  "import_job_rows",
  "export_requests",
  "export_files",
  "audit_logs",
  "backup_records",
] as const;

const requiredIndexes = [
  "companies_normalized_name_active_uq",
  "clues_owner_id_stage_code_idx",
  "contacts_mobile_idx",
  "followups_next_followup_at_idx",
  "notifications_recipient_id_idx",
  "audit_logs_created_at_idx",
] as const;

describe("database migrations", () => {
  it("apply the full D1 schema and preserve the required database contract", async () => {
    await env.DB.exec("PRAGMA foreign_keys = ON");
    for (const migration of migrations) {
      expect(migration.name).toMatch(/^\d{4}_.+\.sql$/);
      for (const statement of splitSqlStatements(migration.sql)) {
        await env.DB.exec(`${statement.replace(/\s+/g, " ")};`);
      }
    }

    const tables = await env.DB
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_cf_METADATA' ORDER BY name",
      )
      .all<{ name: string }>();

    expect(tables.results.map((row) => row.name)).toEqual([...requiredTables].sort());

    const indexes = await env.DB
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all<{ name: string; sql: string | null }>();

    expect(indexes.results.map((row) => row.name)).toEqual(
      expect.arrayContaining([...requiredIndexes]),
    );

    const normalizedCompanyIndex = indexes.results.find(
      (row) => row.name === "companies_normalized_name_active_uq",
    );
    expect(normalizedCompanyIndex?.sql).toContain("WHERE deleted_at IS NULL");
    expect(normalizedCompanyIndex?.sql).toContain("normalized_name");

    await env.DB.prepare(
      "INSERT INTO companies (id, name, normalized_name, main_business, industry_code, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        "company-1",
        "  星河产业  ",
        "xinghe",
        "招商服务",
        "K70",
        "active",
        "2026-06-21T00:00:00Z",
        "admin",
        "2026-06-21T00:00:00Z",
        "admin",
      )
      .run();

    await expect(
      env.DB
        .prepare(
          "INSERT INTO companies (id, name, normalized_name, main_business, industry_code, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "company-2",
          "星河产业（重复）",
          "xinghe",
          "招商服务",
          "K70",
          "active",
          "2026-06-21T00:00:00Z",
          "admin",
          "2026-06-21T00:00:00Z",
          "admin",
        )
        .run(),
    ).rejects.toThrow();

    await expect(
      env.DB
        .prepare(
          "INSERT INTO clues (id, title, company_id, desired_area, acquired_at, expected_landing_at, stage_code, bottleneck, source_code, internal_referral_flag, financing_flag, prior_location, lost_reason, fiscal_completion, expected_output, expected_tax, owner_id, department_id, actual_space_id, actual_area, actual_landing_at, actual_fiscal_completion, version, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "clue-1",
          "外部招商线索",
          "missing-company",
          "1000.00",
          "2026-06-21T00:00:00Z",
          "2026-07-01T00:00:00Z",
          "new",
          "",
          "referral",
          0,
          0,
          "",
          "",
          "",
          "",
          "",
          "user-1",
          "dept-1",
          null,
          null,
          null,
          null,
          1,
          "2026-06-21T00:00:00Z",
          "admin",
          "2026-06-21T00:00:00Z",
          "admin",
        )
        .run(),
    ).rejects.toThrow();
  });
});
