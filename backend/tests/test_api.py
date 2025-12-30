from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def get_auth_headers():
    payload = {"username": "testuser", "password": "testpass123"}
    response = client.post("/api/auth/register", json=payload)
    if response.status_code != 200:
        response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    token = response.json()["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_check():
    response = client.get("/api/admin/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_collection_and_card():
    headers = get_auth_headers()
    collection_payload = {"name": "Basics", "description": "Starter deck"}
    response = client.post("/api/collections/", json=collection_payload, headers=headers)
    assert response.status_code == 200
    collection = response.json()
    assert collection["name"] == "Basics"

    card_payload = {
        "simplified": "NI HAO",
        "pinyin": "ni3 hao3",
        "meanings": ["hello"],
        "examples": [],
        "tags": ["HSK1"],
        "collection_ids": [collection["id"]]
    }
    response = client.post("/api/cards/", json=card_payload, headers=headers)
    assert response.status_code == 200
    card = response.json()
    assert card["simplified"] == "NI HAO"

    response = client.get(f"/api/cards/?collection={collection['id']}", headers=headers)
    assert response.status_code == 200
    assert any(item["id"] == card["id"] for item in response.json())
