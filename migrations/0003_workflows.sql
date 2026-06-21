CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  actor_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  read_at TEXT,
  read_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  job_type TEXT NOT NULL,
  source_file_name TEXT,
  template_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  success_rows INTEGER NOT NULL DEFAULT 0 CHECK (success_rows >= 0),
  failed_rows INTEGER NOT NULL DEFAULT 0 CHECK (failed_rows >= 0),
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE import_job_rows (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  row_number INTEGER NOT NULL CHECK (row_number >= 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  error_message TEXT,
  source_payload_json TEXT,
  normalized_payload_json TEXT,
  duplicate_of_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE export_requests (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'generating', 'ready', 'expired')),
  approved_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  approved_at TEXT,
  rejected_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  rejected_at TEXT,
  rejection_reason TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE export_files (
  id TEXT PRIMARY KEY,
  export_request_id TEXT NOT NULL REFERENCES export_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  downloaded_at TEXT,
  downloaded_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'downloaded', 'expired', 'deleted')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE backup_records (
  id TEXT PRIMARY KEY,
  backup_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'restored')),
  storage_key TEXT,
  file_name TEXT,
  file_size INTEGER CHECK (file_size IS NULL OR file_size >= 0),
  started_at TEXT,
  completed_at TEXT,
  restored_at TEXT,
  restore_notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
