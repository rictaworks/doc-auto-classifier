import io
import pytest


class TestUploadAPI:
    def test_upload_success(self, client):
        content = b"invoice receipt payment"
        response = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("invoice.txt", io.BytesIO(content), "text/plain")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["original_name"] == "invoice.txt"
        assert data["category"]["name"] == "請求書・領収書"

    def test_upload_honeypot_blocked(self, client):
        content = b"hello"
        response = client.post(
            "/api/files/upload",
            data={"hp_field": "bot"},
            files={"file": ("file.txt", io.BytesIO(content), "text/plain")},
        )
        assert response.status_code == 400

    def test_upload_invalid_extension(self, client):
        content = b"exec"
        response = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("virus.exe", io.BytesIO(content), "application/octet-stream")},
        )
        assert response.status_code == 400

    def test_upload_empty_file(self, client):
        response = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
        )
        assert response.status_code == 400


class TestListAPI:
    def test_list_empty(self, client):
        response = client.get("/api/files")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_after_upload(self, client):
        content = b"hello"
        client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("a.txt", io.BytesIO(content), "text/plain")},
        )
        response = client.get("/api/files")
        assert response.json()["total"] == 1

    def test_list_search_by_query(self, client):
        for name in ["invoice.txt", "report.txt"]:
            client.post(
                "/api/files/upload",
                data={"hp_field": ""},
                files={"file": (name, io.BytesIO(b"dummy"), "text/plain")},
            )
        response = client.get("/api/files?query=invoice")
        assert response.json()["total"] == 1


class TestCategoryAPI:
    def test_list_categories(self, client):
        response = client.get("/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 8

    def test_update_category(self, client):
        content = b"hello"
        upload_resp = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("file.txt", io.BytesIO(content), "text/plain")},
        )
        file_id = upload_resp.json()["id"]
        response = client.patch(f"/api/files/{file_id}/category", json={"category_id": 2})
        assert response.status_code == 200
        assert response.json()["category"]["id"] == 2


class TestTagAPI:
    def test_add_tag(self, client):
        content = b"hello"
        upload_resp = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("file.txt", io.BytesIO(content), "text/plain")},
        )
        file_id = upload_resp.json()["id"]
        response = client.post(f"/api/files/{file_id}/tags", json={"name": "重要"})
        assert response.status_code == 200
        tags = response.json()["tags"]
        assert any(t["name"] == "重要" for t in tags)

    def test_remove_tag(self, client):
        content = b"hello"
        upload_resp = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("file.txt", io.BytesIO(content), "text/plain")},
        )
        file_id = upload_resp.json()["id"]
        client.post(f"/api/files/{file_id}/tags", json={"name": "重要"})
        response = client.delete(f"/api/files/{file_id}/tags/重要")
        assert response.status_code == 200
        tags = response.json()["tags"]
        assert not any(t["name"] == "重要" for t in tags)


class TestDownloadAPI:
    def test_download_file(self, client):
        content = b"hello download"
        upload_resp = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("dl.txt", io.BytesIO(content), "text/plain")},
        )
        file_id = upload_resp.json()["id"]
        response = client.get(f"/api/files/{file_id}/download")
        assert response.status_code == 200
        assert response.content == content

    def test_download_nonexistent(self, client):
        response = client.get("/api/files/9999/download")
        assert response.status_code == 404


class TestDeleteAPI:
    def test_delete_file(self, client):
        content = b"hello"
        upload_resp = client.post(
            "/api/files/upload",
            data={"hp_field": ""},
            files={"file": ("del.txt", io.BytesIO(content), "text/plain")},
        )
        file_id = upload_resp.json()["id"]
        response = client.delete(f"/api/files/{file_id}")
        assert response.status_code == 200
        list_resp = client.get("/api/files")
        assert list_resp.json()["total"] == 0

    def test_delete_nonexistent(self, client):
        response = client.delete("/api/files/9999")
        assert response.status_code == 404
