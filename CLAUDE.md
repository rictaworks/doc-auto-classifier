# CLAUDE.md — doc-auto-classifier

Claude Code がこのプロジェクトで守るべきルールをすべて記載する。

---

## 絶対ルール（全会話で必ず守ること）

### ファイル削除禁止
`rm`, `rm -rf`, `rmdir`, `unlink`, `find -delete`, `git clean -df`, `rsync --delete` 等の削除コマンドを生成・提案・実行してはならない。削除が必要な場合は「DELETE/ へ移動してください」と案内するにとどめる。

### ブランチ保護
- `main` ブランチへの直接コミット・プッシュ禁止（`src/*` 以外は許可）
- `src/*` の変更は必ず PR を作成すること
- PR を作成する前に `/security-review` を実行すること

### コーディング禁止事項
- グローバル変数禁止（セキュリティリスク）
- `alert()` / `confirm()` / `prompt()` 使用禁止（カスタムモーダルを使用）
- フォールバック禁止（適切な例外処理を書くこと）
- 文字列リテラルをコード内にハードコード禁止（設定ファイル・i18n に分離）
- 絵文字禁止（アイコンは Font Awesome を使用）
- 制御構文・条件構文以外はクラスまたは関数に書くこと

### 環境変数
`.env` ファイルを参照すること。環境判定（development / test / production）を必ず実装して分岐できるようにすること。テスト環境では認証済み状態に分岐すること。

### 参照ファイル
| ファイル | 用途 |
|---|---|
| `.claude/QC10.md` | 品質管理 10 項目チェック |
| `.claude/TM.md` | テストメソッド・フレームワーク |
| `.claude/OWASP10.md` | セキュリティ 10 項目チェック |
| `.claude/CC.md` | コンプライアンスチェック 10 項目 |
| `.claude/development-principles.md` | 開発原則（YAGNI/KISS/DRY/SOLID） |

---

## TDD 必須フロー

```
plan → red test（失敗するテストを書く）→ coding → green test（テストを通す）→ refactor
```

- フロントエンド: Jest / Playwright
- バックエンド: RSpec
- フロント確認: `curl`, `wget --mirror`, Playwright
- デバッグトレース可能なコードを書くこと（ログ出力・エラー詳細を必ず含める）

---

## テクノロジースタック

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js (TypeScript) |
| バックエンド API | Rails (Ruby) |
| DB | PostgreSQL |
| 高速 API（必要時） | FastAPI（AI・解析・画像処理）/ Gin（高速並列・リアルタイム） |
| アイコン | Font Awesome |
| 認証 | Google OAuth |
| デプロイ: フロント | Vercel（無料プラン） |
| デプロイ: バック・管理 | Render または Railway（無料プラン） |
| ドメイン | `*.rictaworks.jp` のサブドメイン |

### 多言語対応（当初から実装）
日本語 / 英語 / フランス語 / 中国語 / ロシア語 / スペイン語 / アラビア語  
※ 管理画面は日本語のみ

---

## アーキテクチャ方針

規模に応じてマイクロサービス・MVC・API Gateway・メッセージングを選択する。  
安全なライブラリ・OSS・SaaS を積極活用し、オリジナルコードを最小化する（車輪の再発明禁止）。  
画像は AI 生成。ライティングはライターエージェントが担当。

---

## コード品質ルール

- コメントは WHY が自明でない場合のみ記述（WHAT の説明は禁止）
- エラーハンドリングを必ず実装（フォールバック禁止、例外を明示的に処理）
- ハードコードチェックのテストを書くこと
- デバッグトレース可能にすること（ログ・スタックトレース・リクエスト ID）

---

## ディレクトリ管理

| ディレクトリ | 用途 |
|---|---|
| `TASKS/` | タスク管理（`TASKS/YYYY-MM-DD-title.md`） |
| `DEBUG/` | バグ報告（`DEBUG/BUG-NNN-title.md`） |
| `CLIENT/` | クライアント要望（`CLIENT/REQ-NNN-title.md`） |
| `WORK/` | 作業報告（`WORK/YYYY-MM-DD-report.md`） |
| `ENV/DEVELOPMENT.md` | 開発環境の手順・設定 |
| `ENV/PRODUCTION.md` | 本番環境の手順・設定 |
| `SPEC/` | 仕様書・リバースエンジニアリング（ER図・DFD・シーケンス図等） |
| `DELETE/` | ゴミ箱（削除ではなく移動） |

図解には Mermaid を使用すること（`mermaid` CLI インストール済みであること）。

---

## エージェント定義

`.claude/agents/` 以下のファイルを参照すること。規模に応じて以下のエージェントを使用する：

| エージェント | 役割 |
|---|---|
| `director` | プロジェクト全体方針・意思決定 |
| `project-manager` | タスク管理・スケジュール・進捗 |
| `designer` | UI/UX 設計・Figma 連携 |
| `debugger` | バグ解析・再現・修正 |
| `tester` | テスト作成・実行・報告 |
| `data-scientist` | データ分析・モデリング |
| `deployer` | CI/CD・デプロイ管理 |
| `writer` | ライティング・多言語翻訳・PR 文書 |
| `service-manager` | 外部サービス管理・SaaS 設定 |

---

## PR ルール

- PR 本文は日本語で記述
- **非エンジニア向けユーザーテスト手順**を PR 本文に丁寧に記述すること
- PR 作成前に `security-review` を実行すること
- `SPEC/` の図解を PR に貼付すること（影響範囲が大きい場合）

---

## サブエージェント

### pr-checker
全 PR を対象として：
- PR 本文を日本語に統一する
- 非エンジニア向けのユーザーテスト手順を PR 本文に丁寧に書く

### tester
全 PR を対象として：
- PR に書かれたユーザーテスト手順の実行スクリプトを `test/pr-NNN/` に作成する
- `TM.md` に記載されたテストメソッドに基づいてテストを作成する（Jest / RSpec）
- テストの対象は開発サーバー（`http://localhost:3000`）とする
