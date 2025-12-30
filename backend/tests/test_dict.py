import json
from datetime import datetime

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import DictWord
from app.services.importer import normalize_pinyin_search

client = TestClient(app)


def get_auth_headers():
    payload = {"username": "dictuser", "password": "dictpass123"}
    response = client.post("/api/auth/register", json=payload)
    if response.status_code != 200:
        response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    token = response.json()["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def seed_word():
    db = SessionLocal()
    try:
        existing = db.query(DictWord).filter(DictWord.simplified == "你好").first()
        if existing:
            return
        word = DictWord(
            simplified="你好",
            traditional="你好",
            pinyin="ni3 hao3",
            pinyin_normalized=normalize_pinyin_search("ni3 hao3"),
            meanings=json.dumps(["hello"], ensure_ascii=False),
            examples=json.dumps([], ensure_ascii=False),
            tags=json.dumps(["HSK1"], ensure_ascii=False),
            hsk_level=1,
            pos="interjection",
            frequency=5.0,
            last_modified=datetime.utcnow()
        )
        db.add(word)
        db.commit()
    finally:
        db.close()


def test_dict_search_by_simplified():
    headers = get_auth_headers()
    seed_word()
    response = client.get("/api/dict/search?query=你好&mode=simplified", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 1
    assert any(item["simplified"] == "你好" for item in payload["results"])


def test_dict_search_filters():
    headers = get_auth_headers()
    seed_word()
    response = client.get("/api/dict/search?query=ni3&mode=pinyin&hsk=1&pos=interjection", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert any(item["simplified"] == "你好" for item in payload["results"])
