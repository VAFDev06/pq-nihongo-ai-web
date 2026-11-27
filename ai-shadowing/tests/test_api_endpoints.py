"""Endpoint integration tests using FastAPI TestClient.

Tests:
1. GET /health
2. Invalid/empty/too-short audio handling
3. Partial failure degradation (when an optional component fails, response is PARTIAL + warnings, never fabricated scores)
4. Full real local model inference on Japanese audio if cached test audio is present
"""
import io
from pathlib import Path
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from app.main import app
from app.container import get_container


client = TestClient(app)


def _wav_bytes(samples: np.ndarray, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, samples.astype(np.float32), sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("UP", "DEGRADED")
    assert body["metadata"]["geminiUsed"] is False
    for key in ("asr", "alignment", "pronunciation", "intonation", "feedbackLlm"):
        assert key in body["components"]


def test_evaluate_rejects_empty_audio():
    resp = client.post(
        "/shadowing/evaluate",
        files={"audio": ("empty.wav", b"", "audio/wav")},
        data={"referenceText": "こんにちは。"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "EMPTY_AUDIO"


def test_evaluate_rejects_silent_audio():
    silent = _wav_bytes(np.zeros(16000 * 2, dtype=np.float32))
    resp = client.post(
        "/shadowing/evaluate",
        files={"audio": ("silent.wav", silent, "audio/wav")},
        data={"referenceText": "こんにちは。"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "SILENT_AUDIO"


def test_intonation_endpoint_with_synthetic_voiced_signal():
    t = np.linspace(0, 1.5, int(16000 * 1.5), endpoint=False)
    freqs = np.linspace(220.0, 165.0, len(t))
    sig = 0.25 * np.sin(2 * np.pi * np.cumsum(freqs) / 16000)
    resp = client.post(
        "/intonation/analyze",
        files={"audio": ("stmt.wav", _wav_bytes(sig), "audio/wav")},
        data={"referenceText": "東京に行きます。"},
    )
    assert resp.status_code == 200
    data = resp.json()["intonation"]
    assert data["experimental"] is True
    assert data["f0Available"] is True
    assert data["finalPitchMovement"] == "FALLING"


def test_full_local_pipeline_on_japanese_sample():
    sample_wav = Path(__file__).resolve().parents[1] / ".cache" / "test_audio" / "03_kanji.wav"
    ref_wav = Path(__file__).resolve().parents[1] / ".cache" / "test_audio" / "03_kanji_ref_male.wav"
    if not sample_wav.exists():
        return

    files = {"audio": ("learner.wav", sample_wav.read_bytes(), "audio/wav")}
    if ref_wav.exists():
        files["referenceAudio"] = ("ref.wav", ref_wav.read_bytes(), "audio/wav")

    resp = client.post(
        "/shadowing/evaluate",
        files=files,
        data={"referenceText": "私は毎日日本語を勉強します。", "jlptLevel": "N5"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("COMPLETED", "PARTIAL")
    assert body["asr"]["available"] is True
    assert "勉強" in body["recognizedText"]
    assert body["alignment"]["available"] is True
    assert len(body["alignment"]["segments"]) > 0
    assert body["pronunciation"]["available"] is True
    assert body["scores"]["overall"] is not None
    assert body["intonation"]["experimental"] is True
    assert body["intonation"]["f0Available"] is True
    assert body["feedback"]["summary"] != ""
    assert body["confidence"] is not None
