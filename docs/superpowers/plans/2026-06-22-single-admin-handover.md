# Single-admin handover implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `admin` as the sole system-management account, while enabling it to manage ordinary employees, authorised attachments, and recovery records.

**Architecture:** Session and request state expose `canManageSystem`, derived only from `is_super_admin`. Both the Hono guard and React routing use it. Employee administration stays in the admin module; a dedicated attachment module coordinates D1 metadata and R2 bytes.

**Tech Stack:** React 19, Hono, Cloudflare D1/R2, Vitest Workers pool, Playwright.

---

## Files

- Modify: `server/modules/auth/auth.service.ts`, `server/middleware/auth.ts`, `server/modules/admin/admin.routes.ts`, `server/app.ts`.
- Create: `server/modules/attachments/attachments.routes.ts`, `src/features/clues/AttachmentPanel.tsx`.
- Modify: `src/features/auth/auth.api.ts`, `src/features/auth/auth.store.tsx`, `src/app/AuthGuard.tsx`, `src/app/AppShell.tsx`, `src/features/admin/UsersPage.tsx`, `src/lib/api.ts`, `src/features/clues/ClueDetailPage.tsx`.
- Test: `tests/integration/admin-workflows.test.ts`, `tests/components/auth-guard.test.tsx`, `tests/e2e/app.spec.ts`.

### Task 1: Make the system-management check single-source

**Files:** `server/modules/auth/auth.service.ts`, `server/middleware/auth.ts`, `server/modules/admin/admin.routes.ts`, `src/features/auth/auth.api.ts`, `src/features/auth/auth.store.tsx`, `src/app/AuthGuard.tsx`, `src/app/AppShell.tsx`, and the two auth/admin tests.

- [ ] **Step 1: Write a failing normal-role test**

```ts
async function loginWith(account: string, password: string) {
  return createApi().request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account, password }) }, env);
}
async function loginCookie(account: string, password: string) {
  return (await loginWith(account, password)).headers.get("set-cookie") || "";
}
async function requestWithCookie(cookie: string, method: string, path: string) {
  return createApi().request(`http://localhost${path}`, { method, headers: { cookie } }, env);
}
async function seedRoles(ids: string[]) {
  const now = "2026-06-22T00:00:00.000Z";
  for (const id of ids) await env.DB.prepare("INSERT OR IGNORE INTO roles (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, 0, 'active', ?, 'seed', ?, 'seed')").bind(id, id, id, now, now).run();
}
it("denies admin APIs to a normal role with the legacy permission", async () => {
  await seedPermissionAndRole("system:admin:access", "role-legacy");
  const employee = await createEmployeeWithRole("legacy-user", "role-legacy");
  const cookie = await loginCookie("legacy-user", employee.password);
  expect((await requestWithCookie(cookie, "GET", "/api/admin/users")).status).toBe(403);
});
```

- [ ] **Step 2: Verify the test is red**

Run: `npm run test:run -- tests/integration/admin-workflows.test.ts`

Expected: FAIL because the existing guard accepts `system:admin:access`.

- [ ] **Step 3: Add the capability and enforce it everywhere**

```ts
export interface SessionUser {
  id: string; account: string; displayName: string;
  isSuperAdmin: boolean; canManageSystem: boolean;
  departmentId: string | null;
}

const sessionUser = (user: { id: string; account: string; display_name: string; is_super_admin: number; department_id: string | null }): SessionUser => ({
  id: user.id, account: user.account, displayName: user.display_name,
  isSuperAdmin: user.is_super_admin === 1,
  canManageSystem: user.is_super_admin === 1,
  departmentId: user.department_id,
});
```

Use `sessionUser` in login/session responses and add `canManageSystem` to `requireAuth`. Change `adminGuard` to `if (!user.canManageSystem) return forbidden;`. Replace `isSuperAdmin` checks in `AuthGuard` and `AppShell` with the new field. Exclude `system:admin:access` from the roles permission list.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm run test:run -- tests/integration/admin-workflows.test.ts tests/components/auth-guard.test.tsx`

Expected: PASS; only the current super-admin can reach `/api/admin/*` or see the admin navigation.

Commit: `git add server/modules/auth/auth.service.ts server/middleware/auth.ts server/modules/admin/admin.routes.ts src/features/auth/auth.api.ts src/features/auth/auth.store.tsx src/app/AuthGuard.tsx src/app/AppShell.tsx tests/integration/admin-workflows.test.ts tests/components/auth-guard.test.tsx && git commit -m "fix: restrict system management to the single admin"`

### Task 2: Complete ordinary-employee management

**Files:** `server/modules/admin/admin.routes.ts`, `src/features/admin/UsersPage.tsx`, `tests/integration/admin-workflows.test.ts`, `tests/e2e/app.spec.ts`.

- [ ] **Step 1: Write red lifecycle tests**

