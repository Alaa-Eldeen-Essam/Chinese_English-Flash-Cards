from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def get_auth_headers():
    payload = {"username": "datasetuser", "password": "datasetpass123"}
    response = client.post("/api/auth/register", json=payload)
    if response.status_code != 200:
        response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    token = response.json()["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dataset_catalog_and_selection():
    headers = get_auth_headers()
    response = client.get("/api/datasets/catalog", headers=headers)
    assert response.status_code == 200
    catalog = response.json()
    assert any(item["id"] == "cedict" for item in catalog)

    response = client.get("/api/datasets/selection", headers=headers)
    assert response.status_code == 200

    response = client.post(
        "/api/datasets/selection",
        json={"selected": ["cedict", "hsk-1", "missing"]},
        headers=headers
    )
    assert response.status_code == 200
    payload = response.json()
    assert "missing" not in payload["selected"]
    assert "cedict" in payload["selected"]


def test_dataset_pack_endpoint():
    headers = get_auth_headers()
    response = client.get("/api/datasets/pack?dataset_id=cedict&limit=5", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset_id"] == "cedict"
