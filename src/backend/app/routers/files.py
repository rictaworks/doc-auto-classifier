import uuid
from pathlib import Path

from fastapi import APIRouter, Cookie, Depends, File, Form, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.file_service import FileService
from app.config import UPLOAD_DIR

router = APIRouter(prefix="/api/files", tags=["files"])

SESSION_COOKIE = "doc_sid"


def get_session_id(response: Response, doc_sid: str | None = Cookie(default=None)) -> str:
    if doc_sid:
        return doc_sid
    new_sid = str(uuid.uuid4())
    response.set_cookie(
        key=SESSION_COOKIE,
        value=new_sid,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 365,  # 1年
    )
    return new_sid


def _service(
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
) -> FileService:
    return FileService(db=db, upload_dir=Path(UPLOAD_DIR), session_id=session_id)


class CategoryUpdate(BaseModel):
    category_id: int


class TagBody(BaseModel):
    name: str


def _file_response(f):
    return {
        "id": f.id,
        "original_name": f.original_name,
        "stored_name": f.stored_name,
        "file_size": f.file_size,
        "mime_type": f.mime_type,
        "summary": f.summary,
        "uploaded_at": f.uploaded_at.isoformat(),
        "updated_at": f.updated_at.isoformat(),
        "category": {
            "id": f.category.id,
            "name": f.category.name,
            "color_code": f.category.color_code,
        },
        "tags": [{"id": t.id, "name": t.name} for t in f.tags],
    }


@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    hp_field: str = Form(""),
    svc: FileService = Depends(_service),
):
    result = svc.upload(file, hp_field)
    return _file_response(result)


@router.get("")
def list_files(
    query: str = "",
    category_id: int | None = None,
    tag: str = "",
    page: int = 1,
    svc: FileService = Depends(_service),
):
    result = svc.list_files(query=query, category_id=category_id, tag=tag, page=page)
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": [_file_response(f) for f in result.items],
    }


@router.patch("/{file_id}/category")
def update_category(
    file_id: int,
    body: CategoryUpdate,
    svc: FileService = Depends(_service),
):
    result = svc.update_category(file_id, body.category_id)
    return _file_response(result)


@router.post("/{file_id}/tags")
def add_tag(
    file_id: int,
    body: TagBody,
    svc: FileService = Depends(_service),
):
    result = svc.add_tag(file_id, body.name)
    return _file_response(result)


@router.delete("/{file_id}/tags/{tag_name}")
def remove_tag(
    file_id: int,
    tag_name: str,
    svc: FileService = Depends(_service),
):
    result = svc.remove_tag(file_id, tag_name)
    return _file_response(result)


@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    svc: FileService = Depends(_service),
):
    path, mime_type, original_name = svc.download(file_id)
    return FileResponse(path=str(path), media_type=mime_type, filename=original_name)


@router.delete("/{file_id}")
def delete_file(
    file_id: int,
    svc: FileService = Depends(_service),
):
    svc.delete(file_id)
    return {"ok": True}
