"""Configuration for the PQ Nihongo Private Shadowing AI Model Server.

All paths, model IDs, device modes, and limits are configurable via environment variables
(or .env in the ai-shadowing working directory). No machine-specific paths or secrets are hardcoded.
"""
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Server
    shadowing_host: str = Field(default="127.0.0.1", alias="SHADOWING_HOST")
    shadowing_port: int = Field(default=8001, alias="SHADOWING_PORT")
    shadowing_workers: int = Field(default=1, alias="SHADOWING_WORKERS")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Model identifiers / local paths
    shadowing_asr_model: str = Field(default="Qwen/Qwen3-ASR-0.6B", alias="SHADOWING_ASR_MODEL")
    shadowing_aligner_model: str = Field(
        default="Qwen/Qwen3-ForcedAligner-0.6B", alias="SHADOWING_ALIGNER_MODEL"
    )
    shadowing_asr_enabled: bool = Field(default=True, alias="SHADOWING_ASR_ENABLED")
    shadowing_aligner_enabled: bool = Field(default=True, alias="SHADOWING_ALIGNER_ENABLED")
    shadowing_pronunciation_enabled: bool = Field(default=True, alias="SHADOWING_PRONUNCIATION_ENABLED")
    shadowing_intonation_enabled: bool = Field(default=True, alias="SHADOWING_INTONATION_ENABLED")

    # Optional local feedback LLM (disabled by default; deterministic templates are used otherwise)
    shadowing_feedback_model_enabled: bool = Field(default=False, alias="SHADOWING_FEEDBACK_MODEL_ENABLED")
    shadowing_feedback_model: str = Field(default="Qwen/Qwen3-4B", alias="SHADOWING_FEEDBACK_MODEL")

    # Device & memory management (important for 4GB VRAM GPUs)
    shadowing_device: Literal["auto", "cpu", "cuda"] = Field(default="auto", alias="SHADOWING_DEVICE")
    shadowing_low_vram_mode: Literal["auto", "true", "false"] = Field(
        default="auto", alias="SHADOWING_LOW_VRAM_MODE"
    )
    shadowing_preload_models: bool = Field(default=False, alias="SHADOWING_PRELOAD_MODELS")
    shadowing_timeout_seconds: int = Field(default=120, alias="SHADOWING_TIMEOUT_SECONDS")

    # Model cache directories (optional; defaults to relative .cache inside ai-shadowing)
    hf_home: Optional[str] = Field(default=None, alias="HF_HOME")
    hatsuon_model_dir: Optional[str] = Field(default=None, alias="HATSUON_MODEL_DIR")

    # Audio validation limits
    shadowing_max_file_size_mb: float = Field(default=15.0, alias="SHADOWING_MAX_FILE_SIZE_MB")
    shadowing_min_audio_seconds: float = Field(default=0.35, alias="SHADOWING_MIN_AUDIO_SECONDS")
    shadowing_max_audio_seconds: float = Field(default=35.0, alias="SHADOWING_MAX_AUDIO_SECONDS")
    shadowing_target_sample_rate: int = Field(default=16000, alias="SHADOWING_TARGET_SAMPLE_RATE")

    def resolve_cache_dirs(self) -> tuple[Path, Path]:
        base_dir = Path(__file__).resolve().parents[2]
        hf_dir = Path(self.hf_home) if self.hf_home else (base_dir / ".cache" / "huggingface")
        hatsuon_dir = (
            Path(self.hatsuon_model_dir) if self.hatsuon_model_dir else (base_dir / ".cache" / "hatsuon")
        )
        return hf_dir, hatsuon_dir


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
