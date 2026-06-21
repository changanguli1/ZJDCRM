import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/auth.api";
import { useAuth } from "../features/auth/auth.store";
import { useSiteSettings } from "../lib/site-settings";

const adminNavItems = [
  { label: "后台首页", path: "/admin", icon: "📊", end: true },
  { label: "员工管理", path: "/admin/users", icon: "👥" },
  { label: "部门管理", path: "/admin/departments", icon: "🏛️" },
  { label: "角色权限", path: "/admin/roles", icon: "🔐" },
  { label: "字典配置", path: "/admin/dictionaries", icon: "📚" },
  { label: "空间管理", path: "/admin/spaces", icon: "🏢" },
  { label: "导入任务", path: "/admin/imports", icon: "📤" },
  { label: "导出审批", path: "/admin/exports", icon: "📎" },
  { label: "审计日志", path: "/admin/audit", icon: "📝" },
  { label: "系统设置", path: "/admin/settings", icon: "⚙️" },
  { label: "数据恢复", path: "/admin/deleted", icon: "♻️" },
];

export default function AdminShell() {
  const { user, csrfToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const settings = useSiteSettings();

  const handleLogout = async () => {
    try { await logout(csrfToken); } catch { /* ignore */ }
    clearSession();
    navigate("/login");
  };

  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>系统管理</h2>
          <span className="sidebar-subtitle">{settings.site_name || "ZJDCRM"} 后台</span>
        </div>
        <nav className="sidebar-nav" role="navigation" aria-label="管理导航">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-return-link">
          <NavLink to="/" className="nav-item">
            <span className="nav-icon">←</span>
            <span className="nav-label">返回业务端</span>
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.displayName || "管理员"}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>退出</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
