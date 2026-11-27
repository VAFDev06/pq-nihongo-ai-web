"""Internal Experimental Sentence-Level Intonation endpoint (F0 acoustic analysis)."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from app.container import get_container

router = APIRouter(prefix="/intonation", tags=["Intonation"])


def _analyze_sync(
    learner_bytes: bytes,
    learner_filename: Optional[str],
    learner_ct: Optional[str],
    ref_text: str,
    ref_bytes: Optional[bytes],
    ref_filename: Optional[str],
    ref_ct: Optional[str],
) -> Dict[str, Any]:
    c = get_container()
    with c.preprocessor.prepare_audio(learner_bytes, learner_filename, learner_ct) as learner_prep:
        if ref_bytes:
            with c.preprocessor.prepare_audio(ref_bytes, ref_filename, ref_ct, enforce_speech=False) as ref_prep:
                section, warnings = c.intonation_service.analyze(
                    learner_samples=learner_prep.samples,
                    sr=learner_prep.sample_rate,
                    reference_text=ref_text,
                    reference_samples=ref_prep.samples,
                )
                return {"intonation": section.model_dump(), "warnings": warnings}

        section, warnings = c.intonation_service.analyze(
            learner_samples=learner_prep.samples,
            sr=learner_prep.sample_rate,
            reference_text=ref_text,
            reference_samples=None,
        )
        return {"intonation": section.model_dump(), "warnings": warnings}


@router.post("/analyze")
async def analyze_intonation(
    audio: UploadFile = File(...),
    referenceText: str = Form(default=""),
    referenceAudio: Optional[UploadFile] = File(default=None),
) -> Dict[str, Any]:
    learner_bytes = await audio.read()
    ref_bytes = await referenceAudio.read() if referenceAudio is not None else None
    return await run_in_threadpool(
        _analyze_sync,
        learner_bytes,
        audio.filename,
        audio.content_type,
        referenceText,
        ref_bytes,
        referenceAudio.filename if referenceAudio is not None else None,
        referenceAudio.content_type if referenceAudio is not None else None,
    )
