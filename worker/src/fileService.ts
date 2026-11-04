import { classify } from "./classifier";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MIME_BY_EXTENSION,
  PAGE_SIZE,
  SUMMARY_MAX_CHARS,
  TEXT_EXTENSIONS
} from "./config/constants";
import { MESSAGES } from "./config/messages";
import { badRequest, notFound } from "./errors";
import { logError, logInfo, sessionLogId } from "./logger";
import * as repo from "./repository";
import { firstCodePoints, sanitizeStem, splitFilename } from "./text";
import { buildObjectKey, type FileStorage } from "./storage";
import { hasMagicBytes } from "./validation";

export interface FileServiceContext {
  db: D1Database;
  storage: FileStorage;
}

export interface UploadInput {
  file: File | null;
  hpField: string;
}

export interface FileItem {
  id: number;
  original_name: string;
  stored_name: string;
  file_size: number;
  mime_type: string;
  summary: string;
  uploaded_at: string;
  updated_at: string;
  category: { id: number; name: string; color_code: string };
  tags: { id: number; name: string }[];
}

export interface FileListInput {
  query: string;
  categoryId: number | null;
  tag: string;
  page: number;
}

export interface FileListResult {
  total: number;
  page: number;
  page_size: number;
  items: FileItem[];
}

export async function uploadFile(
  ctx: FileServiceContext,
  sessionId: string,
  input: UploadInput
): Promise<FileItem> {
  // ハニーポット: 隠し欄に値が入っていれば bot とみなして 400 で拒否する（旧版と同じ）
  if (input.hpField !== "") {
    throw badRequest(MESSAGES.badRequest);
  }
  const file = input.file;
  if (file === null) {
    throw badRequest(MESSAGES.fileMissing);
  }
  if (file.name === "") {
    throw badRequest(MESSAGES.fileNameMissing);
  }
  if (file.size === 0) {
    throw badRequest(MESSAGES.fileEmpty);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw badRequest(MESSAGES.fileTooLarge);
  }

  const { stem, suffix: originalSuffix } = splitFilename(file.name);
  const suffix = originalSuffix.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(suffix)) {
    throw badRequest(`${MESSAGES.extensionNotAllowed}: ${suffix}`);
  }

  const data = new Uint8Array(await file.arrayBuffer());
  if (!hasMagicBytes(data, suffix)) {
    logInfo("upload.rejected_magic", { session: await sessionLogId(sessionId), suffix, size: data.byteLength });
    throw badRequest(MESSAGES.magicMismatch);
  }

  const textContent = TEXT_EXTENSIONS.includes(suffix) ? new TextDecoder("utf-8").decode(data) : "";
  const categoryName = classify(file.name, textContent);
  const categoryId = await requireCategoryId(ctx.db, categoryName);

  const mimeType = MIME_BY_EXTENSION[suffix];
  if (mimeType === undefined) {
    throw new Error(`MIME type is not defined for allowed extension: ${suffix}`);
  }

  const storedName = await uniqueStoredName(ctx.db, stem, originalSuffix);
  const storageKey = buildObjectKey(sessionId);
  await ctx.storage.put(storageKey, data, mimeType);

  let fileId: number;
  try {
    fileId = await repo.insertFile(ctx.db, {
      sessionId,
      originalName: file.name,
      storedName,
      storageKey,
      fileSize: data.byteLength,
      mimeType,
      categoryId,
      summary: firstCodePoints(textContent, SUMMARY_MAX_CHARS),
      nowIso: new Date().toISOString()
    });
  } catch (error) {
    // DB に行が無いまま実体だけ残らないよう、実体を取り消してから元の例外を投げ直す
    logError("upload.db_insert_failed", error, { session: await sessionLogId(sessionId) });
    await ctx.storage.delete(storageKey);
    throw error;
  }

  logInfo("upload.stored", { session: await sessionLogId(sessionId), fileId, categoryName, size: data.byteLength });
  return requireFileItem(ctx.db, sessionId, fileId);
}

export async function listFileItems(
  db: D1Database,
  sessionId: string,
  input: FileListInput
): Promise<FileListResult> {
  const filter = { sessionId, query: input.query, categoryId: input.categoryId, tag: input.tag };
  const total = await repo.countFiles(db, filter);
  const rows = await repo.listFilePage(db, filter, PAGE_SIZE, (input.page - 1) * PAGE_SIZE);
  const tagRows = await repo.tagsForFiles(
    db,
    rows.map((row) => row.id)
  );
  const items = rows.map((row) =>
    toFileItem(
      row,
      tagRows.filter((tag) => tag.file_id === row.id).map((tag) => ({ id: tag.id, name: tag.name }))
    )
  );
  return { total, page: input.page, page_size: PAGE_SIZE, items };
}

