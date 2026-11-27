"""End-to-end Shadowing AI evaluation orchestrator with fault isolation.

Each component (ASR, Forced Alignment, Pronunciation Scoring, Experimental F0 Intonation,
Feedback Generation) runs independently with explicit error isolation so a failure in one
optional module degrades gracefully into PARTIAL results + clear warnings rather than
breaking the whole Shadowing request or fabricating scores.
"""
import logging
import time
from typing import List, Optional

from app.config.settings import Settings
from app.schemas.shadowing import (
    AlignmentSection,
    AsrSection,
    EvaluationMetadata,
    IntonationSection,
    PronunciationSection,
    ScoreBreakdown,
    ShadowingEvaluationResponse,
)
from app.services.alignment_service import AlignmentService
from app.services.asr_service import AsrService
from app.services.audio_preprocessor import AudioPreprocessor, PreparedAudio
from app.services.device_manager import DeviceManager
from app.services.feedback_service import FeedbackService
from app.services.intonation_service import IntonationService
from app.services.pronunciation_service import PronunciationScorer

logger = logging.getLogger(__name__)


class ShadowingPipelineService:
    def __init__(
        self,
        settings: Settings,
        device_manager: DeviceManager,
        preprocessor: AudioPreprocessor,
        asr_service: AsrService,
        alignment_service: AlignmentService,
        pronunciation_scorer: PronunciationScorer,
        intonation_service: IntonationService,
        feedback_service: FeedbackService,
    ):
        self.settings = settings
        self.device_manager = device_manager
        self.preprocessor = preprocessor
        self.asr_service = asr_service
        self.alignment_service = alignment_service
        self.pronunciation_scorer = pronunciation_scorer
        self.intonation_service = intonation_service
        self.feedback_service = feedback_service

    def evaluate(
        self,
        learner_audio: PreparedAudio,
        reference_text: str,
        reference_audio: Optional[PreparedAudio] = None,
        jlpt_level: Optional[str] = None,
    ) -> ShadowingEvaluationResponse:
        t_start = time.perf_counter()
        warnings: List[str] = list(learner_audio.quality.warnings)
        models_used: List[str] = []
        devices_seen: List[str] = []
        logger.info(
            "Shadowing evaluation started: duration=%.2fs, ref_len=%d, has_ref_audio=%s",
            learner_audio.quality.durationSec,
            len(reference_text or ""),
            reference_audio is not None,
        )

        # Step 3: ASR (Qwen3-ASR-0.6B)
        asr_section = AsrSection(available=False, engine=self.settings.shadowing_asr_model)
        try:
            asr_section, asr_dev = self.asr_service.transcribe(
                audio_path=str(learner_audio.wav_path),
                reference_text=reference_text,
                language="ja",
            )
            if asr_section.available:
                models_used.append(self.settings.shadowing_asr_model)
                devices_seen.append(asr_dev)
            if asr_section.uncertaintyNote:
                warnings.append(asr_section.uncertaintyNote)
        except Exception as exc:
            logger.warning("ASR step failed: %s", exc)
            warnings.append(f"Nhận diện giọng nói (ASR) gặp lỗi: {exc}")

        # Step 4: Forced Alignment (Qwen3-ForcedAligner-0.6B)
        alignment_section = AlignmentSection(available=False, engine=self.settings.shadowing_aligner_model)
        try:
            alignment_section, align_dev = self.alignment_service.align(
                audio_path=str(learner_audio.wav_path),
                reference_text=reference_text,
                language="ja",
            )
            if alignment_section.available:
                models_used.append(self.settings.shadowing_aligner_model)
                devices_seen.append(align_dev)
        except Exception as exc:
            logger.warning("Forced alignment step failed: %s", exc)
            warnings.append(f"Căn chỉnh thời gian âm thanh (ForcedAligner) gặp lỗi: {exc}")

        # Step 5: Pronunciation Scoring (hatsuon behind adapter)
        pron_section = PronunciationSection(available=False, engine=self.pronunciation_scorer.engine_name)
        pron_overall: Optional[float] = None
        pron_accuracy: Optional[float] = None
        pron_completeness: Optional[float] = None
        pron_pitch: Optional[float] = None
        pron_timing: Optional[float] = None
        pron_conf: Optional[float] = None
        try:
            pron_out = self.pronunciation_scorer.score(
                audio_path=str(learner_audio.wav_path),
                reference_text=reference_text,
            )
            pron_section = pron_out.section
            pron_overall = pron_out.overall
            pron_accuracy = pron_out.accuracy
            pron_completeness = pron_out.completeness
            pron_pitch = pron_out.pitch_accent
            pron_timing = pron_out.timing
            pron_conf = pron_out.confidence
            warnings.extend(pron_out.warnings)
            if pron_section.available:
                models_used.append(self.pronunciation_scorer.engine_name)
        except Exception as exc:
            logger.warning("Pronunciation scoring step failed: %s", exc)
            warnings.append(f"Chấm phát âm (hatsuon) gặp lỗi: {exc}")

        # Step 6: Experimental Sentence-level Intonation (F0 acoustic analysis)
        intonation_section = IntonationSection(experimental=True, f0Available=False)
        try:
            intonation_section, inton_warnings = self.intonation_service.analyze(
                learner_samples=learner_audio.samples,
                sr=learner_audio.sample_rate,
                reference_text=reference_text,
                reference_samples=reference_audio.samples if reference_audio else None,
            )
            warnings.extend(inton_warnings)
            if intonation_section.f0Available:
                models_used.append("f0-intonation-experimental")
        except Exception as exc:
            logger.warning("Intonation analysis step failed: %s", exc)
            warnings.append(f"Phân tích ngữ điệu câu (F0) gặp lỗi: {exc}")

        # Aggregate scores transparently (NEVER fabricate scores if component unavailable!)
        scores = ScoreBreakdown(
            overall=pron_overall,
            accuracy=pron_accuracy,
            completeness=pron_completeness,
            pitchAccent=pron_pitch,
            intonation=intonation_section.score,
            timing=pron_timing,
        )

        # Combine component confidences honestly
        conf_parts: List[float] = []
        if pron_conf is not None:
            conf_parts.append(pron_conf)
        if intonation_section.f0Available and intonation_section.confidence is not None:
            conf_parts.append(intonation_section.confidence)
        overall_confidence: Optional[float] = (
            round(sum(conf_parts) / len(conf_parts), 3) if conf_parts else None
        )

        # Step 8: Feedback generation (deterministic Vietnamese templates or optional Qwen3-4B)
        feedback_section = self.feedback_service.generate(
            reference_text=reference_text,
            asr=asr_section,
            scores=scores,
            pronunciation=pron_section,
            intonation=intonation_section,
            jlpt_level=jlpt_level,
        )
        if feedback_section.source == "QWEN3_4B":
            models_used.append(self.settings.shadowing_feedback_model)

        # Determine overall pipeline status
        any_success = any(
            [asr_section.available, alignment_section.available, pron_section.available, intonation_section.f0Available]
        )
        all_enabled_ok = (
            (not self.settings.shadowing_asr_enabled or asr_section.available)
            and (not self.settings.shadowing_aligner_enabled or alignment_section.available)
            and (not self.settings.shadowing_pronunciation_enabled or pron_section.available)
            and (not self.settings.shadowing_intonation_enabled or intonation_section.f0Available)
        )
        if not any_success:
            status = "FAILED"
        elif all_enabled_ok:
            status = "COMPLETED"
        else:
            status = "PARTIAL"

        # Deduplicate warnings while preserving order
        dedup_warnings = list(dict.fromkeys([w for w in warnings if w]))
        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        device_summary = next((d for d in devices_seen if d.startswith("cuda")), None) or (
            devices_seen[0] if devices_seen else self.device_manager.target_device
        )
        logger.info(
            "Shadowing evaluation completed: status=%s, overall=%s, elapsed=%dms, models=%s",
            status,
            scores.overall,
            elapsed_ms,
            ",".join(models_used),
        )

        return ShadowingEvaluationResponse(
            referenceText=reference_text.strip(),
            recognizedText=asr_section.recognizedText,
            status=status,
            scores=scores,
            pronunciation=pron_section,
            intonation=intonation_section,
            alignment=alignment_section,
            asr=asr_section,
            feedback=feedback_section,
            warnings=dedup_warnings,
            confidence=overall_confidence,
            metadata=EvaluationMetadata(
                audioDurationSec=learner_audio.quality.durationSec,
                sampleRate=learner_audio.sample_rate,
                deviceUsed=device_summary,
                processingTimeMs=elapsed_ms,
                modelsUsed=models_used,
                audioQuality=learner_audio.quality,
            ),
        )
