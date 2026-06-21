# Single-admin business handover design

## Decision

The application has one system-management account: the existing `admin` user.
It is the sole account allowed to enter `/admin` and use system-management
APIs. Its current password remains unchanged by this work at the user's
direction. Cloudflare, DNS, deployments, secrets, D1 administration and R2
configuration remain outside the application and are operated by the owner.

Ordinary employee accounts remain supported. They can use business functions
according to assigned roles and data scopes, but never enter system management.

## Scope

The `admin` user must be able to manage all in-application operational data:

- employee accounts: create, edit profile fields, department, business roles,
  enable or disable, and reset an employee password;
- role permissions and data scopes, departments, dictionaries, and park /
  building / floor hierarchy;
- clues, contacts, follow-ups, space matching, import, export approval,
  reports, audit logs and recovery of supported soft-deleted records;
- public in-app site settings and attachment lifecycle (upload, list, download
  and delete) through the configured storage binding.

This does not create a general-purpose CMS, deployment panel, raw database
editor or Cloudflare control panel.

## Access model

1. A server-side singleton-admin policy permits system-management access only
   when the authenticated user is the existing super-admin account. Creation or
   update APIs cannot create another super-admin.
2. The session response exposes an explicit `canManageSystem` flag. The router
   and navigation use that same flag as the server, eliminating the current
   role-permission versus frontend mismatch.
3. Normal roles continue to control business permissions and data scopes. The
   `system:admin:access` permission is not a route to `/admin` for employees.
4. All mutations require the existing CSRF protection and create audit events.
   Disabling an employee revokes their active sessions.

## User-management flow

The user list returns each employee's assigned role IDs. The edit dialog loads
those roles and updates employee fields and role assignments atomically. The
server validates each referenced role, replaces the assignment set in a
transaction-like D1 batch, revokes sessions on disable or password reset, and
writes one audit record. The `admin` user cannot be disabled or demoted through
the application.

## Attachment and recovery flow

Attachments are tied to their business record and authorized through the
record's existing read/write access checks. Upload validates type and size,
stores bytes under a generated R2 key, then creates the D1 metadata row. A
failed metadata write cleans up the object. Downloads authorize before reading;
deletion removes metadata and object while recording an audit entry.

The recovery screen is limited to the explicitly supported soft-deleted
business entities. It never exposes arbitrary-table SQL or Cloudflare/D1
backups.

## Error handling

The UI presents actionable errors for duplicate accounts, invalid role IDs,
unauthorized attachment access and failed uploads. The API returns no storage
credentials, raw R2 keys beyond authorized metadata, or platform configuration.

## Verification

Automated tests will prove that:

- a normal employee cannot see or request `/admin`, even if their role contains
  the legacy system-admin permission;
- a second super-admin cannot be created or promoted;
- the admin can create, edit, re-role, disable and reset an employee, and a
  disabled/reset employee loses existing sessions;
- attachment authorization and cleanup work on success and failure paths;
- supported records can be recovered and unsupported tables are rejected.

The full unit, integration, typecheck, build and Playwright browser suites will
run before deployment. Production smoke tests will cover admin login, employee
editing, attachment management and recovery without changing Cloudflare
configuration.
