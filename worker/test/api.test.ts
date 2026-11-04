import { describe, expect, it } from "vitest";
import { createHarness, readJson, send, sessionIdFrom, uploadBody, type Harness } from "./helpers/harness";
import { MAX_FILE_SIZE_BYTES, MAX_REQUEST_BYTES } from "../src/config/constants";
import { MESSAGES } from "../src/config/messages";

describe("セキュリティ補強", () => {
  it("宣言された Content-Length が上限を超えたら、本体を読まずに 413 を返す", async () => {
    const h = createHarness();
    const cookie = sessionIdFrom(await send(h, "/api/files"));
    const response = await h.app.request(
      "/api/files/upload",
      {
        method: "POST",
        headers: { cookie: `doc_sid=${cookie}`, "content-length": String(MAX_REQUEST_BYTES + 1) },
        body: "x"
      },
      h.env
    );
    expect(response.status).toBe(413);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.fileTooLarge });
    expect(h.bucket.objects.size).toBe(0);
  });

  it("Content-Length が数字でなければ 400", async () => {
    const h = createHarness();
    const cookie = sessionIdFrom(await send(h, "/api/files"));
    const response = await h.app.request(
      "/api/files/upload",
      { method: "POST", headers: { cookie: `doc_sid=${cookie}`, "content-length": "abc" }, body: "x" },
      h.env
    );
    expect(response.status).toBe(400);
  });

  it("ログにセッション ID を平文で出さない", async () => {
    const h = createHarness();
    const cookie = sessionIdFrom(await send(h, "/api/files"));
    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };
    try {
      const response = await upload(h, cookie, "invoice.txt", "invoice receipt");
      expect(response.status).toBe(200);
      const file = await readJson(response);
      await send(h, `/api/files/${file["id"]}`, { method: "DELETE", cookie });
    } finally {
      console.log = originalLog;
    }
    expect(captured.length).toBeGreaterThan(0);
    expect(captured.some((line) => line.includes(cookie))).toBe(false);
    expect(captured.some((line) => line.includes("upload.stored"))).toBe(true);
  });
});

async function upload(
  h: Harness,
  cookie: string,
  name: string,
  content: ArrayBuffer | ArrayBufferView | string,
  type = "text/plain",
  hpField = ""
): Promise<Response> {
  return send(h, "/api/files/upload", {
    method: "POST",
    body: uploadBody(name, content, type, hpField),
    cookie
  });
}

async function startSession(h: Harness): Promise<string> {
  const response = await send(h, "/api/files");
  return sessionIdFrom(response);
}

async function uploadOk(h: Harness, cookie: string, name: string, content: string): Promise<Record<string, unknown>> {
  const response = await upload(h, cookie, name, content);
  expect(response.status).toBe(200);
  return readJson(response);
}

