"""Internal Pronunciation Scoring endpoint (hatsuon adapter)."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.container import get_container

router = APIRouter(prefix="/pronunciation", tags=["Pronunciation"])


def _score_sync(raw_bytes: bytes, filename: Optional[str], content_type: Optional[str], ref_text: str) -> Dict[str, Any]:
    c = get_container()
    with c.preprocessor.prepare_audio(raw_bytes, filename, content_type) as prepared:
        out = c.pronunciation_scorer.score(
            audio_path=str(prepared.wav_path),
            reference_text=ref_text,
        )
        return {
            "referenceText": ref_text,
            "scores": {
                "overall": out.overall,
                "accuracy": out.accuracy,
                "completeness": out.completeness,
                "pitchAccent": out.pitch_accent,
                "timing": out.timing,
            },
            "confidence": out.confidence,
            "warnings": out.warnings,
            "pronunciation": out.section.model_dump(),
        }


@router.post("/score")
async def score_pronunciation(
    audio: UploadFile = File(...),
    referenceText: str = Form(...),
) -> Dict[str, Any]:
    if not referenceText or not referenceText.strip():
        raise HTTPException(status_code=400, detail="referenceText không được để trống.")
    raw_bytes = await audio.read()
    return await run_in_threadpool(_score_sync, raw_bytes, audio.filename, audio.content_type, referenceText.strip())
