import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/auth.api";
import { useAuth } from "../features/auth/auth.store";

const navItems = [
  { label: "首页看板", path: "/", icon: "📊" },
  { label: "招商线索", path: "/clues", icon: "📋" },
  { label: "未分配线索", path: "/unassigned", icon: "📥" },
  { label: "空间资源", path: "/spaces", icon: "🏢" },
  { label: "跟进提醒", path: "/reminders", icon: "🔔" },
  { label: "数据报表", path: "/reports", icon: "📈" },
  { label: "数据导入", path: "/imports", icon: "📤" },
  { label: "导出管理", path: "/exports", icon: "📎" },
  { label: "个人设置", path: "/profile", icon: "👤" },
];

export default function AppShell() {
  const { user, csrfToken, clearSession } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout(csrfToken);
    } catch { /* ignore */ }
    clearSession();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>ZJDCRM</h2>
          <span className="sidebar-subtitle">招商线索管理</span>
        </div>
        <nav className="sidebar-nav" role="navigation" aria-label="主导航">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {user?.isSuperAdmin && (
          <div className="sidebar-admin-link">
            <NavLink to="/admin" className="nav-item">
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">系统管理</span>
            </NavLink>
          </div>
        )}
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.displayName || "用户"}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            退出
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
