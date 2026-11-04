import { MAGIC_BYTES } from "./config/constants";
import { MESSAGES } from "./config/messages";
import { badRequest, notFound } from "./errors";

export function hasMagicBytes(data: Uint8Array, suffix: string): boolean {
  const signatures = MAGIC_BYTES[suffix];
  if (signatures === undefined) {
    return true;
  }
  return signatures.some((signature) => signature.every((byte, index) => data[index] === byte));
}

export function parsePage(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    return 1;
  }
  const page = parseDecimal(raw);
  if (page === null || page < 1) {
    throw badRequest(MESSAGES.pageInvalid);
  }
  return page;
}

export function parseOptionalCategoryId(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") {
    return null;
  }
  const categoryId = parseDecimal(raw);
  if (categoryId === null) {
    throw badRequest(MESSAGES.categoryIdInvalid);
  }
  return categoryId;
}

// パスの ID が不正な形式の場合は「存在しない」として扱う（該当ファイルは必ず無いため）
export function parseResourceId(raw: string): number {
  const id = parseDecimal(raw);
  if (id === null || id < 1) {
    throw notFound(MESSAGES.fileNotFound);
  }
  return id;
}

function parseDecimal(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
