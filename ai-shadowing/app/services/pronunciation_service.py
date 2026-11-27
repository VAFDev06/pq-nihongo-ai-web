"""Japanese pronunciation scoring service with hatsuon isolated behind a clean adapter interface.

Adapter pattern ensures hatsuon (currently alpha 0.1.x, calibrated on native Japanese speech)
can be swapped or supplemented with another scorer without modifying pipeline or backend code.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import logging
import os
from pathlib import Path
import threading
from typing import List, Optional, Tuple

from app.config.settings import Settings
from app.schemas.shadowing import (
    InsertionItem,
    MoraEvaluation,
    PronunciationErrorItem,
    PronunciationSection,
    SpecialMoraSummary,
    WordPronunciationEvaluation,
)

logger = logging.getLogger(__name__)

_SOKUON_CHARS = {"っ", "ッ"}
_MORAIC_N_CHARS = {"ん", "ン"}
_LONG_VOWEL_CHARS = {"ー"}

_WARNING_LABELS_VI = {
    "no_speech": "hatsuon không phát hiện rõ giọng nói trong bản ghi.",
    "content_mismatch": "Nội dung đọc có vẻ chưa khớp với câu mẫu (hatsuon content_mismatch).",
    "pitch_unreliable": "Tín hiệu cao độ không đủ ổn định để chấm trọng âm Tokyo (pitch_unreliable).",
    "short_audio": "Đoạn ghi âm quá ngắn cho đánh giá chi tiết.",
    "clipping": "Âm thanh bị vỡ tiếng (clipping).",
    "noisy": "Âm thanh có nhiều nhiễu nền.",
}

_ACCENT_OUTCOME_VI = {
    "correct": "đúng trọng âm Tokyo",
    "missing_fall": "thiếu điểm hạ giọng (accent drop)",
    "flat_for_accented": "đọc phẳng ở từ có trọng âm rơi (thiếu hạ giọng)",
    "wrong_nucleus": "vị trí hạt nhân trọng âm chưa khớp chuẩn Tokyo",
    "early_fall": "hạ giọng sớm hơn chuẩn Tokyo",
    "late_fall": "hạ giọng muộn hơn chuẩn Tokyo",
    "fall_for_unaccented": "bị hạ giọng ở từ không có trọng âm (Heiban)",
    "unreliable": "chưa đủ độ tin cậy để kết luận trọng âm",
    "unknown": "không xác định",
}

_WARNING_LABELS_VI_EXTRA = {
    "partial_reading_uncertain": "Một số chữ Kanji có nhiều cách đọc (hatsuon partial_reading_uncertain).",
}


def _classify_special_mora(kana: str) -> Optional[str]:
    if not kana:
        return None
    if kana in _SOKUON_CHARS:
        return "SOKUON"
    if kana in _MORAIC_N_CHARS:
        return "MORAIC_N"
    if kana in _LONG_VOWEL_CHARS:
        return "LONG_VOWEL"
    return None


def _enum_val(v) -> Optional[str]:
    if v is None:
        return None
    return v.value if hasattr(v, "value") else str(v)


@dataclass
class PronunciationScoreOutput:
    section: PronunciationSection
    overall: Optional[float] = None
    accuracy: Optional[float] = None
    completeness: Optional[float] = None
    pitch_accent: Optional[float] = None
    timing: Optional[float] = None
    confidence: Optional[float] = None
    warnings: List[str] = field(default_factory=list)


class PronunciationScorer(ABC):
    """Abstract adapter for Japanese pronunciation scoring engines."""

    @property
    @abstractmethod
    def engine_name(self) -> str:
        ...

    @property
    @abstractmethod
    def is_ready(self) -> bool:
        ...

    @property
    @abstractmethod
    def last_error(self) -> Optional[str]:
        ...

    @abstractmethod
    def score(self, audio_path: str, reference_text: str) -> PronunciationScoreOutput:
        ...


class HatsuonPronunciationScorer(PronunciationScorer):
    """Adapter wrapping `hatsuon` (CPU ONNX int8 Japanese pronunciation scorer)."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._lock = threading.Lock()
        self._ready = False
        self._last_error: Optional[str] = None
        _, self._model_dir = settings.resolve_cache_dirs()
        os.environ.setdefault("HATSUON_MODEL_DIR", str(self._model_dir))
        self._check_model_presence()

    def _check_model_presence(self) -> None:
        model_file = self._model_dir / "model.onnx"
        if model_file.exists():
            self._ready = True
            self._last_error = None
        else:
            self._ready = False
            self._last_error = (
                f"Chưa tìm thấy acoustic model của hatsuon tại {model_file}. "
                "Hãy chạy `hatsuon-export --out <HATSUON_MODEL_DIR>` một lần để cài đặt."
            )

    @property
    def engine_name(self) -> str:
        return "hatsuon"

    @property
    def is_ready(self) -> bool:
        if not self._ready:
            self._check_model_presence()
        return self._ready

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def score(self, audio_path: str, reference_text: str) -> PronunciationScoreOutput:
        if not self.settings.shadowing_pronunciation_enabled:
            return PronunciationScoreOutput(
                section=PronunciationSection(available=False, engine=self.engine_name),
                warnings=["Mô-đun chấm điểm phát âm (hatsuon) đang bị tắt trong cấu hình."],
            )

        if not self.is_ready:
            return PronunciationScoreOutput(
                section=PronunciationSection(available=False, engine=self.engine_name),
                warnings=[self._last_error or "Acoustic model hatsuon chưa sẵn sàng."],
            )

        import hatsuon

        os.environ["HATSUON_MODEL_DIR"] = str(self._model_dir)
        with self._lock:
            try:
                res = hatsuon.score(audio_path, reference_text.strip())
                self._last_error = None
            except Exception as exc:
                self._last_error = f"{type(exc).__name__}: {exc}"
                logger.warning("hatsuon.score failed: %s", self._last_error)
                return PronunciationScoreOutput(
                    section=PronunciationSection(available=False, engine=self.engine_name),
                    warnings=[f"Không thể chấm phát âm bằng hatsuon: {exc}"],
                )

        mora_results: List[MoraEvaluation] = []
        word_results: List[WordPronunciationEvaluation] = []
        errors: List[PronunciationErrorItem] = []
        special_summary = SpecialMoraSummary()

        for word in getattr(res, "words", []) or []:
            accent_outcome = _enum_val(getattr(word, "accent", None)) or "unknown"
            word_morae: List[MoraEvaluation] = []

            for mora in getattr(word, "morae", []) or []:
                kana = str(getattr(mora, "kana", ""))
                status_str = _enum_val(getattr(mora, "status", None)) or "unknown"
                dur_str = _enum_val(getattr(mora, "duration", None))
                pitch_str = _enum_val(getattr(mora, "pitch_status", None))
                special_type = _classify_special_mora(kana)
                mora_score = round(float(mora.score), 1) if getattr(mora, "score", None) is not None else None

                if special_type == "SOKUON":
                    special_summary.sokuonTotal += 1
                elif special_type == "MORAIC_N":
                    special_summary.moraicNTotal += 1
                elif special_type == "LONG_VOWEL":
                    special_summary.longVowelTotal += 1

                m_eval = MoraEvaluation(
                    kana=kana,
                    wordSurface=word.surface,
                    phonemes=list(getattr(mora, "phonemes", []) or []),
                    startTime=round(float(mora.start), 3) if mora.start is not None else None,
                    endTime=round(float(mora.end), 3) if mora.end is not None else None,
                    score=mora_score,
                    status=status_str,
                    substitutedBy=getattr(mora, "substituted_by", None),
                    durationStatus=dur_str,
                    expectedPitchLevel=getattr(mora, "expected_level", None),
                    observedSemitone=(
                        round(float(mora.observed_st), 2) if getattr(mora, "observed_st", None) is not None else None
                    ),
                    pitchStatus=pitch_str,
                    devoicedExpected=bool(getattr(mora, "devoiced_expected", False)),
                    isSpecialMora=special_type is not None,
                    specialMoraType=special_type,
                )
                word_morae.append(m_eval)
                mora_results.append(m_eval)

                # Collect concrete mora-level & special-mora errors
                has_special_issue = False
                if status_str in ("mispronounced", "deleted", "substituted"):
                    has_special_issue = special_type is not None
                    errors.append(
                        PronunciationErrorItem(
                            type="MORA_DELETED" if status_str == "deleted" else "MORA_MISPRONOUNCED",
                            word=word.surface,
                            reading=word.reading,
                            mora=kana,
                            expected=kana,
                            observed=getattr(mora, "substituted_by", None) or ("bị bỏ sót" if status_str == "deleted" else None),
                            severity="HIGH" if status_str == "deleted" else "MEDIUM",
                            detail=(
                                f"Âm tiết (mora) 「{kana}」 trong từ 「{word.surface}」 ({word.reading}) "
                                + ("bị nuốt/bỏ sót." if status_str == "deleted" else f"phát âm chưa chuẩn (điểm {mora_score}).")
                            ),
                        )
                    )

                if dur_str is not None and dur_str != "ok":
                    has_special_issue = special_type is not None or has_special_issue
                    dur_vi = "quá ngắn" if "short" in dur_str else ("quá dài" if "long" in dur_str else dur_str)
                    errors.append(
                        PronunciationErrorItem(
                            type="SPECIAL_MORA_DURATION" if special_type else "MORA_DURATION",
                            word=word.surface,
                            reading=word.reading,
                            mora=kana,
                            expected="độ dài 1 mora chuẩn",
                            observed=dur_vi,
                            severity="MEDIUM",
                            detail=f"Độ dài của 「{kana}」 trong 「{word.surface}」 bị {dur_vi}.",
                        )
                    )

                if has_special_issue:
                    if special_type == "SOKUON":
                        special_summary.sokuonIssues += 1
                    elif special_type == "MORAIC_N":
                        special_summary.moraicNIssues += 1
                    elif special_type == "LONG_VOWEL":
                        special_summary.longVowelIssues += 1

            # Record Tokyo pitch accent mismatches (ignoring 'correct', 'unknown', 'unreliable')
            if accent_outcome not in ("correct", "unknown", "unreliable"):
                errors.append(
                    PronunciationErrorItem(
                        type="PITCH_ACCENT",
                        word=word.surface,
                        reading=word.reading,
                        mora=None,
                        expected=f"kiểu trọng âm Tokyo #{word.accent_type}" if word.accent_type is not None else "chuẩn Tokyo",
                        observed=_ACCENT_OUTCOME_VI.get(accent_outcome, accent_outcome),
                        severity="LOW" if accent_outcome == "fall_for_unaccented" else "MEDIUM",
                        detail=(
                            f"Trọng âm từ 「{word.surface}」 ({word.reading}): "
                            f"{_ACCENT_OUTCOME_VI.get(accent_outcome, accent_outcome)}."
                        ),
                    )
                )

            word_results.append(
                WordPronunciationEvaluation(
                    surface=word.surface,
                    reading=word.reading or "",
                    score=round(float(word.score), 1) if word.score is not None else None,
                    accentType=getattr(word, "accent_type", None),
                    accentOutcome=accent_outcome,
                    startTime=round(float(word.start), 3) if word.start is not None else None,
                    endTime=round(float(word.end), 3) if word.end is not None else None,
                    morae=word_morae,
                )
            )

        insertions = [
            InsertionItem(
                startTime=round(float(ins.start), 3),
                endTime=round(float(ins.end), 3),
                content=getattr(ins, "content", None),
            )
            for ins in (getattr(res, "insertions", []) or [])
        ]

        warnings: List[str] = []
        raw_warnings = [_enum_val(w) for w in (getattr(res, "warnings", []) or [])]
        for rw in raw_warnings:
            if rw:
                label = _WARNING_LABELS_VI.get(rw) or _WARNING_LABELS_VI_EXTRA.get(rw) or f"Cảnh báo hatsuon: {rw}"
                warnings.append(label)

        confidence = round(float(res.confidence), 3) if res.confidence is not None else None
        if confidence is not None and confidence < 0.5:
            warnings.append(
                f"Độ tin cậy chấm phát âm thấp ({confidence:.2f}) — hãy nói gần micro và phát âm rõ hơn."
            )

        # Do not return misleading scores when hatsuon reports no_speech
        no_speech = "no_speech" in raw_warnings
        overall = None if (no_speech or res.overall is None) else round(float(res.overall), 1)
        accuracy = None if (no_speech or res.accuracy is None) else round(float(res.accuracy), 1)
        completeness = None if (no_speech or res.completeness is None) else round(float(res.completeness), 1)
        pitch = None if (no_speech or res.pitch is None) else round(float(res.pitch), 1)
        timing = None if (no_speech or res.timing is None) else round(float(res.timing), 1)

        return PronunciationScoreOutput(
            section=PronunciationSection(
                available=not no_speech,
                engine=self.engine_name,
                moraResults=mora_results,
                wordResults=word_results,
                specialMoraSummary=special_summary,
                errors=errors,
                insertions=insertions,
            ),
            overall=overall,
            accuracy=accuracy,
            completeness=completeness,
            pitch_accent=pitch,
            timing=timing,
            confidence=confidence,
            warnings=warnings,
        )
