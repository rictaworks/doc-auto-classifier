import pytest
from app.classifier import ClassifierService


@pytest.fixture
def classifier():
    return ClassifierService()


class TestClassify:
    def test_invoice_by_filename(self, classifier):
        result = classifier.classify("invoice_2024.pdf", "")
        assert result == "請求書・領収書"

    def test_invoice_by_content(self, classifier):
        result = classifier.classify("document.txt", "今月の請求金額は50000円です。振込先は以下の通り。")
        assert result == "請求書・領収書"

    def test_contract_by_filename(self, classifier):
        result = classifier.classify("contract_agreement.pdf", "")
        assert result == "契約書"

    def test_contract_by_content(self, classifier):
        result = classifier.classify("doc.txt", "本契約書は甲乙間の同意のもと締結されます。条項に従い。")
        assert result == "契約書"

    def test_report_by_filename(self, classifier):
        result = classifier.classify("monthly_report.txt", "")
        assert result == "報告書・レポート"

    def test_minutes_by_content(self, classifier):
        result = classifier.classify("file.txt", "第3回定例会議の議事録。打ち合わせ内容を以下に記す。")
        assert result == "議事録・会議"

    def test_business_card_by_content(self, classifier):
        result = classifier.classify("file.txt", "名刺情報 電話: 03-1234-5678 メール: test@example.com 住所: 東京都")
        assert result == "名刺・連絡先"

    def test_application_by_content(self, classifier):
        result = classifier.classify("file.txt", "申請書 申込フォーム 届出番号123")
        assert result == "申請書・フォーム"

    def test_manual_by_filename(self, classifier):
        result = classifier.classify("user_manual.pdf", "")
        assert result == "マニュアル・手順書"

    def test_other_when_no_match(self, classifier):
        result = classifier.classify("photo.jpg", "")
        assert result == "その他"

    def test_case_insensitive(self, classifier):
        result = classifier.classify("INVOICE.PDF", "")
        assert result == "請求書・領収書"

    def test_first_category_wins_on_tie(self, classifier):
        # スコアが同点の場合は最初のカテゴリが優先される
        result = classifier.classify("file.txt", "")
        assert result == "その他"

    def test_score_from_both_filename_and_content(self, classifier):
        result = classifier.classify("report.txt", "報告 分析結果レポート")
        assert result == "報告書・レポート"

    def test_content_limited_to_500_chars(self, classifier):
        long_content = "invoice " * 200
        result = classifier.classify("file.txt", long_content)
        assert result == "請求書・領収書"


class TestNormalize:
    def test_lowercase_normalization(self, classifier):
        result = classifier._normalize("INVOICE Receipt")
        assert result == "invoice receipt"

    def test_empty_string(self, classifier):
        result = classifier._normalize("")
        assert result == ""


class TestScore:
    def test_keyword_match(self, classifier):
        score = classifier._score("invoice receipt", ["invoice", "receipt"])
        assert score == 2

    def test_no_match(self, classifier):
        score = classifier._score("document", ["invoice"])
        assert score == 0

    def test_partial_word_match(self, classifier):
        score = classifier._score("invoices", ["invoice"])
        assert score == 1
