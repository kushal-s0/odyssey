# Selected model provenance and use

These are downloaded third-party pretrained weights, not models trained by this project. Canonical IDs/revisions are in app/worker/manifest.py and exported models/manifest.json; downloaded-file SHA256 values are recorded by scripts/download_models.py. Inference loads local snapshots only, with no automatic hosted/paid fallback. Pipeline manifests prevent mixing incompatible stage publications. Original organizer data is private and has no established redistribution license.

| Purpose | Selected upstream model | License | Current evidence |
|---|---|---|---|
| Grounded business extraction and domain judgments | Qwen/Qwen3-VL-2B-Instruct | Apache-2.0 | Real English pipeline; six dimensions and server-side scoring |
| Related-idea embeddings | sentence-transformers/all-MiniLM-L6-v2 | Apache-2.0 | Frozen CPU embeddings; retrieval calibration remains incomplete |
| Scanned-source OCR | PaddlePaddle/PaddleOCR-VL-1.5 | Apache-2.0 | Specialized native Transformers adapter; actual scan acceptance tracked in T10 |
| Source-language speech transcription | openai/whisper-large-v3-turbo | MIT | Actual Hindi sample smoke; population WER/human validation not measured |
| Odia source-language speech | ARTPARK-IISc/whisper-large-v3-vaani-odia | Apache-2.0 | Actual 6.45-second chunk smoke, 54 Odia characters; unvalidated against a human reference |
| Local regional translation | facebook/nllb-200-distilled-600M | **CC-BY-NC-4.0** | Actual synthetic Hindi/English smoke; English/Hindi review available, other languages unvalidated |

NLLB is selected for this **noncommercial hackathon prototype**. Its upstream model card says it is a research model, not released for production deployment. Do not represent this selection as a licensed commercial production configuration. A broader release needs a suitable license/model and separately measured quality. No paid service or license purchase is authorized here.

The previously planned gated IndicTrans2/IndicConformer artifacts remain recorded for historical provenance, but are not the selected live translation/speech adapters. Their access probes failed; their presence in old plans is not an integration claim. The rejected custom relevance experiment remains rejected.

Optional Groq is a separate external explanation service. GROQ_MODEL is configurable and defaults to a model currently listed on Groq's free plan. An API key does not prove free-plan status or unlimited quota. No local business assessment depends on Groq availability, and it cannot overwrite saved ratings/totals.

Upstream primary references: [Qwen](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct), [MiniLM](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), [PaddleOCR](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.5), [Whisper](https://huggingface.co/openai/whisper-large-v3-turbo), [NLLB](https://huggingface.co/facebook/nllb-200-distilled-600M), [Groq models](https://console.groq.com/docs/models).

Odia model citation: Sujith Pulikodan et al., **VAANI: Capturing the language landscape for an inclusive digital India** (2026), arXiv:2603.28714. Upstream model and usage: https://huggingface.co/ARTPARK-IISc/whisper-large-v3-vaani-odia . It is third-party fine-tuning, not our training.
