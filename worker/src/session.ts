import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./config/constants";
import { parseAppEnvironment } from "./env";
import type { AppBindings } from "./types";

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 匿名のオーナーキー。Cookie が無い・形式が不正な場合は新しく発行する（旧版 get_session_id と同じ）。
export const sessionMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const existing = getCookie(c, SESSION_COOKIE_NAME);
  if (existing !== undefined && SESSION_ID_PATTERN.test(existing)) {
    c.set("sessionId", existing);
  } else {
    const sessionId = crypto.randomUUID();
    setCookie(c, SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: parseAppEnvironment(c.env.APP_ENV) === "production"
    });
    c.set("sessionId", sessionId);
  }
  await next();
});
