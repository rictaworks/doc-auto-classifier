// 1 行 1 JSON で出力する（Cloudflare の Workers Logs で項目検索できるようにするため）。
// requestId は応答ヘッダ X-Request-Id と同じ値で、障害時にログと応答を突き合わせるために使う。
// sessionId は認証に使う値なので、ログには出さず sessionLogId（SHA-256 の先頭 8 バイト）に置き換える。
export async function sessionLogId(sessionId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return Array.from(new Uint8Array(digest).subarray(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level: "info", event, ts: new Date().toISOString(), ...fields }));
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  const detail =
    error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
  console.error(
    JSON.stringify({ level: "error", event, ts: new Date().toISOString(), ...fields, error: detail })
  );
}
