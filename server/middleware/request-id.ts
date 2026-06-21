// @ts-nocheck
/* eslint-disable */
import { MiddlewareHandler } from "hono";
import { createId } from "../shared/ids";

/**
 * Add a unique request ID to every request and response.
 */
export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = createId();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
};



