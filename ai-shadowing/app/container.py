"""Singleton service container for the Private Shadowing AI Model Server."""
import logging
import os

from app.config.settings import Settings, get_settings
from app.services.alignment_service import AlignmentService
from app.services.asr_service import AsrService
from app.services.audio_preprocessor import AudioPreprocessor
from app.services.device_manager import DeviceManager
from app.services.feedback_service import FeedbackService
from app.services.intonation_service import IntonationService
from app.services.pipeline_service import ShadowingPipelineService
from app.services.pronunciation_service import HatsuonPronunciationScorer, PronunciationScorer

logger = logging.getLogger(__name__)


class ServiceContainer:
    def __init__(self, settings: Settings):
        self.settings = settings
        hf_dir, hatsuon_dir = settings.resolve_cache_dirs()
        hf_dir.mkdir(parents=True, exist_ok=True)
        hatsuon_dir.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("HF_HOME", str(hf_dir))
        os.environ.setdefault("HATSUON_MODEL_DIR", str(hatsuon_dir))

        self.device_manager = DeviceManager(settings)
        self.preprocessor = AudioPreprocessor(settings)
        self.asr_service = AsrService(settings, self.device_manager)
        self.alignment_service = AlignmentService(settings, self.device_manager)
        self.pronunciation_scorer: PronunciationScorer = HatsuonPronunciationScorer(settings)
        self.intonation_service = IntonationService(settings)
        self.feedback_service = FeedbackService(settings, self.device_manager)
        self.pipeline_service = ShadowingPipelineService(
            settings=settings,
            device_manager=self.device_manager,
            preprocessor=self.preprocessor,
            asr_service=self.asr_service,
            alignment_service=self.alignment_service,
            pronunciation_scorer=self.pronunciation_scorer,
            intonation_service=self.intonation_service,
            feedback_service=self.feedback_service,
        )

    def preload_if_configured(self) -> None:
        if not self.settings.shadowing_preload_models:
            return
        logger.info("Preloading configured Shadowing models at startup...")
        if self.settings.shadowing_asr_enabled:
            try:
                self.asr_service.load()
            except Exception as exc:
                logger.error("ASR startup preload failed: %s", exc)
        if self.settings.shadowing_aligner_enabled:
            try:
                self.alignment_service.load()
            except Exception as exc:
                logger.error("ForcedAligner startup preload failed: %s", exc)


_container: ServiceContainer | None = None


def get_container() -> ServiceContainer:
    global _container
    if _container is None:
        _container = ServiceContainer(get_settings())
    return _container


def reset_container(container: ServiceContainer | None = None) -> None:
    global _container
    _container = container
