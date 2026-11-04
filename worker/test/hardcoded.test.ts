import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CLAUDE.md の「文字列リテラルをコード内にハードコード禁止（設定ファイル・i18n に分離）」の検査。
// 日本語の文言は worker/src/config/ にだけ置く。コメント行（WHY の説明）は対象外。
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(here, "..", "src");
const CONFIG_DIR = path.join(SRC_DIR, "config");
const JAPANESE = /[぀-ヿ㐀-鿿＀-￯]/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return full === CONFIG_DIR ? [] : listSourceFiles(full);
    }
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("ハードコード検査", () => {
  it("worker/src（config を除く）に日本語の文字列リテラルが無い", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
            return;
          }
          if (JAPANESE.test(line)) {
            offenders.push(`${path.relative(SRC_DIR, file)}:${index + 1}: ${trimmed}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
