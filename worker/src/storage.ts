import { FILE_KEY_PREFIX } from "./config/constants";

// アップロードされたファイルの実体を置く場所。D1 の 1 行サイズ上限（10MB 未満）を超えるため R2 を使う。
export interface FileStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<number>;
}

export function buildObjectKey(sessionId: string): string {
  return `${FILE_KEY_PREFIX}${sessionId}/${crypto.randomUUID()}`;
}

export function createR2FileStorage(bucket: R2Bucket): FileStorage {
  return {
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } });
    },
    async get(key) {
      const object = await bucket.get(key);
      return object === null ? null : object.body;
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async deleteByPrefix(prefix) {
      let deleted = 0;
      let cursor: string | undefined;
      do {
        const listing = await bucket.list({ prefix, cursor });
        const keys = listing.objects.map((object) => object.key);
        if (keys.length > 0) {
          await bucket.delete(keys);
          deleted += keys.length;
        }
        cursor = listing.truncated ? listing.cursor : undefined;
      } while (cursor !== undefined);
      return deleted;
    }
  };
}
