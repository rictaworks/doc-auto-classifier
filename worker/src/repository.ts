// D1（SQLite 方言）への問い合わせ。ファイル・タグの行はすべて session_id（タグを除く）で絞り込む。

export interface CategoryRecord {
  id: number;
  name: string;
  color_code: string;
  sort_order: number;
}

export interface FileRecord {
  id: number;
  session_id: string;
  original_name: string;
  stored_name: string;
  storage_key: string;
  file_size: number;
  mime_type: string;
  category_id: number;
  category_name: string;
  category_color_code: string;
  summary: string;
  uploaded_at: string;
  updated_at: string;
}

export interface TagRecord {
  id: number;
  name: string;
}

export interface TagRowWithFile extends TagRecord {
  file_id: number;
}

export interface NewFileRow {
  sessionId: string;
  originalName: string;
  storedName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  categoryId: number;
  summary: string;
  nowIso: string;
}

export interface FileFilter {
  sessionId: string;
  query: string;
  categoryId: number | null;
  tag: string;
}

const FILE_SELECT = `
  SELECT f.id, f.session_id, f.original_name, f.stored_name, f.storage_key, f.file_size,
         f.mime_type, f.category_id, c.name AS category_name, c.color_code AS category_color_code,
         f.summary, f.uploaded_at, f.updated_at
  FROM files f
  JOIN categories c ON c.id = f.category_id`;

export async function listCategories(db: D1Database): Promise<CategoryRecord[]> {
  const { results } = await db
    .prepare("SELECT id, name, color_code, sort_order FROM categories ORDER BY sort_order ASC, id ASC")
    .all<CategoryRecord>();
  return results;
}

export async function findCategoryIdByName(db: D1Database, name: string): Promise<number | null> {
  const row = await db.prepare("SELECT id FROM categories WHERE name = ?").bind(name).first<{ id: number }>();
  return row === null ? null : row.id;
}

export async function categoryExists(db: D1Database, categoryId: number): Promise<boolean> {
  const row = await db.prepare("SELECT id FROM categories WHERE id = ?").bind(categoryId).first<{ id: number }>();
  return row !== null;
}

export async function storedNameExists(db: D1Database, storedName: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM files WHERE stored_name = ? LIMIT 1")
    .bind(storedName)
    .first<{ id: number }>();
  return row !== null;
}

export async function insertFile(db: D1Database, row: NewFileRow): Promise<number> {
  const inserted = await db
    .prepare(
      `INSERT INTO files (session_id, original_name, stored_name, storage_key, file_size, mime_type,
                          category_id, summary, uploaded_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .bind(
      row.sessionId,
      row.originalName,
      row.storedName,
      row.storageKey,
      row.fileSize,
      row.mimeType,
      row.categoryId,
      row.summary,
      row.nowIso,
      row.nowIso
    )
    .first<{ id: number }>();
  if (inserted === null) {
    throw new Error("INSERT INTO files returned no row id");
  }
  return inserted.id;
}

export async function findFileForSession(
  db: D1Database,
  sessionId: string,
  fileId: number
): Promise<FileRecord | null> {
  return db
    .prepare(`${FILE_SELECT} WHERE f.id = ? AND f.session_id = ?`)
    .bind(fileId, sessionId)
    .first<FileRecord>();
}

export async function countFiles(db: D1Database, filter: FileFilter): Promise<number> {
  const where = buildWhereClause(filter);
  const row = await db
    .prepare(`SELECT COUNT(*) AS total FROM files f WHERE ${where.sql}`)
    .bind(...where.params)
    .first<{ total: number }>();
  return row === null ? 0 : row.total;
}

export async function listFilePage(
  db: D1Database,
  filter: FileFilter,
  limit: number,
  offset: number
): Promise<FileRecord[]> {
  const where = buildWhereClause(filter);
  const { results } = await db
    .prepare(`${FILE_SELECT} WHERE ${where.sql} ORDER BY f.uploaded_at DESC, f.id DESC LIMIT ? OFFSET ?`)
    .bind(...where.params, limit, offset)
    .all<FileRecord>();
  return results;
}

export async function tagsForFiles(db: D1Database, fileIds: readonly number[]): Promise<TagRowWithFile[]> {
  if (fileIds.length === 0) {
    return [];
  }
  const placeholders = fileIds.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT ft.file_id, t.id, t.name
       FROM file_tags ft
       JOIN tags t ON t.id = ft.tag_id
       WHERE ft.file_id IN (${placeholders})
       ORDER BY t.id ASC`
    )
    .bind(...fileIds)
    .all<TagRowWithFile>();
  return results;
}

export async function updateFileCategory(
  db: D1Database,
  sessionId: string,
  fileId: number,
  categoryId: number,
  nowIso: string
): Promise<void> {
  await db
    .prepare("UPDATE files SET category_id = ?, updated_at = ? WHERE id = ? AND session_id = ?")
    .bind(categoryId, nowIso, fileId, sessionId)
    .run();
}

// タグ名は全セッション共通の行として扱う（旧版と同じ。ユニーク制約も旧版と同じ）
export async function linkTag(db: D1Database, fileId: number, tagName: string, nowIso: string): Promise<void> {
  await db
    .prepare("INSERT INTO tags (name, created_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING")
    .bind(tagName, nowIso)
    .run();
  const tag = await db.prepare("SELECT id FROM tags WHERE name = ?").bind(tagName).first<{ id: number }>();
  if (tag === null) {
    throw new Error(`tags row not found after upsert: ${tagName}`);
  }
  await db
    .prepare("INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?) ON CONFLICT(file_id, tag_id) DO NOTHING")
    .bind(fileId, tag.id)
    .run();
}

export async function unlinkTag(db: D1Database, fileId: number, tagName: string): Promise<void> {
  await db
    .prepare("DELETE FROM file_tags WHERE file_id = ? AND tag_id IN (SELECT id FROM tags WHERE name = ?)")
    .bind(fileId, tagName)
    .run();
}

export async function deleteFileRecord(db: D1Database, sessionId: string, fileId: number): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM file_tags WHERE file_id = ?").bind(fileId),
    db.prepare("DELETE FROM files WHERE id = ? AND session_id = ?").bind(fileId, sessionId)
  ]);
}

// 日次リセット用。カテゴリマスタは残す。
export async function deleteAllFileRecords(db: D1Database): Promise<number> {
  const results = await db.batch([
    db.prepare("DELETE FROM file_tags"),
    db.prepare("DELETE FROM files"),
    db.prepare("DELETE FROM tags")
  ]);
  const deletedFiles = results[1];
  return deletedFiles === undefined ? 0 : deletedFiles.meta.changes;
}

function buildWhereClause(filter: FileFilter): { sql: string; params: (string | number)[] } {
  const clauses = ["f.session_id = ?"];
  const params: (string | number)[] = [filter.sessionId];

  if (filter.query !== "") {
    clauses.push("f.original_name LIKE ? ESCAPE '\\'");
    params.push(likePattern(filter.query));
  }
  if (filter.categoryId !== null) {
    clauses.push("f.category_id = ?");
    params.push(filter.categoryId);
  }
  if (filter.tag !== "") {
    // JOIN ではなく EXISTS にして、一致するタグ数だけ件数が増える（重複）のを防ぐ
    clauses.push(
      "EXISTS (SELECT 1 FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.file_id = f.id AND t.name LIKE ? ESCAPE '\\')"
    );
    params.push(likePattern(filter.tag));
  }

  return { sql: clauses.join(" AND "), params };
}

function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}
