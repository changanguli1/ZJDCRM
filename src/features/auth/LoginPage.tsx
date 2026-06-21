import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./auth.api";
import { useAuth } from "./auth.store";

type LoginError = { message: string };

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account.trim() || !password) {
      setError("请输入账号和密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await login(account.trim(), password);
      setSession(data.user, data.csrfToken);
      navigate("/");
    } catch (err) {
      setError((err as LoginError).message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>ZJDCRM</h1>
          <p>产业园区招商线索管理系统</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-field">
            <label htmlFor="account">账号</label>
            <input
              id="account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="手机号 / 邮箱 / 内部账号"
              autoComplete="username"
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "登录中..." : "登 录"}
          </button>
        </form>
      </div>
    </div>
  );
}
