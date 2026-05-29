# doc-auto-classifier

書類の自動分類システム。アップロードされた文書を AI が自動で分類・整理する。

---

## 自動ログイン（開発環境）

開発環境では認証を自動的にスキップして、テスト用ユーザーとして認証済み状態にする。

| 設定項目 | 値 |
|---|---|
| 環境変数 | `RAILS_ENV=development` / `NODE_ENV=development` |
| 自動ログインユーザー | `dev@example.com`（`.env` 参照） |
| 認証スキップ条件 | `ENV["SKIP_AUTH"] == "true"` |

`.env` ファイルに以下を設定すること：

```
SKIP_AUTH=true
DEV_USER_EMAIL=dev@example.com
```

本番環境では `SKIP_AUTH` を設定しないこと。

---

## ページ一覧

| ページ名 | URL |
|---|---|
| トップページ | [/](http://localhost:3000/) |
| ログイン | [/login](http://localhost:3000/login) |
| ダッシュボード | [/dashboard](http://localhost:3000/dashboard) |
| 書類アップロード | [/upload](http://localhost:3000/upload) |
| 分類結果一覧 | [/documents](http://localhost:3000/documents) |
| 書類詳細 | [/documents/:id](http://localhost:3000/documents/:id) |
| カテゴリ管理 | [/categories](http://localhost:3000/categories) |
| 設定 | [/settings](http://localhost:3000/settings) |
| 管理画面（ユーザー管理） | [/admin/users](http://localhost:3000/admin/users) |
| 管理画面（ログ） | [/admin/logs](http://localhost:3000/admin/logs) |

---

## API 一覧

仕様書は [SPEC/api/](./SPEC/api/) を参照すること。

### 認証 API

| タイトル | エンドポイント URL |
|---|---|
| Google OAuth コールバック | `GET /auth/google/callback` |
| セッション確認 | `GET /api/v1/auth/me` |
| ログアウト | `DELETE /api/v1/auth/session` |

### 書類 API

| タイトル | エンドポイント URL |
|---|---|
| 書類一覧取得 | `GET /api/v1/documents` |
| 書類詳細取得 | `GET /api/v1/documents/:id` |
| 書類アップロード（分類開始） | `POST /api/v1/documents` |
| 書類分類結果更新（手動修正） | `PATCH /api/v1/documents/:id` |
| 書類ダウンロード | `GET /api/v1/documents/:id/download` |

### カテゴリ API

| タイトル | エンドポイント URL |
|---|---|
| カテゴリ一覧取得 | `GET /api/v1/categories` |
| カテゴリ作成 | `POST /api/v1/categories` |
| カテゴリ更新 | `PATCH /api/v1/categories/:id` |

### 分類エンジン API（FastAPI）

| タイトル | エンドポイント URL |
|---|---|
| 書類分類実行 | `POST /classify` |
| 分類モデル情報取得 | `GET /classify/model-info` |
| ヘルスチェック | `GET /health` |

---

## デモ版について

`src/backend/` に収録されているデモ版は、製品版と設計が異なります。

---

## 開発環境のセットアップ

[ENV/DEVELOPMENT.md](./ENV/DEVELOPMENT.md) を参照すること。

## 本番環境

[ENV/PRODUCTION.md](./ENV/PRODUCTION.md) を参照すること。

## 仕様書・設計図

[SPEC/](./SPEC/) を参照すること。
