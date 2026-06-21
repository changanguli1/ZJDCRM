CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('menu', 'action')),
  route_path TEXT,
  action_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  normalized_account TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 1),
  mobile TEXT,
  email TEXT,
  department_id TEXT REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  is_super_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_super_admin IN (0, 1)),
  failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until TEXT,
  password_changed_at TEXT,
  last_login_at TEXT,
  last_login_ip TEXT,
  last_login_user_agent TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  role_id TEXT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  granted_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  granted_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  granted_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  granted_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE role_data_scopes (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('self', 'team', 'all', 'department', 'custom')),
  department_id TEXT REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  scope_value TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  session_hash TEXT NOT NULL,
  csrf_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_seen_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE login_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  account TEXT NOT NULL,
  login_result TEXT NOT NULL CHECK (login_result IN ('success', 'failure', 'locked', 'logout')),
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE dictionaries (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE dictionary_items (
  id TEXT PRIMARY KEY,
  dictionary_id TEXT NOT NULL REFERENCES dictionaries(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  parent_id TEXT REFERENCES dictionary_items(id) ON UPDATE CASCADE ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE system_settings (
  id TEXT PRIMARY KEY,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  setting_type TEXT NOT NULL CHECK (setting_type IN ('text', 'number', 'boolean', 'json')),
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
