"""Health check endpoint for the Private Shadowing AI Model Server."""
from fastapi import APIRouter

from app.container import get_container
from app.schemas.shadowing import HealthComponentStatus, HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    c = get_container()
    s = c.settings
    dm = c.device_manager

    components = {
        "asr": HealthComponentStatus(
            enabled=s.shadowing_asr_enabled,
            loaded=c.asr_service.is_loaded,
            ready=s.shadowing_asr_enabled and (c.asr_service.last_error is None),
            model=s.shadowing_asr_model,
            device=c.asr_service.loaded_device or dm.target_device,
            error=c.asr_service.last_error,
        ),
        "alignment": HealthComponentStatus(
            enabled=s.shadowing_aligner_enabled,
            loaded=c.alignment_service.is_loaded,
            ready=s.shadowing_aligner_enabled and (c.alignment_service.last_error is None),
            model=s.shadowing_aligner_model,
            device=c.alignment_service.loaded_device or dm.target_device,
            error=c.alignment_service.last_error,
        ),
        "pronunciation": HealthComponentStatus(
            enabled=s.shadowing_pronunciation_enabled,
            loaded=c.pronunciation_scorer.is_ready,
            ready=s.shadowing_pronunciation_enabled and c.pronunciation_scorer.is_ready,
            model=c.pronunciation_scorer.engine_name,
            device="cpu",
            error=c.pronunciation_scorer.last_error,
        ),
        "intonation": HealthComponentStatus(
            enabled=s.shadowing_intonation_enabled,
            loaded=True,
            ready=s.shadowing_intonation_enabled,
            model="f0-pyin-dtw-experimental",
            device="cpu",
            error=None,
        ),
        "feedbackLlm": HealthComponentStatus(
            enabled=s.shadowing_feedback_model_enabled,
            loaded=c.feedback_service.is_llm_loaded,
            ready=True,  # deterministic Vietnamese templates are always ready
            model=s.shadowing_feedback_model if s.shadowing_feedback_model_enabled else "deterministic-templates",
            device=dm.target_device if s.shadowing_feedback_model_enabled else "cpu",
            error=c.feedback_service.last_error,
        ),
    }

    core_ok = components["asr"].ready or components["pronunciation"].ready or components["intonation"].ready
    return HealthResponse(
        status="UP" if core_ok else "DEGRADED",
        device=dm.target_device,
        cudaAvailable=dm.cuda_available,
        gpuName=dm.gpu_name,
        gpuVramMb=dm.gpu_vram_mb,
        lowVramMode=dm.low_vram_mode,
        components=components,
        metadata={
            "maxFileSizeMb": s.shadowing_max_file_size_mb,
            "maxAudioSeconds": s.shadowing_max_audio_seconds,
            "geminiUsed": False,
        },
    )
