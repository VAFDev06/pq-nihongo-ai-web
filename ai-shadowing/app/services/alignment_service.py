"""Japanese forced alignment service powered by Qwen/Qwen3-ForcedAligner-0.6B.

IMPORTANT: ForcedAligner produces timing timestamps for text units. It is NOT a standalone
pronunciation correctness model; timestamps are used for timing/rhythm and synchronized feedback.
"""
import logging
import threading
from typing import List, Optional, Tuple

import torch

from app.config.settings import Settings
from app.schemas.shadowing import AlignmentSection, AlignmentSegment
from app.services.device_manager import DeviceManager

logger = logging.getLogger(__name__)


class AlignmentService:
    def __init__(self, settings: Settings, device_manager: DeviceManager):
        self.settings = settings
        self.device_manager = device_manager
        self._aligner = None
        self._load_lock = threading.Lock()
        self._last_error: Optional[str] = None
        self._loaded_device: Optional[str] = None

    @property
    def is_loaded(self) -> bool:
        return self._aligner is not None

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    @property
    def loaded_device(self) -> Optional[str]:
        return self._loaded_device

    def load(self) -> None:
        if not self.settings.shadowing_aligner_enabled:
            return
        if self._aligner is not None:
            return
        with self._load_lock:
            if self._aligner is not None:
                return
            try:
                from qwen_asr import Qwen3ForcedAligner

                dtype = self.device_manager.preferred_dtype
                load_kwargs = {"dtype": dtype}
                if self.device_manager.target_device.startswith("cuda") and not self.device_manager.low_vram_mode:
                    load_kwargs["device_map"] = self.device_manager.target_device
                else:
                    load_kwargs["device_map"] = None

                logger.info(
                    "Loading ForcedAligner model %s (target=%s, low_vram=%s, dtype=%s)",
                    self.settings.shadowing_aligner_model,
                    self.device_manager.target_device,
                    self.device_manager.low_vram_mode,
                    dtype,
                )
                # Try local cache first to avoid slow HuggingFace Hub network metadata round-trips
                try:
                    aligner = Qwen3ForcedAligner.from_pretrained(
                        self.settings.shadowing_aligner_model,
                        local_files_only=True,
                        **load_kwargs,
                    )
                except OSError:
                    logger.info("Local cache miss for %s; downloading from HuggingFace Hub...", self.settings.shadowing_aligner_model)
                    aligner = Qwen3ForcedAligner.from_pretrained(
                        self.settings.shadowing_aligner_model,
                        **load_kwargs,
                    )
                self._aligner = aligner
                self._loaded_device = self.device_manager.target_device
                self._last_error = None
                logger.info("ForcedAligner model %s loaded successfully", self.settings.shadowing_aligner_model)
            except Exception as exc:
                self._last_error = f"{type(exc).__name__}: {exc}"
                logger.exception("Failed to load ForcedAligner %s", self.settings.shadowing_aligner_model)
                raise

    def align(
        self, audio_path: str, reference_text: str, language: str = "ja"
    ) -> Tuple[AlignmentSection, str]:
        if not self.settings.shadowing_aligner_enabled:
            return (
                AlignmentSection(available=False, engine=self.settings.shadowing_aligner_model, segments=[]),
                "disabled",
            )
        if not reference_text or not reference_text.strip():
            return (
                AlignmentSection(available=False, engine=self.settings.shadowing_aligner_model, segments=[]),
                "skipped",
            )

        self.load()
        assert self._aligner is not None

        qwen_lang = "Japanese" if language.lower() in ("ja", "jp", "japanese", "ja-jp") else language

        try:
            with self.device_manager.acquire_model(self._aligner, "Qwen3-ForcedAligner-0.6B") as used_dev:
                results = self._aligner.align(audio=audio_path, text=reference_text.strip(), language=qwen_lang)
        except torch.cuda.OutOfMemoryError:
            logger.warning("Retrying Qwen3-ForcedAligner-0.6B on CPU after CUDA OOM")
            results = self._aligner.align(audio=audio_path, text=reference_text.strip(), language=qwen_lang)
            used_dev = "cpu"

        segments: List[AlignmentSegment] = []
        if results and len(results) > 0:
            for item in results[0]:
                start = round(float(item.start_time), 3)
                end = round(float(item.end_time), 3)
                dur = round(max(0.0, end - start), 3)
                segments.append(
                    AlignmentSegment(
                        unit=str(item.text),
                        startTime=start,
                        endTime=end,
                        duration=dur,
                    )
                )

        return (
            AlignmentSection(
                available=True,
                engine=self.settings.shadowing_aligner_model,
                segments=segments,
            ),
            used_dev,
        )