```ts
it("edits an employee, replaces roles and resets their password", async () => {
  await seedRoles(["role-a", "role-b"]);
  const created = await request("POST", "/api/admin/users", { account: "editable", displayName: "Before", password: "employee-pass-123", roleIds: ["role-a"] });
  const id = created.body.data.id;
  expect((await request("PUT", `/api/admin/users/${id}`, { displayName: "After", roleIds: ["role-b"] })).status).toBe(200);
  expect((await request("POST", `/api/admin/users/${id}/reset-password`, { newPassword: "replacement-pass-123" })).status).toBe(200);
  expect((await loginWith("editable", "employee-pass-123")).status).toBe(401);
  expect((await loginWith("editable", "replacement-pass-123")).status).toBe(200);
});

it("rejects creating or promoting a second admin", async () => {
  expect((await request("POST", "/api/admin/users", { account: "second", displayName: "Second", password: "password-123", isSuperAdmin: true })).status).toBe(400);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:run -- tests/integration/admin-workflows.test.ts`

Expected: FAIL because update does not replace roles and no reset endpoint exists.

- [ ] **Step 3: Implement server-side employee rules**

```ts
async function activeRoleIds(db: D1Database, value: unknown): Promise<string[]> {
  const ids = [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))];
  const rows = ids.length ? await queryAll<{ id: string }>(db, `SELECT id FROM roles WHERE id IN (${ids.map(() => "?").join(",")}) AND status = 'active' AND deleted_at IS NULL`, ...ids) : [];
  if (rows.length !== ids.length) throw { status: 400, code: "INVALID_ROLE_IDS", message: "包含无效角色" };
  return ids;
}
```

Reject `isSuperAdmin: true` in employee create/update, remove it from mutable fields, and return each employee's `role_ids` using `GROUP_CONCAT`. On role update, validate IDs, delete existing `user_roles`, batch insert the new IDs, revoke sessions when disabled, and audit the action. Add `POST /api/admin/users/:id/reset-password`: reject the admin target and passwords under eight characters, hash the replacement, revoke target sessions, and audit it.

- [ ] **Step 4: Add edit/reset controls and browser test**

```tsx
const saveEmployee = async (event: React.FormEvent) => {
  event.preventDefault();
  if (!editingUser) return;
  await api.put(`/admin/users/${editingUser.id}`, { ...editForm, roleIds: editRoleIds }, csrfToken);
  setEditingUser(null);
  await fetchUsers();
};
```

Add labelled edit fields, role checkboxes and a separate password reset input to `UsersPage`. Remove the super-admin checkbox. The admin row is read-only. Extend Playwright to edit a created employee and assert the new display name and role are visible.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- tests/integration/admin-workflows.test.ts && npm run e2e -- --grep "role-based user"`

Expected: PASS; account editing, role replacement, session revocation and second-admin denial are verified.

Commit: `git add server/modules/admin/admin.routes.ts src/features/admin/UsersPage.tsx tests/integration/admin-workflows.test.ts tests/e2e/app.spec.ts && git commit -m "feat: complete single-admin employee management"`

### Task 3: Add authorised clue attachments

**Files:** `server/modules/attachments/attachments.routes.ts`, `server/app.ts`, `src/lib/api.ts`, `src/features/clues/AttachmentPanel.tsx`, `src/features/clues/ClueDetailPage.tsx`, plus integration and E2E tests.

- [ ] **Step 1: Write a red R2/D1 lifecycle test**

```ts
it("stores, lists, downloads and deletes an authorised clue attachment", async () => {
  const clue = await createClue("Attachment clue");
  const form = new FormData();
  form.set("file", new File(["contract body"], "contract.txt", { type: "text/plain" }));
  const upload = await createApi().request(`http://localhost/api/clues/${clue.id}/attachments`, { method: "POST", headers: { cookie, "x-csrf-token": csrfToken }, body: form }, env);
  expect(upload.status).toBe(201);
  const attachment = (await upload.json()).data;
  expect((await createApi().request(`http://localhost/api/attachments/${attachment.id}/download`, { headers: { cookie } }, env)).status).toBe(200);
  expect((await request("DELETE", `/api/attachments/${attachment.id}`)).status).toBe(200);
  expect(await env.FILES.get(attachment.storage_key)).toBeNull();
});
```

- [ ] **Step 2: Verify it fails with 404**

Run: `npm run test:run -- tests/integration/admin-workflows.test.ts`

Expected: FAIL because attachment routes are not registered.

- [ ] **Step 3: Implement route-level authorization and cleanup**

```ts
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

