import mimetypes
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session as DBSession

from app.classifier import ClassifierService
from app.config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, PAGE_SIZE
from app.models import Category, File, Tag


@dataclass
class PageResult:
    items: list[File]
    total: int
    page: int
    page_size: int


_classifier = ClassifierService()


@dataclass
class FileService:
    db: DBSession
    upload_dir: Path

    def upload(self, file: UploadFile, hp_field: str) -> File:
        if hp_field:
            raise HTTPException(status_code=400, detail="Bad request")

        if not file.filename:
            raise HTTPException(status_code=400, detail="ファイル名が取得できません")

        if file.size == 0:
            raise HTTPException(status_code=400, detail="ファイルが空です")

        if file.size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="ファイルサイズが上限を超えています")

        suffix = Path(file.filename).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"許可されていない拡張子: {suffix}")

        stored_name = self._unique_name(file.filename)
        upload_base = Path(self.upload_dir).resolve()
        dest = (upload_base / stored_name).resolve()
        if not dest.is_relative_to(upload_base):
            raise HTTPException(status_code=400, detail="無効なファイル名です")
        dest.parent.mkdir(parents=True, exist_ok=True)

        data = file.file.read()

        if not self._check_magic_bytes(data, suffix):
            raise HTTPException(status_code=400, detail="ファイルの内容が拡張子と一致しません")

        dest.write_bytes(data)

        text_content = ""
        if suffix in {".txt", ".md"}:
            try:
                text_content = data.decode("utf-8", errors="replace")
            except Exception:
                text_content = ""

        category_name = _classifier.classify(file.filename, text_content)
        category = self.db.query(Category).filter(Category.name == category_name).first()
        if category is None:
            category = self.db.query(Category).filter(Category.name == "その他").first()

        mime_type = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"

        record = File(
            original_name=file.filename,
            stored_name=stored_name,
            file_path=str(dest),
            file_size=len(data),
            mime_type=mime_type,
            category_id=category.id,
            summary=text_content[:200],
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def list_files(
        self,
        query: str = "",
        category_id: int | None = None,
        tag: str = "",
        page: int = 1,
    ) -> PageResult:
        q = self.db.query(File)

        if query:
            q = q.filter(File.original_name.contains(query))

        if category_id is not None:
            q = q.filter(File.category_id == category_id)

        if tag:
            q = q.join(File.tags).filter(Tag.name.contains(tag))

        total = q.count()
        items = q.order_by(File.uploaded_at.desc()).offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).all()

        return PageResult(items=items, total=total, page=page, page_size=PAGE_SIZE)

    def get(self, file_id: int) -> File:
        record = self.db.query(File).filter(File.id == file_id).first()
        if record is None:
            raise HTTPException(status_code=404, detail="ファイルが見つかりません")
        return record

    def update_category(self, file_id: int, category_id: int) -> File:
        record = self.get(file_id)
        record.category_id = category_id
        record.updated_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(record)
        return record

    def add_tag(self, file_id: int, tag_name: str) -> File:
        record = self.get(file_id)
        tag = self.db.query(Tag).filter(Tag.name == tag_name).first()
        if tag is None:
            tag = Tag(name=tag_name)
            self.db.add(tag)
            self.db.flush()
        if tag not in record.tags:
            record.tags.append(tag)
        self.db.commit()
        self.db.refresh(record)
        return record

    def remove_tag(self, file_id: int, tag_name: str) -> File:
        record = self.get(file_id)
        record.tags = [t for t in record.tags if t.name != tag_name]
        self.db.commit()
        self.db.refresh(record)
        return record

    def delete(self, file_id: int) -> None:
        record = self.get(file_id)
        path = self._safe_resolve(record.file_path)
        if path.exists():
            path.unlink()
        self.db.delete(record)
        self.db.commit()

    def download(self, file_id: int) -> tuple[Path, str, str]:
        record = self.get(file_id)
        path = self._safe_resolve(record.file_path)
        return path, record.mime_type, record.original_name

    def _safe_resolve(self, file_path: str) -> Path:
        path = Path(file_path).resolve()
        allowed_base = Path(self.upload_dir).resolve()
        if not path.is_relative_to(allowed_base):
            raise HTTPException(status_code=403, detail="アクセス禁止")
        return path

    def _check_magic_bytes(self, data: bytes, suffix: str) -> bool:
        _MAGIC: dict[str, list[bytes]] = {
            ".pdf": [b"%PDF"],
            ".png": [b"\x89PNG"],
            ".jpg": [b"\xff\xd8\xff"],
            ".jpeg": [b"\xff\xd8\xff"],
        }
        expected = _MAGIC.get(suffix)
        if expected is None:
            return True
        return any(data.startswith(sig) for sig in expected)

    def _unique_name(self, original: str) -> str:
        stem = Path(original).stem
        suffix = Path(original).suffix
        safe_stem = re.sub(r"[^\w\-]", "_", stem)
        name = f"{safe_stem}{suffix}"
        dest = Path(self.upload_dir) / name
        if not dest.exists():
            return name
        ts = datetime.now(UTC).strftime("%Y%m%d%H%M%S%f")
        return f"{safe_stem}_{ts}{suffix}"
