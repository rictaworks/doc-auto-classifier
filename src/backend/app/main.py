from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.database import Base, engine, SessionLocal
from app.models import Category
from app.routers import files as files_router
from app.routers import categories as categories_router

Base.metadata.create_all(bind=engine)

_MASTER_CATEGORIES = [
    {"id": 1, "name": "請求書・領収書", "color_code": "#FF6B6B", "sort_order": 1},
    {"id": 2, "name": "契約書",         "color_code": "#4ECDC4", "sort_order": 2},
    {"id": 3, "name": "報告書・レポート","color_code": "#45B7D1", "sort_order": 3},
    {"id": 4, "name": "議事録・会議",   "color_code": "#96CEB4", "sort_order": 4},
    {"id": 5, "name": "名刺・連絡先",   "color_code": "#FFEAA7", "sort_order": 5},
    {"id": 6, "name": "申請書・フォーム","color_code": "#DDA0DD", "sort_order": 6},
    {"id": 7, "name": "マニュアル・手順書","color_code": "#98D8C8","sort_order": 7},
    {"id": 8, "name": "その他",          "color_code": "#B0B0B0", "sort_order": 8},
]


def _seed_categories() -> None:
    db = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            for row in _MASTER_CATEGORIES:
                db.add(Category(**row))
            db.commit()
    finally:
        db.close()


_seed_categories()

app = FastAPI(title="書類自動分類ツール", version="1.0.0")

_base_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(_base_dir / "static")), name="static")
templates = Jinja2Templates(directory=str(_base_dir / "templates"))

app.include_router(files_router.router)
app.include_router(categories_router.router)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
