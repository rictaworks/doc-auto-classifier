import { FILE_KEY_PREFIX } from "./config/constants";
import type { Env } from "./env";
import { logError, logInfo } from "./logger";
import { deleteAllFileRecords } from "./repository";
import { createR2FileStorage } from "./storage";

// 旧版の APScheduler 日次リセット（JST 03:00）と同じ。DB の記録を消し、R2 の実体も掃除する。
// 先に DB を消すので、途中で R2 の掃除が失敗しても一覧には残らない。残った実体は翌日の掃除で消える。
export async function runDailyReset(env: Env): Promise<void> {
  try {
    const deletedFiles = await deleteAllFileRecords(env.DB);
    const deletedObjects = await createR2FileStorage(env.FILES).deleteByPrefix(FILE_KEY_PREFIX);
    logInfo("reset.completed", { deletedFiles, deletedObjects });
  } catch (error) {
    logError("reset.failed", error);
    throw error;
  }
}
