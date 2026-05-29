import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./data/test.db"
os.environ["UPLOAD_DIR"] = "/tmp/test_uploads"
os.environ["SESSION_SECRET"] = "test-secret"

from app.database import Base, get_db
from app.main import app, _MASTER_CATEGORIES
from app.models import Category

TEST_DB_URL = "sqlite:///./data/test.db"

_SEED_CATEGORIES = _MASTER_CATEGORIES


def _seed(session):
    for row in _SEED_CATEGORIES:
        if not session.query(Category).filter(Category.id == row["id"]).first():
            session.add(Category(**row))
    session.commit()


@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    _seed(s)
    s.close()
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_engine):
    Session = sessionmaker(bind=db_engine)

    def override_get_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
