// @ts-nocheck
/* eslint-disable */
import { MiddlewareHandler } from "hono";
import { buildAccessContext, hasPermission } from "../modules/access/access.service";

/**
 * Middleware factory that requires a specific permission code.
 */
export function requirePermissionCode(code: string): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        ok: false,
        error: { code: "NOT_AUTHENTICATED", message: "未登录", requestId: c.get("requestId") },
      }, 401);
    }

    const access = await buildAccessContext(c.env.DB, user.id);
    if (!hasPermission(access, code)) {
      return c.json({
        ok: false,
        error: { code: "FORBIDDEN", message: "没有操作权限", requestId: c.get("requestId") },
      }, 403);
    }

    c.set("access", access);
    await next();
  };
}



