import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "../features/auth/auth.api";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function AuthGuard({ children, requireAdmin }: AuthGuardProps) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getSession()
      .then((session) => {
        if (session) {
          setIsAdmin(session.user.isSuperAdmin);
          setState("authenticated");
        } else {
          setState("unauthenticated");
        }
      })
      .catch(() => setState("unauthenticated"));
  }, [location.pathname]);

  if (state === "loading") {
    return (
      <div className="loading-screen" role="status">
        <div className="spinner" />
        <span>加载中...</span>
      </div>
    );
  }

  if (state === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function useAuthGuard() {
  const [session, setSession] = useState<{ user: { id: string; displayName: string; isSuperAdmin: boolean; departmentId: string | null } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return { session, loading };
}
