import io
import pytest
from unittest.mock import MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import UploadFile

from app.database import Base
from app.file_service import FileService
from app.models import Category


TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture
def session():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    for cat in [
        Category(id=1, name="請求書・領収書", color_code="#FF6B6B", sort_order=1),
        Category(id=8, name="その他", color_code="#B0B0B0", sort_order=8),
    ]:
        s.add(cat)
    s.commit()
    yield s
    s.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def service(session, tmp_path):
    return FileService(db=session, upload_dir=tmp_path)


class TestUpload:
    def test_upload_txt_file(self, service):
        content = b"hello world invoice"
        upload = UploadFile(filename="test.txt", file=io.BytesIO(content))
        upload.size = len(content)
        result = service.upload(upload, hp_field="")
        assert result.original_name == "test.txt"
        assert result.file_size == len(content)

    def test_upload_rejects_honeypot(self, service):
        from fastapi import HTTPException
        content = b"hello"
        upload = UploadFile(filename="test.txt", file=io.BytesIO(content))
        upload.size = len(content)
        with pytest.raises(HTTPException) as exc:
            service.upload(upload, hp_field="bot-filled")
        assert exc.value.status_code == 400

    def test_upload_rejects_empty_file(self, service):
        from fastapi import HTTPException
        upload = UploadFile(filename="empty.txt", file=io.BytesIO(b""))
        upload.size = 0
        with pytest.raises(HTTPException) as exc:
            service.upload(upload, hp_field="")
        assert exc.value.status_code == 400

    def test_upload_rejects_disallowed_extension(self, service):
        from fastapi import HTTPException
        content = b"exec content"
        upload = UploadFile(filename="virus.exe", file=io.BytesIO(content))
        upload.size = len(content)
        with pytest.raises(HTTPException) as exc:
            service.upload(upload, hp_field="")
        assert exc.value.status_code == 400

    def test_upload_rejects_oversized_file(self, service):
        from fastapi import HTTPException
        upload = UploadFile(filename="big.txt", file=io.BytesIO(b"x"))
        upload.size = 11 * 1024 * 1024
        with pytest.raises(HTTPException) as exc:
            service.upload(upload, hp_field="")
        assert exc.value.status_code == 400

    def test_duplicate_filename_gets_suffix(self, service):
        content = b"hello"
        for _ in range(2):
            upload = UploadFile(filename="dup.txt", file=io.BytesIO(content))
            upload.size = len(content)
            service.upload(upload, hp_field="")
        files = service.list_files()
        names = [f.stored_name for f in files.items]
        assert len(set(names)) == 2


class TestListFiles:
    def test_list_returns_all(self, service):
        for i in range(3):
            content = f"content {i}".encode()
            upload = UploadFile(filename=f"file{i}.txt", file=io.BytesIO(content))
            upload.size = len(content)
            service.upload(upload, hp_field="")
        result = service.list_files()
        assert result.total == 3

    def test_pagination(self, service):
        for i in range(25):
            content = f"content {i}".encode()
            upload = UploadFile(filename=f"file{i}.txt", file=io.BytesIO(content))
            upload.size = len(content)
            service.upload(upload, hp_field="")
        result = service.list_files(page=1)
        assert len(result.items) == 20
        result2 = service.list_files(page=2)
        assert len(result2.items) == 5

    def test_filter_by_query(self, service):
        for name in ["invoice.txt", "report.txt"]:
            content = b"dummy"
            upload = UploadFile(filename=name, file=io.BytesIO(content))
            upload.size = len(content)
            service.upload(upload, hp_field="")
        result = service.list_files(query="invoice")
        assert result.total == 1
        assert result.items[0].original_name == "invoice.txt"


class TestUpdateCategory:
    def test_update_category(self, service, session):
        content = b"hello"
        upload = UploadFile(filename="file.txt", file=io.BytesIO(content))
        upload.size = len(content)
        f = service.upload(upload, hp_field="")
        updated = service.update_category(f.id, 8)
        assert updated.category_id == 8

    def test_update_nonexistent_file_raises(self, service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            service.update_category(9999, 1)
        assert exc.value.status_code == 404


class TestTags:
    def test_add_tag(self, service):
        content = b"hello"
        upload = UploadFile(filename="file.txt", file=io.BytesIO(content))
        upload.size = len(content)
        f = service.upload(upload, hp_field="")
        updated = service.add_tag(f.id, "重要")
        assert any(t.name == "重要" for t in updated.tags)

    def test_remove_tag(self, service):
        content = b"hello"
        upload = UploadFile(filename="file.txt", file=io.BytesIO(content))
        upload.size = len(content)
        f = service.upload(upload, hp_field="")
        service.add_tag(f.id, "重要")
        updated = service.remove_tag(f.id, "重要")
        assert not any(t.name == "重要" for t in updated.tags)

    def test_add_duplicate_tag_is_idempotent(self, service):
        content = b"hello"
        upload = UploadFile(filename="file.txt", file=io.BytesIO(content))
        upload.size = len(content)
        f = service.upload(upload, hp_field="")
        service.add_tag(f.id, "重要")
        updated = service.add_tag(f.id, "重要")
        assert len([t for t in updated.tags if t.name == "重要"]) == 1


class TestDelete:
    def test_delete_removes_record(self, service):
        content = b"hello"
        upload = UploadFile(filename="file.txt", file=io.BytesIO(content))
        upload.size = len(content)
        f = service.upload(upload, hp_field="")
        service.delete(f.id)
        result = service.list_files()
        assert result.total == 0

    def test_delete_nonexistent_raises(self, service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            service.delete(9999)
        assert exc.value.status_code == 404
