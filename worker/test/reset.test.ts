import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { createHarness, readJson, send, sessionIdFrom, uploadBody } from "./helpers/harness";

describe("日次リセット（scheduled）", () => {
  it("ファイル・タグ・R2 の実体を消し、分類マスタは残す", async () => {
    const h = createHarness();
    const first = await send(h, "/api/files");
    const cookie = sessionIdFrom(first);

    const upload = await send(h, "/api/files/upload", {
      method: "POST",
      body: uploadBody("invoice.txt", "invoice"),
      cookie
    });
    expect(upload.status).toBe(200);
    const uploaded = await readJson(upload);
    await send(h, `/api/files/${uploaded["id"]}/tags`, { method: "POST", json: { name: "重要" }, cookie });
    expect(h.bucket.objects.size).toBe(1);

    await worker.scheduled({} as ScheduledController, h.env);

    const list = await readJson(await send(h, "/api/files", { cookie }));
    expect(list["total"]).toBe(0);
    expect(h.bucket.objects.size).toBe(0);
    const tagCount = h.d1.sqlite.prepare("SELECT COUNT(*) AS n FROM tags").get() as { n: number };
    expect(tagCount.n).toBe(0);
    const categoryCount = h.d1.sqlite.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number };
    expect(categoryCount.n).toBe(8);
  });

  it("R2 の掃除は files/ 接頭辞のものだけを消す", async () => {
    const h = createHarness();
    await h.bucket.put("other/keep.bin", new Uint8Array([1, 2, 3]));
    await h.bucket.put("files/leftover/stale.txt", new Uint8Array([4]));

    await worker.scheduled({} as ScheduledController, h.env);

    expect([...h.bucket.objects.keys()]).toEqual(["other/keep.bin"]);
  });
});
