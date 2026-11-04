export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// multipart の境界線と hp_field などの項目分のゆとり。これを超えるリクエストは formData() を読む前に拒否する。
export const MAX_REQUEST_BYTES = MAX_FILE_SIZE_BYTES + 64 * 1024;

export const ALLOWED_EXTENSIONS: readonly string[] = [".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg"];

export const TEXT_EXTENSIONS: readonly string[] = [".txt", ".md"];

export const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

// 先頭バイト列で拡張子と中身の一致を確認する（テキスト系は確認しない）
export const MAGIC_BYTES: Readonly<Record<string, readonly (readonly number[])[]>> = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46]],
  ".png": [[0x89, 0x50, 0x4e, 0x47]],
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]]
};

export const PAGE_SIZE = 20;
export const CLASSIFIER_CONTENT_MAX_CHARS = 500;
export const SUMMARY_MAX_CHARS = 200;
export const DEFAULT_CATEGORY_NAME = "その他";

export const SESSION_COOKIE_NAME = "doc_sid";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const FILE_KEY_PREFIX = "files/";
