"""Japanese Automatic Speech Recognition service powered by Qwen/Qwen3-ASR-0.6B."""
from difflib import SequenceMatcher
import logging
import re
import threading
import unicodedata
from typing import Optional, Tuple

import torch

from app.config.settings import Settings
from app.schemas.shadowing import AsrSection
from app.services.device_manager import DeviceManager

logger = logging.getLogger(__name__)

_PUNCT_RE = re.compile(r"[\s、。！？!?,.·・~〜…—\-「」『』（）()\"']+")


def normalize_japanese_text(text: str) -> str:
    if not text:
        return ""
    nfkc = unicodedata.normalize("NFKC", text)
    return _PUNCT_RE.sub("", nfkc)


def _to_kana_reading(text: str) -> str:
    norm = normalize_japanese_text(text)
    if not norm:
        return ""
    try:
        import pyopenjtalk

        kana = pyopenjtalk.g2p(norm, kana=True)
        return normalize_japanese_text(kana)
    except Exception:
        return norm


def compute_char_similarity(reference_text: str, recognized_text: str) -> Optional[float]:
    ref = normalize_japanese_text(reference_text)
    rec = normalize_japanese_text(recognized_text)
    if not ref:
        return None
    if not rec:
        return 0.0
    surface_ratio = SequenceMatcher(None, ref, rec).ratio()
    # Compare kana reading too so Hiragana reference vs Kanji ASR transcription (same pronunciation) is not falsely penalized
    ref_kana = _to_kana_reading(ref)
    rec_kana = _to_kana_reading(rec)
    kana_ratio = SequenceMatcher(None, ref_kana, rec_kana).ratio() if (ref_kana and rec_kana) else surface_ratio
    return round(max(surface_ratio, kana_ratio) * 100.0, 1)


class AsrService:
    def __init__(self, settings: Settings, device_manager: DeviceManager):
        self.settings = settings
        self.device_manager = device_manager
        self._model = None
        self._load_lock = threading.Lock()
        self._last_error: Optional[str] = None
        self._loaded_device: Optional[str] = None

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    @property
    def loaded_device(self) -> Optional[str]:
        return self._loaded_device

    def load(self) -> None:
        if not self.settings.shadowing_asr_enabled:
            return
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            try:
                from qwen_asr import Qwen3ASRModel

                dtype = self.device_manager.preferred_dtype
                # Load without accelerate device_map when in low-VRAM mode so .model.to(...) works cleanly.
                load_kwargs = {"dtype": dtype}
                if self.device_manager.target_device.startswith("cuda") and not self.device_manager.low_vram_mode:
                    load_kwargs["device_map"] = self.device_manager.target_device
                else:
                    load_kwargs["device_map"] = None

                logger.info(
                    "Loading ASR model %s (target=%s, low_vram=%s, dtype=%s)",
                    self.settings.shadowing_asr_model,
                    self.device_manager.target_device,
                    self.device_manager.low_vram_mode,
                    dtype,
                )
                # Try local cache first to avoid slow HuggingFace Hub network metadata round-trips
                try:
                    model = Qwen3ASRModel.from_pretrained(
                        self.settings.shadowing_asr_model,
                        max_inference_batch_size=1,
                        max_new_tokens=256,
                        local_files_only=True,
                        **load_kwargs,
                    )
                except OSError:
                    logger.info("Local cache miss for %s; downloading from HuggingFace Hub...", self.settings.shadowing_asr_model)
                    model = Qwen3ASRModel.from_pretrained(
                        self.settings.shadowing_asr_model,
                        max_inference_batch_size=1,
                        max_new_tokens=256,
                        **load_kwargs,
                    )
                self._model = model
                self._loaded_device = self.device_manager.target_device
                self._last_error = None
                logger.info("ASR model %s loaded successfully", self.settings.shadowing_asr_model)
            except Exception as exc:
                self._last_error = f"{type(exc).__name__}: {exc}"
                logger.exception("Failed to load ASR model %s", self.settings.shadowing_asr_model)
                raise

    def transcribe(
        self, audio_path: str, reference_text: Optional[str] = None, language: str = "ja"
    ) -> Tuple[AsrSection, str]:
        """Transcribe Japanese speech using Qwen3-ASR-0.6B.

        Returns (AsrSection, device_used).
        """
        if not self.settings.shadowing_asr_enabled:
            return (
                AsrSection(
                    available=False,
                    engine=self.settings.shadowing_asr_model,
                    language=language,
                    recognizedText="",
                    uncertaintyNote="ASR bị tắt trong cấu hình server.",
                ),
                "disabled",
            )

        self.load()
        assert self._model is not None

        qwen_lang = "Japanese" if language.lower() in ("ja", "jp", "japanese", "ja-jp") else language

        try:
            with self.device_manager.acquire_model(self._model, "Qwen3-ASR-0.6B") as used_dev:
                results = self._model.transcribe(audio=audio_path, language=qwen_lang)
        except torch.cuda.OutOfMemoryError:
            logger.warning("Retrying Qwen3-ASR-0.6B on CPU after CUDA OOM")
            results = self._model.transcribe(audio=audio_path, language=qwen_lang)
            used_dev = "cpu"

        recognized = ""
        detected_lang = "ja"
        if results and len(results) > 0:
            recognized = (getattr(results[0], "text", "") or "").strip()
            raw_lang = getattr(results[0], "language", "") or ""
            if raw_lang:
                detected_lang = "ja" if raw_lang.lower() == "japanese" else raw_lang

        char_sim = compute_char_similarity(reference_text or "", recognized) if reference_text else None
        uncertainty_note: Optional[str] = None
        if not recognized:
            uncertainty_note = "ASR không nhận diện được lời nói tiếng Nhật rõ ràng từ bản ghi."
        elif char_sim is not None and char_sim < 60.0:
            uncertainty_note = (
                "Văn bản ASR nhận diện khác đáng kể so với câu mẫu — có thể do phát âm chưa rõ, "
                "đọc sai từ, hoặc giới hạn nhận diện của ASR với giọng người học."
            )

        return (
            AsrSection(
                available=True,
                engine=self.settings.shadowing_asr_model,
                language=detected_lang,
                recognizedText=recognized,
                characterSimilarity=char_sim,
                uncertaintyNote=uncertainty_note,
            ),
            used_dev,
        )
