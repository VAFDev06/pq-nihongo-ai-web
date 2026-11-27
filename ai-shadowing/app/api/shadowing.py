"""Unified Shadowing Evaluation endpoint combining ASR, Alignment, hatsuon, F0 Intonation & Feedback."""
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.container import get_container
from app.schemas.shadowing import ShadowingEvaluationResponse

router = APIRouter(prefix="/shadowing", tags=["Shadowing"])


def _run_evaluation_sync(
    learner_bytes: bytes,
    learner_filename: Optional[str],
    learner_content_type: Optional[str],
    reference_text: str,
    ref_bytes: Optional[bytes],
    ref_filename: Optional[str],
    ref_content_type: Optional[str],
    jlpt_level: Optional[str],
) -> ShadowingEvaluationResponse:
    c = get_container()
    with c.preprocessor.prepare_audio(learner_bytes, learner_filename, learner_content_type) as learner_prep:
        if ref_bytes:
            with c.preprocessor.prepare_audio(
                ref_bytes, ref_filename, ref_content_type, enforce_speech=False
            ) as ref_prep:
                return c.pipeline_service.evaluate(
                    learner_audio=learner_prep,
                    reference_text=reference_text,
                    reference_audio=ref_prep,
                    jlpt_level=jlpt_level,
                )

        return c.pipeline_service.evaluate(
            learner_audio=learner_prep,
            reference_text=reference_text,
            reference_audio=None,
            jlpt_level=jlpt_level,
        )


@router.post("/evaluate", response_model=ShadowingEvaluationResponse)
async def evaluate_shadowing(
    audio: UploadFile = File(...),
    referenceText: str = Form(...),
    referenceAudio: Optional[UploadFile] = File(default=None),
    jlptLevel: Optional[str] = Form(default=None),
) -> ShadowingEvaluationResponse:
    if not referenceText or not referenceText.strip():
        raise HTTPException(status_code=400, detail="referenceText không được để trống.")

    learner_bytes = await audio.read()
    ref_bytes = await referenceAudio.read() if referenceAudio is not None else None

    return await run_in_threadpool(
        _run_evaluation_sync,
        learner_bytes,
        audio.filename,
        audio.content_type,
        referenceText.strip(),
        ref_bytes,
        referenceAudio.filename if referenceAudio is not None else None,
        referenceAudio.content_type if referenceAudio is not None else None,
        jlptLevel,
    )
