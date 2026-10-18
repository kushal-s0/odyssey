"""HTTP/PDF contract tests only. Never load torch, an ASR model, or vLLM."""
import base64
import io
import os
import unittest
from unittest.mock import patch

os.environ["CLOUD_SERVICE_TOKEN"] = "synthetic-service-token-for-tests-12345"
import gateway
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject


class GatewayTests(unittest.TestCase):
    def setUp(self):
        # No context manager: the model-loading lifespan is deliberately not run.
        self.client = TestClient(gateway.app)
        self.headers = {"Authorization": "Bearer " + gateway.TOKEN}

    def test_authentication_precedes_body_parsing(self):
        result = self.client.post("/v1/documents/text", content=b"not-json")
        self.assertEqual(result.status_code, 401)
        result = self.client.post("/v1/documents/text", content=b"{}", headers={**self.headers, "Content-Length": "30000000"})
        self.assertEqual(result.status_code, 413)

    def test_readiness_does_not_claim_uninitialized_speech_is_ready(self):
        class FakeClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def get(self, url):
                class Response: status_code = 200
                return Response()
        with patch("gateway.httpx.AsyncClient", FakeClient):
            result = self.client.get("/health/ready", headers=self.headers)
        self.assertEqual(result.status_code, 503)
        self.assertFalse(gateway.speech["ready"])

    def test_pdf_text_retains_numbered_source_content_without_a_model(self):
        pdf = PdfWriter()
        page = pdf.add_blank_page(width=612, height=792)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 50 700 Td (Synthetic tailoring business for nearby families.) Tj ET")
        page[NameObject("/Contents")] = stream
        buffer = io.BytesIO()
        pdf.write(buffer)
        response = self.client.post("/v1/documents/text", json={"pdfBase64": base64.b64encode(buffer.getvalue()).decode()}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pages"][0]["page"], 1)
        self.assertIn("Synthetic tailoring business", response.json()["pages"][0]["text"])
        self.assertEqual(response.json()["ocrPages"], [])

    def test_invalid_pdf_and_automatic_speech_language_fail_explicitly(self):
        response = self.client.post("/v1/documents/text", json={"pdfBase64": "not base64"}, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/v1/audio/transcriptions", files={"file": ("recording.wav", b"synthetic")}, data={"language_code": "auto"}, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        self.assertIn("Select", response.text)

    def test_generation_requires_strict_schema(self):
        response = self.client.post("/v1/chat/completions", json={"model": "Qwen/Qwen3.5-9B", "messages": [{"role": "user", "content": "synthetic"}], "response_format": {"type": "json_object"}}, headers=self.headers)
        self.assertEqual(response.status_code, 422)
        self.assertIsNone(gateway.speech["indic"])


    def test_generation_forwards_strict_schema_and_cpu_timeout(self):
        observed = {}
        class FakeClient:
            def __init__(self, **kwargs): observed.update(kwargs)
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def post(self, url, **kwargs):
                observed.update(kwargs)
                class Response:
                    status_code = 200
                    def json(self):
                        return {"choices": [{"finish_reason": "stop", "message": {"content": '{"ok":true}'}}]}
                return Response()
        body = {"model": "Qwen/Qwen3.5-9B", "messages": [{"role": "user", "content": "synthetic"}],
            "response_format": {"type": "json_schema", "json_schema": {"strict": True, "schema": {
                "type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"], "additionalProperties": False}}}}
        with patch("gateway.httpx.AsyncClient", FakeClient), patch("gateway.LLM_TIMEOUT", 900):
            result = self.client.post("/v1/chat/completions", json=body, headers=self.headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(observed["timeout"], 900)
        self.assertEqual(observed["json"]["chat_template_kwargs"], {"enable_thinking": False})
        self.assertTrue(observed["json"]["response_format"]["json_schema"]["strict"])

    def test_generation_withholds_invalid_schema_output_and_truncation(self):
        body = {"model": "Qwen/Qwen3.5-9B", "messages": [{"role": "user", "content": "synthetic"}],
            "response_format": {"type": "json_schema", "json_schema": {"strict": True, "schema": {
                "type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"], "additionalProperties": False}}}}
        for content, finish in [('{"ok":"invented"}', 'stop'), ('{"ok":true,"extra":1}', 'stop'), ('{"ok":true}', 'length'), ('not JSON', 'stop')]:
            class FakeClient:
                def __init__(self, **kwargs): pass
                async def __aenter__(self): return self
                async def __aexit__(self, *args): pass
                async def post(self, url, **kwargs):
                    class Response:
                        status_code = 200
                        def json(self):
                            return {"choices": [{"finish_reason": finish, "message": {"content": content}}]}
                    return Response()
            with self.subTest(content=content, finish=finish), patch("gateway.httpx.AsyncClient", FakeClient):
                result = self.client.post("/v1/chat/completions", json=body, headers=self.headers)
                self.assertEqual(result.status_code, 422)

    def test_missing_or_invalid_schema_is_rejected_before_inference(self):
        for schema in [None, {}, {"type": "imaginary"}]:
            result = self.client.post("/v1/chat/completions", json={"model": "Qwen/Qwen3.5-9B",
                "messages": [{"role": "user", "content": "synthetic"}],
                "response_format": {"type": "json_schema", "json_schema": {"strict": True, "schema": schema}}}, headers=self.headers)
            self.assertEqual(result.status_code, 422)


if __name__ == "__main__":
    unittest.main()