app.post("/api/clues/:clueId/attachments", requireAuth, requireCsrf, async (c) => {
  const user = c.get("user"); const clueId = c.req.param("clueId");
  await assertClueAccess(c.env.DB, await buildAccessContext(c.env.DB, user.id), clueId, "write");
  const file = (await c.req.parseBody()).file;
  if (!(file instanceof File) || file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.has(file.type)) return c.json({ ok: false, error: { code: "INVALID_ATTACHMENT", message: "文件类型不支持或超过 10MB", requestId: c.get("requestId") } }, 400);
  const id = createId(); const key = `attachments/${clueId}/${id}`; const now = nowIsoUtc();
  await c.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  try { await execute(c.env.DB, "INSERT INTO attachments (id, clue_id, storage_key, original_file_name, content_type, file_size, uploaded_by, uploaded_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, clueId, key, file.name, file.type, file.size, user.id, now, now, user.id, now, user.id); } catch (cause) { await c.env.FILES.delete(key); throw cause; }
  return c.json({ ok: true, data: { id, storage_key: key, original_file_name: file.name } }, 201);
});
```

Implement list/download/delete in the same module. Load the attachment's clue ID, call `assertClueAccess` in read or write mode before R2 access, audit each mutation, and physically delete R2 before soft-deleting metadata. Register the module in `server/app.ts`.

- [ ] **Step 4: Add multipart client and attachment panel**

```ts
async function request<T>(method: string, path: string, options?: { body?: unknown; csrfToken?: string; params?: Record<string, string> }): Promise<T> {
  const isForm = options?.body instanceof FormData;
  const headers: Record<string, string> = isForm ? {} : { "Content-Type": "application/json" };
  if (options?.csrfToken) headers["X-CSRF-Token"] = options.csrfToken;
  const response = await fetch(`${BASE}${path}`, { method, headers, credentials: "include", body: isForm ? options?.body as FormData : options?.body ? JSON.stringify(options.body) : undefined });
  const envelope: ApiEnvelope<T> = await response.json();
  if (!envelope.ok) throw new ApiError(envelope.error?.code || "UNKNOWN", envelope.error?.message || "请求失败", envelope.error?.requestId || "");
  return envelope.data as T;
}

upload: <T>(path: string, form: FormData, csrfToken: string) => request<T>("POST", path, { body: form, csrfToken }),
```

Add `AttachmentPanel` with labelled file input, list, upload, download and delete actions. Use a temporary object URL for download and revoke it. Render `<AttachmentPanel clueId={clue.id} csrfToken={csrfToken} />` in `ClueDetailPage`. Add a browser flow that uploads and deletes one text file.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- tests/integration/admin-workflows.test.ts && npm run e2e -- --grep "attachment"`

Expected: PASS; D1 metadata and the R2 object are both created and removed in the correct paths.

Commit: `git add server/modules/attachments/attachments.routes.ts server/app.ts src/lib/api.ts src/features/clues/AttachmentPanel.tsx src/features/clues/ClueDetailPage.tsx tests/integration/admin-workflows.test.ts tests/e2e/app.spec.ts && git commit -m "feat: manage clue attachments from the application"`

### Task 4: Audit recovery and release

**Files:** `server/modules/admin/admin.routes.ts`, `tests/integration/admin-workflows.test.ts`, `tests/e2e/app.spec.ts`.

- [ ] **Step 1: Write a red recovery audit test**

```ts
it("restores an allowed record and records the recovery", async () => {
  const clue = await createClue("Recoverable clue");
  await env.DB.prepare("UPDATE clues SET deleted_at = ?, deleted_by = ? WHERE id = ?").bind(now, "seed", clue.id).run();
  expect((await request("POST", `/api/admin/deleted-records/clues/${clue.id}/restore`, {})).status).toBe(200);
  expect(await env.DB.prepare("SELECT action FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1").bind(clue.id).first()).toMatchObject({ action: "admin:record:restore" });
});
```

- [ ] **Step 2: Implement conditional restore and audit it**

```ts
const result = await execute(db, `UPDATE ${entityType} SET deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NOT NULL`, now, user.id, entityId);
if (!result.meta.changes) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "已删除记录不存在", requestId: c.get("requestId") } }, 404);
await writeAuditLog(db, { actorId: user.id, action: "admin:record:restore", entityType, entityId, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: {} });
```

- [ ] **Step 3: Run the release gate, push, and smoke-test production**

Run: `npm run test:run; npm run typecheck; npm run lint; npm run build; npm run e2e`

Expected: all tests pass, typecheck/build exit 0, lint exits 0 with no errors, and browser coverage includes employee editing and attachments.

Commit/push: `git add server/modules/admin/admin.routes.ts tests/integration/admin-workflows.test.ts tests/e2e/app.spec.ts && git commit -m "feat: audit administrative record recovery" && git push origin main`

After deployment, use Playwright at `https://cfzzs.custard.top` to log in as `admin`, edit an employee, upload/delete one attachment and restore a supported record. Confirm no browser console errors. Do not change Cloudflare, DNS, secrets or deployment configuration.
