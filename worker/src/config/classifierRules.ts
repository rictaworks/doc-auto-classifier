// 分類ルール。同点の場合は先に定義されたカテゴリが優先される（旧 FastAPI 版と同じ順序）。
// キーワードは小文字化したファイル名・本文の先頭 500 文字に対する部分一致で数える。
export interface ClassifierRule {
  readonly category: string;
  readonly keywords: readonly string[];
}

export const CLASSIFIER_RULES: readonly ClassifierRule[] = [
  { category: "請求書・領収書", keywords: ["invoice", "receipt", "請求", "領収", "支払", "金額", "振込"] },
  { category: "契約書", keywords: ["contract", "agreement", "契約", "同意", "締結", "条項"] },
  { category: "報告書・レポート", keywords: ["report", "報告", "レポート", "分析", "調査"] },
  { category: "議事録・会議", keywords: ["minutes", "meeting", "議事録", "会議", "打ち合わせ"] },
  { category: "名刺・連絡先", keywords: ["business card", "名刺", "電話", "メール", "住所"] },
  { category: "申請書・フォーム", keywords: ["application", "form", "申請", "届出", "申込"] },
  { category: "マニュアル・手順書", keywords: ["manual", "guide", "マニュアル", "手順", "操作"] }
];
