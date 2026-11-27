"""Internal Forced Alignment endpoint (Qwen/Qwen3-ForcedAligner-0.6B)."""
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.container import get_container
from app.schemas.shadowing import AlignmentSection

router = APIRouter(prefix="/alignment", tags=["Alignment"])


def _align_sync(raw_bytes: bytes, filename: Optional[str], content_type: Optional[str], ref_text: str, language: str) -> AlignmentSection:
    c = get_container()
    with c.preprocessor.prepare_audio(raw_bytes, filename, content_type) as prepared:
        result, _ = c.alignment_service.align(
            audio_path=str(prepared.wav_path),
            reference_text=ref_text,
            language=language,
        )
        return result


@router.post("/align", response_model=AlignmentSection)
async def align_audio(
    audio: UploadFile = File(...),
    referenceText: str = Form(...),
    language: str = Form(default="ja"),
) -> AlignmentSection:
    if not referenceText or not referenceText.strip():
        raise HTTPException(status_code=400, detail="referenceText không được để trống.")
    raw_bytes = await audio.read()
    return await run_in_threadpool(_align_sync, raw_bytes, audio.filename, audio.content_type, referenceText.strip(), language)
