// テスト専用の R2 互換バケット。本体の storage.ts が使う put/get/delete/list だけを持つ。
export interface MemoryObject {
  bytes: Uint8Array;
  contentType: string | undefined;
}

export interface MemoryBucket {
  objects: Map<string, MemoryObject>;
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
}

export function createMemoryBucket(): MemoryBucket {
  const objects = new Map<string, MemoryObject>();
  return {
    objects,
    async put(key, value, options) {
      objects.set(key, { bytes: new Uint8Array(value), contentType: options?.httpMetadata?.contentType });
    },
    async get(key) {
      const entry = objects.get(key);
      if (entry === undefined) {
        return null;
      }
      return { body: new Response(entry.bytes).body as ReadableStream, size: entry.bytes.byteLength };
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        objects.delete(key);
      }
    },
    async list(options) {
      const prefix = options?.prefix ?? "";
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      return { objects: keys.map((key) => ({ key })), truncated: false };
    }
  };
}
