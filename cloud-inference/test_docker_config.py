"""Static packaging checks; no Docker daemon, downloads or inference."""
from pathlib import Path
import unittest
import yaml

ROOT = Path(__file__).parent

class DockerConfigTests(unittest.TestCase):
    def test_only_authenticated_gateway_is_published_on_loopback(self):
        config = yaml.safe_load((ROOT / "compose.yaml").read_text())
        services = config["services"]
        self.assertNotIn("ports", services["llm"])
        self.assertEqual(services["gateway"]["ports"], ["127.0.0.1:8080:8080"])
        self.assertIn("CLOUD_SERVICE_TOKEN", services["gateway"]["environment"])
        self.assertIn("LLAMA_API_KEY", services["llm"]["environment"])
        for service in services.values():
            self.assertNotIn("gpus", service)
            self.assertNotIn("env_file", service)
            self.assertEqual(service["cap_drop"], ["ALL"])

    def test_original_qwen_model_is_pinned_and_cpu_only(self):
        config = yaml.safe_load((ROOT / "compose.yaml").read_text())
        args = config["services"]["llm"]["command"]
        self.assertEqual(args[args.index("--alias") + 1], "Qwen/Qwen3.5-9B")
        self.assertEqual(args[args.index("--gpu-layers") + 1], "0")
        url = args[args.index("--model-url") + 1]
        self.assertIn("3885219b6810b007914f3a7950a8d1b469d598a5", url)
        self.assertTrue(url.endswith("Qwen3.5-9B-Q4_K_M.gguf"))
        ignore = (ROOT / ".dockerignore").read_text().splitlines()
        self.assertEqual(ignore[0], "*")
        self.assertNotIn("!.env", ignore)
        self.assertIn("-DGGML_CUDA=OFF", (ROOT / "Dockerfile.llm").read_text())
