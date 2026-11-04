import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classify, normalize, scoreText } from "../src/classifier";
import { CLASSIFIER_RULES } from "../src/config/classifierRules";
import { MIGRATION_PATH } from "./helpers/d1";

// 旧 FastAPI 版 tests/test_classifier.py の全ケースを移植（移行で分類結果を変えないための基準）
describe("classify（旧版 test_classifier.py の移植）", () => {
  it.each([
    ["invoice_2024.pdf", "", "請求書・領収書"],
    ["document.txt", "今月の請求金額は50000円です。振込先は以下の通り。", "請求書・領収書"],
    ["contract_agreement.pdf", "", "契約書"],
    ["doc.txt", "本契約書は甲乙間の同意のもと締結されます。条項に従い。", "契約書"],
    ["monthly_report.txt", "", "報告書・レポート"],
    ["file.txt", "第3回定例会議の議事録。打ち合わせ内容を以下に記す。", "議事録・会議"],
    ["file.txt", "名刺情報 電話: 03-1234-5678 メール: test@example.com 住所: 東京都", "名刺・連絡先"],
    ["file.txt", "申請書 申込フォーム 届出番号123", "申請書・フォーム"],
    ["user_manual.pdf", "", "マニュアル・手順書"],
    ["photo.jpg", "", "その他"],
    ["INVOICE.PDF", "", "請求書・領収書"],
    ["file.txt", "", "その他"],
    ["report.txt", "報告 分析結果レポート", "報告書・レポート"],
    ["file.txt", "invoice ".repeat(200), "請求書・領収書"]
  ])("filename=%s content=%j -> %s", (filename, content, expected) => {
    expect(classify(filename, content)).toBe(expected);
  });

  it("一致するキーワードが無ければ その他", () => {
    expect(classify("file.txt", "")).toBe("その他");
  });

  it("ファイル名と本文の両方のスコアを合算する", () => {
    expect(classify("report.txt", "報告 分析結果レポート")).toBe("報告書・レポート");
  });

  it("本文は先頭 500 文字（コードポイント単位）だけを見る", () => {
    const longButLateKeyword = "あ".repeat(500) + "invoice";
    expect(classify("file.txt", longButLateKeyword)).toBe("その他");
  });
});

describe("normalize と scoreText（旧版 TestNormalize / TestScore の移植）", () => {
  it("小文字化する", () => {
    expect(normalize("INVOICE Receipt")).toBe("invoice receipt");
    expect(normalize("")).toBe("");
  });

  it("キーワードの部分一致数を数える", () => {
    expect(scoreText("invoice receipt", ["invoice", "receipt"])).toBe(2);
    expect(scoreText("document", ["invoice"])).toBe(0);
    expect(scoreText("invoices", ["invoice"])).toBe(1);
  });
});

describe("分類ルールとマイグレーションの整合", () => {
  it("分類ルールの全カテゴリ名が 0001_init.sql の分類マスタに存在する", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    for (const rule of CLASSIFIER_RULES) {
      expect(sql).toContain(`'${rule.category}'`);
    }
    expect(CLASSIFIER_RULES.length).toBe(7);
  });
});
