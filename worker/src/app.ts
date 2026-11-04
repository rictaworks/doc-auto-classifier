import { Hono } from "hono";
import { MESSAGES } from "./config/messages";
import { HttpError } from "./errors";
import { logError } from "./logger";
import { createCategoriesRouter } from "./routes/categories";
import { createFilesRouter } from "./routes/files";
import type { AppBindings } from "./types";

export function createApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  });

  app.onError((error, c) => {
    const requestId = c.get("requestId");
    c.header("X-Request-Id", requestId);
    if (error instanceof HttpError) {
      return c.json({ detail: error.detail }, error.status);
    }
    logError("request.unhandled", error, { requestId, method: c.req.method, path: c.req.path });
    return c.json({ detail: MESSAGES.internalError, request_id: requestId }, 500);
  });

  app.notFound((c) => c.json({ detail: MESSAGES.notFound }, 404));

  app.route("/api/files", createFilesRouter());
  app.route("/api/categories", createCategoriesRouter());

  return app;
}
