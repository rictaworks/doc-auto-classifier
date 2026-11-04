import { describe, expect, it } from "vitest";
import { firstCodePoints, splitFilename } from "../src/text";

describe("firstCodePoints", () => {
  it("コードポイント単位で数える（サロゲートペアを割らない）", () => {
    expect(firstCodePoints("😀あい", 1)).toBe("😀");
    expect(firstCodePoints("😀あい", 2)).toBe("😀あ");
    expect(firstCodePoints("abc", 10)).toBe("abc");
    expect(firstCodePoints("", 5)).toBe("");
  });

  it("長い本文でも上限で止まり、全文を配列化しない", () => {
    const big = "a".repeat(10 * 1024 * 1024);
    const started = performance.now();
    const head = firstCodePoints(big, 500);
    const elapsed = performance.now() - started;
    expect(head.length).toBe(500);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("splitFilename", () => {
  it("POSIX の Path と同じく先頭ドットだけの名前は suffix を持たない", () => {
    expect(splitFilename(".pdf")).toEqual({ stem: ".pdf", suffix: "" });
    expect(splitFilename("a.")).toEqual({ stem: "a.", suffix: "" });
    expect(splitFilename("dir/report.PDF")).toEqual({ stem: "report", suffix: ".PDF" });
  });
});
