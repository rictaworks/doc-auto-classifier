# doc-auto-classifier

> **これはデモ版です。** `src/backend/` 以下の実装は製品版と設計が異なります。

書類の自動分類システム。アップロードされた文書を AI が自動で分類・整理する。

---

## 技術スタック（デモ版）

| 層 | 技術 |
|---|---|
| フロントエンド | Jinja2 テンプレート（FastAPI 内蔵） |
| バックエンド | FastAPI (Python) |
| DB | SQLite |
| 認証 | なし（デモ版のため未実装） |

---

## ページ一覧

| ページ名 | URL |
|---|---|
| トップページ | [/](http://localhost:8000/) |

---

## API 一覧

### ファイル API

| メソッド | エンドポイント | 説明 |
|---|---|---|
| `POST` | `/api/files/upload` | ファイルアップロード・分類 |
| `GET` | `/api/files` | ファイル一覧取得（検索・絞り込み対応） |
| `PATCH` | `/api/files/{id}/category` | カテゴリ手動変更 |
| `GET` | `/api/files/{id}/download` | ファイルダウンロード |
| `DELETE` | `/api/files/{id}` | ファイル削除 |
| `POST` | `/api/files/{id}/tags` | タグ追加 |
| `DELETE` | `/api/files/{id}/tags/{tag_name}` | タグ削除 |

### カテゴリ API

| メソッド | エンドポイント | 説明 |
|---|---|---|
| `GET` | `/api/categories` | カテゴリ一覧取得 |

---

## 開発環境のセットアップ

[ENV/DEVELOPMENT.md](./ENV/DEVELOPMENT.md) を参照すること。

## 本番環境

[ENV/PRODUCTION.md](./ENV/PRODUCTION.md) を参照すること。

## 仕様書・設計図

[SPEC/](./SPEC/) を参照すること。