describe("POST /api/files/upload（旧版 test_api.py の移植）", () => {
  it("テキストを分類して保存し、旧版と同じ項目を返す", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await upload(h, cookie, "invoice.txt", "invoice receipt payment");
    expect(response.status).toBe(200);
    const data = await readJson(response);
    expect(data["original_name"]).toBe("invoice.txt");
    expect(data["stored_name"]).toBe("invoice.txt");
    expect(data["file_size"]).toBe(23);
    expect(data["mime_type"]).toBe("text/plain");
    expect(data["summary"]).toBe("invoice receipt payment");
    expect(data["tags"]).toEqual([]);
    expect((data["category"] as Record<string, unknown>)["name"]).toBe("請求書・領収書");
    expect((data["category"] as Record<string, unknown>)["color_code"]).toBe("#FF6B6B");
    expect(typeof data["uploaded_at"]).toBe("string");
    expect(String(data["uploaded_at"]).endsWith("Z")).toBe(true);
  });

  it("ハニーポットに値が入っていれば 400（旧版と同じ）", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await upload(h, cookie, "file.txt", "hello", "text/plain", "bot");
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.badRequest });
  });

  it("許可されていない拡張子は 400 で、拡張子を detail に含める", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await upload(h, cookie, "virus.exe", "exec", "application/octet-stream");
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ detail: `${MESSAGES.extensionNotAllowed}: .exe` });
  });

  it("空ファイルは 400", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await upload(h, cookie, "empty.txt", "");
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.fileEmpty });
  });

  it("10MB を超えるファイルは 400", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const big = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);
    big.fill(0x61);
    const response = await upload(h, cookie, "big.txt", big);
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.fileTooLarge });
  });

  it("拡張子と中身が一致しない PDF は 400", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await upload(h, cookie, "fake.pdf", "hello", "application/pdf");
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.magicMismatch });
  });

  it("PDF は先頭の %PDF を確認して保存し、ファイル名の語で分類する", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await upload(h, cookie, "contract.pdf", "%PDF-1.4 body", "application/pdf");
    expect(response.status).toBe(200);
    const data = await readJson(response);
    expect(data["mime_type"]).toBe("application/pdf");
    expect(data["summary"]).toBe("");
    expect((data["category"] as Record<string, unknown>)["name"]).toBe("契約書");
  });

  it("同じファイル名の 2 回目は stored_name に時刻の接尾辞が付く", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const first = await uploadOk(h, cookie, "dup.txt", "hello");
    const second = await uploadOk(h, cookie, "dup.txt", "hello");
    expect(first["stored_name"]).toBe("dup.txt");
    expect(second["stored_name"]).not.toBe("dup.txt");
    expect(String(second["stored_name"])).toMatch(/^dup_\d+\.txt$/);
  });

  it("stored_name の stem は旧版と同じく \\w 以外を _ に置き換える", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const data = await uploadOk(h, cookie, "請求書 2024(案).txt", "hello");
    expect(data["original_name"]).toBe("請求書 2024(案).txt");
    expect(data["stored_name"]).toBe("請求書_2024_案_.txt");
  });

  it("file フィールドが無い、または multipart でないリクエストは 400", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const noFile = new FormData();
    noFile.append("hp_field", "");
    const missing = await send(h, "/api/files/upload", { method: "POST", body: noFile, cookie });
    expect(missing.status).toBe(400);
    expect(await readJson(missing)).toEqual({ detail: MESSAGES.fileMissing });

    const notMultipart = await send(h, "/api/files/upload", {
      method: "POST",
      json: { file: "x" },
      cookie
    });
    expect(notMultipart.status).toBe(400);
  });

  it("DB 書き込みに失敗したら R2 の実体を取り消し、500 を返す", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const originalPrepare = h.d1.prepare.bind(h.d1);
    const failingEnv = {
      ...h.env,
      DB: {
        ...h.d1,
        prepare(sql: string) {
          if (sql.includes("INSERT INTO files")) {
            return {
              bind() {
                return {
                  first: async () => {
                    throw new Error("injected insert failure");
                  }
                };
              }
            };
          }
          return originalPrepare(sql);
        }
      }
    } as unknown as typeof h.env;
    const response = await h.app.request(
      "/api/files/upload",
      { method: "POST", body: uploadBody("rollback.txt", "hello"), headers: { cookie: `doc_sid=${cookie}` } },
      failingEnv
    );
    expect(response.status).toBe(500);
    expect(await readJson(response)).toMatchObject({ detail: MESSAGES.internalError });
    expect(h.bucket.objects.size).toBe(0);
  });
});

describe("GET /api/files（一覧・検索・絞り込み）", () => {
  it("空の一覧を返す", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await send(h, "/api/files", { cookie });
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ total: 0, page: 1, page_size: 20, items: [] });
  });

  it("アップロード後に total が増える", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    await uploadOk(h, cookie, "a.txt", "hello");
    const data = await readJson(await send(h, "/api/files", { cookie }));
    expect(data["total"]).toBe(1);
  });

  it("ファイル名の検索は大文字小文字を区別しない（旧版 contains と同じ）", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    await uploadOk(h, cookie, "invoice.txt", "dummy");
    await uploadOk(h, cookie, "report.txt", "dummy");
    const data = await readJson(await send(h, "/api/files?query=INVOICE", { cookie }));
    expect(data["total"]).toBe(1);
  });

  it("検索語の % や _ はワイルドカードではなく文字として扱う", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    await uploadOk(h, cookie, "100%.txt", "dummy");
    await uploadOk(h, cookie, "100x.txt", "dummy");
    const data = await readJson(await send(h, "/api/files?query=%25", { cookie }));
    expect(data["total"]).toBe(1);
  });

  it("カテゴリで絞り込める", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    await uploadOk(h, cookie, "contract.pdf", "%PDF-1.4");
    await uploadOk(h, cookie, "note.txt", "hello");
    const data = await readJson(await send(h, "/api/files?category_id=2", { cookie }));
    expect(data["total"]).toBe(1);
  });

  it("タグで絞り込み、一致するタグが複数あっても件数は重複しない", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "tagged.txt", "hello");
    await send(h, `/api/files/${file["id"]}/tags`, { method: "POST", json: { name: "重要" }, cookie });
    await send(h, `/api/files/${file["id"]}/tags`, { method: "POST", json: { name: "重要2" }, cookie });
    const data = await readJson(await send(h, `/api/files?tag=${encodeURIComponent("重要")}`, { cookie }));
    expect(data["total"]).toBe(1);
  });

  it("20 件ごとにページ分けする", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    for (let i = 0; i < 25; i++) {
      await uploadOk(h, cookie, `file${i}.txt`, `content ${i}`);
    }
    const page1 = await readJson(await send(h, "/api/files?page=1", { cookie }));
    const page2 = await readJson(await send(h, "/api/files?page=2", { cookie }));
    expect(page1["total"]).toBe(25);
    expect((page1["items"] as unknown[]).length).toBe(20);
    expect((page2["items"] as unknown[]).length).toBe(5);
  });

  it("不正なページ番号と category_id は 400", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const badPage = await send(h, "/api/files?page=0", { cookie });
    expect(badPage.status).toBe(400);
    expect(await readJson(badPage)).toEqual({ detail: MESSAGES.pageInvalid });
    const badCategory = await send(h, "/api/files?category_id=abc", { cookie });
    expect(badCategory.status).toBe(400);
    expect(await readJson(badCategory)).toEqual({ detail: MESSAGES.categoryIdInvalid });
  });
});

