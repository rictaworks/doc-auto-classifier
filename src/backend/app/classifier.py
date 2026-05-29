from dataclasses import dataclass, field

CONTENT_MAX_CHARS = 500


@dataclass
class ClassifierService:
    _rules: dict[str, list[str]] = field(default_factory=lambda: {
        "請求書・領収書": ["invoice", "receipt", "請求", "領収", "支払", "金額", "振込"],
        "契約書": ["contract", "agreement", "契約", "同意", "締結", "条項"],
        "報告書・レポート": ["report", "報告", "レポート", "分析", "調査"],
        "議事録・会議": ["minutes", "meeting", "議事録", "会議", "打ち合わせ"],
        "名刺・連絡先": ["business card", "名刺", "電話", "メール", "住所"],
        "申請書・フォーム": ["application", "form", "申請", "届出", "申込"],
        "マニュアル・手順書": ["manual", "guide", "マニュアル", "手順", "操作"],
    })

    def classify(self, filename: str, content: str) -> str:
        normalized_filename = self._normalize(filename)
        normalized_content = self._normalize(content[:CONTENT_MAX_CHARS])

        best_category = "その他"
        best_score = 0

        for category, keywords in self._rules.items():
            score = self._score(normalized_filename, keywords) + self._score(normalized_content, keywords)
            if score > best_score:
                best_score = score
                best_category = category

        return best_category

    def _score(self, text: str, keywords: list[str]) -> int:
        return sum(1 for kw in keywords if kw in text)

    def _normalize(self, text: str) -> str:
        return text.lower()
