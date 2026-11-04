import { Hono } from "hono";
import { MAX_REQUEST_BYTES } from "../config/constants";
import { MESSAGES } from "../config/messages";
import { badRequest, payloadTooLarge } from "../errors";
import {
  addTagToFile,
  buildAttachmentDisposition,
  deleteFile,
  listFileItems,
  openFileForDownload,
  removeTagFromFile,
  updateFileCategory,
  uploadFile,
  type UploadInput
} from "../fileService";
import { parseOptionalCategoryId, parsePage, parseResourceId } from "../validation";
import { sessionMiddleware } from "../session";
import type { AppBindings } from "../types";
import { readJsonObject, serviceContext } from "./shared";

export function createFilesRouter(): Hono<AppBindings> {
  const router = new Hono<AppBindings>();
  router.use("*", sessionMiddleware);

  router.post("/upload", async (c) => {
    const input = await readUploadForm(c.req.raw);
    const item = await uploadFile(serviceContext(c.env), c.get("sessionId"), input);
    return c.json(item);
  });

  router.get("/", async (c) => {
    const result = await listFileItems(c.env.DB, c.get("sessionId"), {
      query: c.req.query("query") ?? "",
      categoryId: parseOptionalCategoryId(c.req.query("category_id")),
      tag: c.req.query("tag") ?? "",
      page: parsePage(c.req.query("page"))
    });
    return c.json(result);
  });

  router.patch("/:id/category", async (c) => {
    const fileId = parseResourceId(c.req.param("id"));
    const body = await readJsonObject(c.req.raw);
    const categoryId = body["category_id"];
    if (typeof categoryId !== "number" || !Number.isSafeInteger(categoryId)) {
      throw badRequest(MESSAGES.categoryIdInvalid);
    }
    const item = await updateFileCategory(c.env.DB, c.get("sessionId"), fileId, categoryId);
    return c.json(item);
  });

  router.post("/:id/tags", async (c) => {
    const fileId = parseResourceId(c.req.param("id"));
    const body = await readJsonObject(c.req.raw);
    const name = body["name"];
    if (typeof name !== "string") {
      throw badRequest(MESSAGES.tagNameRequired);
    }
    const item = await addTagToFile(c.env.DB, c.get("sessionId"), fileId, name);
    return c.json(item);
  });

  router.delete("/:id/tags/:tagName", async (c) => {
    const fileId = parseResourceId(c.req.param("id"));
    const item = await removeTagFromFile(c.env.DB, c.get("sessionId"), fileId, c.req.param("tagName"));
    return c.json(item);
  });

  router.get("/:id/download", async (c) => {
    const fileId = parseResourceId(c.req.param("id"));
    const download = await openFileForDownload(serviceContext(c.env), c.get("sessionId"), fileId);
    return new Response(download.body, {
      status: 200,
      headers: {
        "Content-Type": download.mimeType,
        "Content-Length": String(download.fileSize),
        "Content-Disposition": buildAttachmentDisposition(download.originalName),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store"
      }
    });
  });

  router.delete("/:id", async (c) => {
    const fileId = parseResourceId(c.req.param("id"));
    await deleteFile(serviceContext(c.env), c.get("sessionId"), fileId);
    return c.json({ ok: true });
  });

  return router;
}

async function readUploadForm(request: Request): Promise<UploadInput> {
  // 本体を読む前に宣言された長さで弾く（大きすぎる body を丸ごとメモリに載せない）
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      throw badRequest(MESSAGES.badRequest);
    }
    if (Number(declaredLength) > MAX_REQUEST_BYTES) {
      throw payloadTooLarge(MESSAGES.fileTooLarge);
    }
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest(MESSAGES.fileMissing);
  }
  const file = form.get("file");
  const hpValue = form.get("hp_field");
  return {
    file: file instanceof File ? file : null,
    hpField: hpValue === null ? "" : String(hpValue)
  };
}