describe("GET /api/categories", () => {
  it("8 件を sort_order 順に返す", async () => {
    const h = createHarness();
    const response = await send(h, "/api/categories");
    expect(response.status).toBe(200);
    const data = (await response.json()) as { name: string; sort_order: number }[];
    expect(data.length).toBe(8);
    expect(data[0]).toEqual({ id: 1, name: "請求書・領収書", color_code: "#FF6B6B", sort_order: 1 });
    expect(data[7]?.name).toBe("その他");
  });
});

describe("PATCH /api/files/:id/category", () => {
  it("カテゴリを変更できる", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "file.txt", "hello");
    const response = await send(h, `/api/files/${file["id"]}/category`, {
      method: "PATCH",
      json: { category_id: 2 },
      cookie
    });
    expect(response.status).toBe(200);
    expect((await readJson(response))["category"]).toMatchObject({ id: 2, name: "契約書" });
  });

  it("存在しないカテゴリは 400、存在しないファイルは 404", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "file.txt", "hello");
    const badCategory = await send(h, `/api/files/${file["id"]}/category`, {
      method: "PATCH",
      json: { category_id: 999 },
      cookie
    });
    expect(badCategory.status).toBe(400);
    expect(await readJson(badCategory)).toEqual({ detail: MESSAGES.categoryNotFound });

    const missing = await send(h, "/api/files/9999/category", {
      method: "PATCH",
      json: { category_id: 1 },
      cookie
    });
    expect(missing.status).toBe(404);
  });

  it("category_id が数値でなければ 400", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "file.txt", "hello");
    const response = await send(h, `/api/files/${file["id"]}/category`, {
      method: "PATCH",
      json: { category_id: "2" },
      cookie
    });
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.categoryIdInvalid });
  });
});

describe("タグの追加・削除", () => {
  it("追加でき、同じタグを重ねて追加しても 1 件のまま", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "file.txt", "hello");
    await send(h, `/api/files/${file["id"]}/tags`, { method: "POST", json: { name: "重要" }, cookie });
    const response = await send(h, `/api/files/${file["id"]}/tags`, {
      method: "POST",
      json: { name: "重要" },
      cookie
    });
    expect(response.status).toBe(200);
    const tags = (await readJson(response))["tags"] as { name: string }[];
    expect(tags.filter((tag) => tag.name === "重要").length).toBe(1);
  });

  it("前後の空白を除き、空のタグ名は 400", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "file.txt", "hello");
    const trimmed = await send(h, `/api/files/${file["id"]}/tags`, {
      method: "POST",
      json: { name: "  重要  " },
      cookie
    });
    expect((await readJson(trimmed))["tags"]).toEqual([expect.objectContaining({ name: "重要" })]);

    const empty = await send(h, `/api/files/${file["id"]}/tags`, { method: "POST", json: { name: "  " }, cookie });
    expect(empty.status).toBe(400);
    expect(await readJson(empty)).toEqual({ detail: MESSAGES.tagNameRequired });
  });

  it("日本語のタグ名を URL エンコードして削除できる", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "file.txt", "hello");
    await send(h, `/api/files/${file["id"]}/tags`, { method: "POST", json: { name: "重要" }, cookie });
    const response = await send(h, `/api/files/${file["id"]}/tags/${encodeURIComponent("重要")}`, {
      method: "DELETE",
      cookie
    });
    expect(response.status).toBe(200);
    expect((await readJson(response))["tags"]).toEqual([]);
  });

  it("存在しないファイルへのタグ操作は 404", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await send(h, "/api/files/9999/tags", { method: "POST", json: { name: "x" }, cookie });
    expect(response.status).toBe(404);
  });
});

