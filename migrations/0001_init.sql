-- 旧 FastAPI 版（SQLAlchemy の create_all）と同じテーブル構成を D1（SQLite 方言）で作る。
-- 旧版の DateTime 列は ISO 8601（UTC、ミリ秒、Z 付き）の TEXT に統一する。

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  summary TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_session_uploaded ON files(session_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_files_session_category ON files(session_id, category_id);
CREATE INDEX IF NOT EXISTS idx_files_stored_name ON files(stored_name);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);

-- 分類マスタ（旧版 app/main.py の _MASTER_CATEGORIES と同じ 8 件）
INSERT OR IGNORE INTO categories (id, name, color_code, sort_order) VALUES
  (1, '請求書・領収書', '#FF6B6B', 1),
  (2, '契約書', '#4ECDC4', 2),
  (3, '報告書・レポート', '#45B7D1', 3),
  (4, '議事録・会議', '#96CEB4', 4),
  (5, '名刺・連絡先', '#FFEAA7', 5),
  (6, '申請書・フォーム', '#DDA0DD', 6),
  (7, 'マニュアル・手順書', '#98D8C8', 7),
  (8, 'その他', '#B0B0B0', 8);
