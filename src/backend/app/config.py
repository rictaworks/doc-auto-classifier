import os
from pathlib import Path

from dotenv import load_dotenv

_root = Path(__file__).resolve()
for _p in _root.parents:
    if (_p / ".env").exists():
        load_dotenv(_p / ".env", override=False)
        break

APP_ENV: str = os.environ.get("APP_ENV", "development")

_db_map = {
    "test": os.environ.get("TEST_DATABASE_URL", "sqlite:///./data/test.db"),
    "development": os.environ.get("DATABASE_URL", "sqlite:///./data/app.db"),
    "production": os.environ.get("DATABASE_URL", "sqlite:///./data/app.db"),
}

DATABASE_URL: str = _db_map.get(APP_ENV, _db_map["development"])
UPLOAD_DIR: str = os.environ.get("UPLOAD_DIR", "./data/uploads")
MAX_FILE_SIZE_BYTES: int = int(os.environ.get("MAX_FILE_SIZE_MB", "10")) * 1024 * 1024
SESSION_SECRET: str = os.environ.get("SESSION_SECRET", "change-me")

ALLOWED_EXTENSIONS: set[str] = {".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg"}
PAGE_SIZE: int = 20