export async function updateFileCategory(
  db: D1Database,
  sessionId: string,
  fileId: number,
  categoryId: number
): Promise<FileItem> {
  await requireFileRecord(db, sessionId, fileId);
  if (!(await repo.categoryExists(db, categoryId))) {
    throw badRequest(MESSAGES.categoryNotFound);
  }
  await repo.updateFileCategory(db, sessionId, fileId, categoryId, new Date().toISOString());
  return requireFileItem(db, sessionId, fileId);
}

export async function addTagToFile(
  db: D1Database,
  sessionId: string,
  fileId: number,
  rawName: string
): Promise<FileItem> {
  const name = rawName.trim();
  if (name === "") {
    throw badRequest(MESSAGES.tagNameRequired);
  }
  await requireFileRecord(db, sessionId, fileId);
  await repo.linkTag(db, fileId, name, new Date().toISOString());
  return requireFileItem(db, sessionId, fileId);
}

export async function removeTagFromFile(
  db: D1Database,
  sessionId: string,
  fileId: number,
  tagName: string
): Promise<FileItem> {
  await requireFileRecord(db, sessionId, fileId);
  await repo.unlinkTag(db, fileId, tagName);
  return requireFileItem(db, sessionId, fileId);
}

export async function deleteFile(ctx: FileServiceContext, sessionId: string, fileId: number): Promise<void> {
  const record = await requireFileRecord(ctx.db, sessionId, fileId);
  // DB の行を先に消す。実体の削除に失敗しても一覧からは消えており、残った実体は日次リセットの掃除で消える。
  await repo.deleteFileRecord(ctx.db, sessionId, fileId);
  await ctx.storage.delete(record.storage_key);
  logInfo("file.deleted", { session: await sessionLogId(sessionId), fileId });
}

export interface DownloadResult {
  body: ReadableStream;
  mimeType: string;
  originalName: string;
  fileSize: number;
}

export async function openFileForDownload(
  ctx: FileServiceContext,
  sessionId: string,
  fileId: number
): Promise<DownloadResult> {
  const record = await requireFileRecord(ctx.db, sessionId, fileId);
  const body = await ctx.storage.get(record.storage_key);
  if (body === null) {
    logError("download.storage_missing", new Error("R2 object not found"), {
      session: await sessionLogId(sessionId),
      fileId
    });
    throw notFound(MESSAGES.storageMissing);
  }
  return {
    body,
    mimeType: record.mime_type,
    originalName: record.original_name,
    fileSize: record.file_size
  };
}

// ダウンロードのファイル名は UTF-8 を RFC 5987 で、ASCII 版を filename で併記する
export function buildAttachmentDisposition(originalName: string): string {
  const asciiFallback = originalName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(originalName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

async function requireCategoryId(db: D1Database, categoryName: string): Promise<number> {
  const categoryId = await repo.findCategoryIdByName(db, categoryName);
  if (categoryId !== null) {
    return categoryId;
  }
  // 分類器の出力はマスタに無い名前を返さない前提。欠けていればマイグレーションの不整合なので例外にする。
  throw new Error(`${MESSAGES.categoryMasterMissing}: ${categoryName}`);
}

async function uniqueStoredName(db: D1Database, stem: string, suffix: string): Promise<string> {
  const safeStem = sanitizeStem(stem);
  const name = `${safeStem}${suffix}`;
  if (!(await repo.storedNameExists(db, name))) {
    return name;
  }
  const timestamp = new Date().toISOString().replace(/\D/g, "");
  return `${safeStem}_${timestamp}${suffix}`;
}

async function requireFileRecord(db: D1Database, sessionId: string, fileId: number): Promise<repo.FileRecord> {
  const record = await repo.findFileForSession(db, sessionId, fileId);
  if (record === null) {
    throw notFound(MESSAGES.fileNotFound);
  }
  return record;
}

async function requireFileItem(db: D1Database, sessionId: string, fileId: number): Promise<FileItem> {
  const record = await repo.findFileForSession(db, sessionId, fileId);
  if (record === null) {
    throw new Error(`file row not readable right after write: file_id=${fileId}`);
  }
  const tagRows = await repo.tagsForFiles(db, [fileId]);
  return toFileItem(
    record,
    tagRows.map((tag) => ({ id: tag.id, name: tag.name }))
  );
}

function toFileItem(row: repo.FileRecord, tags: { id: number; name: string }[]): FileItem {
  return {
    id: row.id,
    original_name: row.original_name,
    stored_name: row.stored_name,
    file_size: row.file_size,
    mime_type: row.mime_type,
    summary: row.summary,
    uploaded_at: row.uploaded_at,
    updated_at: row.updated_at,
    category: {
      id: row.category_id,
      name: row.category_name,
      color_code: row.category_color_code
    },
    tags
  };
}
