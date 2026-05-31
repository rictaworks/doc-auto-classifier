# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 絶対ルール

### ブランチ保護
- `main` への直接コミット・プッシュ禁止（`src/*` 以外は許可）
- `src/*` の変更は必ず PR を作成すること
- PR 作成前に `/security-review` を実行すること

### コーディング禁止事項
- グローバル変数禁止
- `alert()` / `confirm()` / `prompt()` 禁止（カスタムモーダルを使用）
- 文字列リテラルのハードコード禁止（設定ファイルに分離）
- 絵文字禁止（アイコンは Font Awesome を使用）
- コメントは WHY が自明でない場合のみ（WHAT の説明は禁止）

---

## テクノロジースタック

| 層 | 技術 |
|---|---|
| フロントエンド | Jinja2 テンプレート + Tailwind CSS (CDN) + Vanilla JS |
| バックエンド | FastAPI (Python) |
| DB | SQLite（`src/backend/data/app.db`） |
| デプロイ | Railway（nixpacks） / カスタムドメイン: `doc-auto-classifier.rictaworks.jp` |

---

## アーキテクチャ

```
src/backend/
├── app/
│   ├── main.py          # FastAPI アプリ、ルーター登録、APScheduler（毎日03:00 DBリセット）
│   ├── models.py        # SQLAlchemy モデル（File / Category / Tag / Session）
│   ├── database.py      # エンジン・セッション設定
│   ├── file_service.py  # ファイル操作のビジネスロジック（FileService dataclass）
│   ├── classifier.py    # キーワードマッチによる自動分類（ClassifierService）
│   ├── config.py        # 定数（UPLOAD_DIR / ALLOWED_EXTENSIONS / MAX_FILE_SIZE_BYTES）
│   ├── routers/
│   │   ├── files.py     # /api/files エンドポイント・セッションCookie依存
│   │   └── categories.py
│   ├── templates/       # Jinja2 テンプレート（index.html）
│   └── static/          # JS / CSS
└── tests/
    ├── test_api.py          # FastAPI TestClient による統合テスト
    ├── test_classifier.py   # 分類エンジン単体テスト
    └── test_file_service.py # FileService 単体テスト（インメモリ SQLite）
```

### セッション分離

`/api/files` ルーターが Cookie `doc_sid`（HttpOnly / SameSite=Lax）を発行し、`FileService` は全操作を `session_id` でフィルタする。Cookie がない場合は UUID を新規発行してレスポンスにセット。

### 分類カテゴリ（8種）

請求書・領収書 / 契約書 / 報告書・レポート / 議事録・会議 / 名刺・連絡先 / 申請書・フォーム / マニュアル・手順書 / その他

---

## テストコマンド

すべて `src/backend/` 内で実行。

```bash
pytest                                      # 全テスト（52件）
pytest tests/test_api.py                   # API統合テスト
pytest tests/test_classifier.py            # 分類エンジン単体テスト
pytest tests/test_file_service.py          # FileService 単体テスト
pytest tests/test_api.py::test_upload_file # 単一テスト
```

### TDD フロー

```
red（失敗テストを書く）→ coding → green（テストを通す）→ refactor
```

---

## デプロイ

`main` への push で Railway が自動ビルド（nixpacks）。`railway.toml` でソースを `src/backend` に指定。起動コマンド：`uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

## PR ルール

- PR 本文は日本語で記述
- 非エンジニア向けのユーザーテスト手順を PR 本文に記述すること
- PR 作成前に `/security-review` を実行すること