describe("GET /api/files/:id/download", () => {
  it("内容と Content-Type、添付のファイル名を返す", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "請求 書.txt", "hello download");
    const response = await send(h, `/api/files/${file["id"]}/download`, { cookie });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello download");
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="__ _.txt"; filename*=UTF-8''%E8%AB%8B%E6%B1%82%20%E6%9B%B8.txt`
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("存在しないファイルは 404", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await send(h, "/api/files/9999/download", { cookie });
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.fileNotFound });
  });

  it("DB にあるのに実体が無い場合は 404（実体の欠落を明示）", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "lost.txt", "hello");
    h.bucket.objects.clear();
    const response = await send(h, `/api/files/${file["id"]}/download`, { cookie });
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.storageMissing });
  });
});

describe("DELETE /api/files/:id", () => {
  it("DB の行と R2 の実体を両方消す", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const file = await uploadOk(h, cookie, "del.txt", "hello");
    const response = await send(h, `/api/files/${file["id"]}`, { method: "DELETE", cookie });
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ ok: true });
    expect((await readJson(await send(h, "/api/files", { cookie })))["total"]).toBe(0);
    expect(h.bucket.objects.size).toBe(0);
  });

  it("存在しないファイルは 404", async () => {
    const h = createHarness();
    const cookie = await startSession(h);
    const response = await send(h, "/api/files/9999", { method: "DELETE", cookie });
    expect(response.status).toBe(404);
  });
});

describe("セッションの分離とCookie", () => {
  it("別のセッションからはファイルが見えず、操作も 404 になる", async () => {
    const h = createHarness();
    const owner = await startSession(h);
    const other = await startSession(h);
    const file = await uploadOk(h, owner, "secret.txt", "secret doc");

    const list = await readJson(await send(h, "/api/files", { cookie: other }));
    expect(list["total"]).toBe(0);
    expect((await send(h, `/api/files/${file["id"]}/download`, { cookie: other })).status).toBe(404);
    expect((await send(h, `/api/files/${file["id"]}`, { method: "DELETE", cookie: other })).status).toBe(404);
    expect((await send(h, `/api/files/${file["id"]}/tags`, { method: "POST", json: { name: "x" }, cookie: other })).status).toBe(404);
  });

  it("Cookie が無い初回アクセスで doc_sid を発行する（HttpOnly・SameSite=Lax・1 年）", async () => {
    const h = createHarness("test");
    const response = await send(h, "/api/files");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^doc_sid=[0-9a-f-]{36};/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=31536000");
    expect(setCookie).not.toContain("Secure");
  });

  it("production では Secure を付ける", async () => {
    const h = createHarness("production");
    const response = await send(h, "/api/files");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("形式の不正な Cookie は作り直す", async () => {
    const h = createHarness();
    const response = await send(h, "/api/files", { cookie: "not-a-uuid" });
    expect(sessionIdFrom(response)).not.toBe("not-a-uuid");
  });

  it("APP_ENV が不正なら既定値に寄せず 500 を返す", async () => {
    const h = createHarness("staging");
    const response = await send(h, "/api/files");
    expect(response.status).toBe(500);
  });
});

describe("エラー応答と追跡", () => {
  it("全応答に X-Request-Id を付ける", async () => {
    const h = createHarness();
    const response = await send(h, "/api/categories");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("存在しない API パスは 404 を detail 付きで返す", async () => {
    const h = createHarness();
    const response = await send(h, "/api/unknown");
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ detail: MESSAGES.notFound });
  });

  it("想定外の例外は 500 にして内部情報を返さず、request_id を返す", async () => {
    const h = createHarness();
    const broken = {
      ...h.env,
      DB: {
        ...h.d1,
        prepare() {
          throw new Error("SECRET-INTERNAL-DETAIL");
        }
      }
    } as unknown as typeof h.env;
    const response = await h.app.request("/api/categories", {}, broken);
    expect(response.status).toBe(500);
    const body = await readJson(response);
    expect(body["detail"]).toBe(MESSAGES.internalError);
    expect(JSON.stringify(body)).not.toContain("SECRET-INTERNAL-DETAIL");
    expect(body["request_id"]).toBe(response.headers.get("x-request-id"));
  });
});
