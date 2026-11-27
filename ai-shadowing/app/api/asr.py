"""Internal ASR transcription endpoint (Qwen/Qwen3-ASR-0.6B)."""
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from app.container import get_container
from app.schemas.shadowing import AsrSection

router = APIRouter(prefix="/asr", tags=["ASR"])


def _transcribe_sync(raw_bytes: bytes, filename: Optional[str], content_type: Optional[str], ref_text: Optional[str], language: str) -> AsrSection:
    c = get_container()
    with c.preprocessor.prepare_audio(raw_bytes, filename, content_type) as prepared:
        result, _ = c.asr_service.transcribe(
            audio_path=str(prepared.wav_path),
            reference_text=ref_text,
            language=language,
        )
        return result


@router.post("/transcribe", response_model=AsrSection)
async def transcribe_audio(
    audio: UploadFile = File(...),
    referenceText: Optional[str] = Form(default=None),
    language: str = Form(default="ja"),
) -> AsrSection:
    raw_bytes = await audio.read()
    return await run_in_threadpool(_transcribe_sync, raw_bytes, audio.filename, audio.content_type, referenceText, language)
