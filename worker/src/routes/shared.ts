import type { Env } from "../env";
import { MESSAGES } from "../config/messages";
import { badRequest } from "../errors";
import type { FileServiceContext } from "../fileService";
import { createR2FileStorage } from "../storage";

export function serviceContext(env: Env): FileServiceContext {
  return { db: env.DB, storage: createR2FileStorage(env.FILES) };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw badRequest(MESSAGES.jsonInvalid);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw badRequest(MESSAGES.jsonInvalid);
  }
  return parsed as Record<string, unknown>;
}
