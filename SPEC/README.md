# SPEC — 仕様書・設計図

リバースエンジニアリングおよび設計ドキュメントを管理する。図解は Mermaid で作成する。

## ディレクトリ構成

| ディレクトリ | 内容 |
|---|---|
| `api/` | API 仕様書（OpenAPI/Swagger 等） |
| `diagrams/` | ER 図・DFD・シーケンス図・クラス図・状態遷移図・ユースケース図 |
| `model/` | AI モデル仕様・評価レポート |

## 図解の作成方法

```bash
# Mermaid CLI でPNG生成
npx mmdc -i SPEC/diagrams/er.mmd -o SPEC/diagrams/er.png
```

## 図解の種類

| 図解 | ファイル名 | 用途 |
|---|---|---|
| ER 図 | `diagrams/er.mmd` | データモデル設計 |
| DFD | `diagrams/dfd.mmd` | データフロー設計 |
| シーケンス図 | `diagrams/sequence-*.mmd` | API フロー・認証フロー |
| クラス図 | `diagrams/class.mmd` | オブジェクト設計 |
| 状態遷移図 | `diagrams/state-*.mmd` | ステータス管理 |
| ユースケース図 | `diagrams/usecase.mmd` | 機能要件整理 |
