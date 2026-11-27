"""Experimental sentence-level Japanese intonation analysis module (F0 acoustic analysis).

Distinguishes sentence-level intonation (F0 contour, pitch movement, pauses, rhythm,
sentence-final pitch rise/fall) from word-level Tokyo pitch accent (handled by hatsuon).

Design rules:
- Never compares raw Hz across speakers; converts F0 to semitones relative to speaker median F0.
- Uses Dynamic Time Warping (DTW) when reference audio is supplied to handle speaking-speed differences.
- Labels all outputs explicitly as experimental (`experimental=True`) with reliability & confidence.
- Returns `score=None` (never fabricates a number) when F0 / audio quality is insufficient.
"""
import logging
from typing import List, Optional, Tuple

import librosa
import numpy as np
from scipy.signal import medfilt

from app.config.settings import Settings
from app.schemas.shadowing import (
    IntonationSection,
    PauseSegment,
    PitchPoint,
    ReferenceIntonationComparison,
)

logger = logging.getLogger(__name__)

_FMIN_HZ = 65.0
_FMAX_HZ = 520.0
_FRAME_LENGTH = 1024
_HOP_LENGTH = 160  # 10ms at 16kHz


def _expected_final_movement(reference_text: str) -> str:
    txt = (reference_text or "").strip()
    if txt.endswith("？") or txt.endswith("?"):
        return "RISING"
    stripped = txt.rstrip("。！! ")
    if stripped.endswith("か") or stripped.endswith("かな") or stripped.endswith("でしょうか"):
        return "RISING"
    return "FALLING_OR_FLAT"


def _extract_f0_and_activity(
    samples: np.ndarray, sr: int
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, float, float, List[PauseSegment]]:
    """Extract F0 (Hz), voiced probabilities, semitones relative to speaker median,
    active speech span, and pause segments.
    """
    f0, voiced_flag, voiced_probs = librosa.pyin(
        samples,
        fmin=_FMIN_HZ,
        fmax=_FMAX_HZ,
        sr=sr,
        frame_length=_FRAME_LENGTH,
        hop_length=_HOP_LENGTH,
    )
    f0 = np.asarray(f0, dtype=np.float64)
    voiced_probs = np.nan_to_num(np.asarray(voiced_probs, dtype=np.float64), nan=0.0)

    # Smooth valid contiguous pitch values gently to remove isolated octave glitches
    valid_mask = np.isfinite(f0) & (f0 >= _FMIN_HZ) & (f0 <= _FMAX_HZ)
    if np.sum(valid_mask) >= 5:
        valid_vals = f0[valid_mask]
        smoothed = medfilt(valid_vals, kernel_size=3)
        f0_clean = f0.copy()
        f0_clean[valid_mask] = smoothed
    else:
        f0_clean = f0.copy()

    # Frame RMS energy aligned with hop_length
    rms = librosa.feature.rms(y=samples, frame_length=400, hop_length=_HOP_LENGTH)[0]
    n_frames = min(len(f0_clean), len(rms))
    f0_clean = f0_clean[:n_frames]
    voiced_probs = voiced_probs[:n_frames]
    rms = rms[:n_frames]
    rms_db = 20.0 * np.log10(np.maximum(rms, 1e-8))

    peak_db = float(np.max(rms_db)) if len(rms_db) else -80.0
    speech_thresh_db = max(peak_db - 30.0, -48.0)
    speech_mask = rms_db >= speech_thresh_db

    # Active speech region (excluding leading & trailing silence)
    speech_indices = np.where(speech_mask)[0]
    hop_sec = _HOP_LENGTH / float(sr)
    pauses: List[PauseSegment] = []

    if len(speech_indices) >= 2:
        first_idx = int(speech_indices[0])
        last_idx = int(speech_indices[-1])
        active_span_sec = max(hop_sec, (last_idx - first_idx + 1) * hop_sec)
        active_speech_frames = int(np.sum(speech_mask[first_idx : last_idx + 1]))
        articulation_ratio = float(active_speech_frames / max(1, (last_idx - first_idx + 1)))

        # Detect internal pauses >= 0.18s inside active speech span
        in_pause = False
        pause_start = first_idx
        for i in range(first_idx, last_idx + 1):
            if not speech_mask[i] and not in_pause:
                in_pause = True
                pause_start = i
            elif speech_mask[i] and in_pause:
                dur = (i - pause_start) * hop_sec
                if dur >= 0.18:
                    sev = "NORMAL" if dur < 0.35 else ("LONG" if dur < 0.65 else "EXCESSIVE")
                    pauses.append(
                        PauseSegment(
                            startSec=round(pause_start * hop_sec, 3),
                            endSec=round(i * hop_sec, 3),
                            durationSec=round(dur, 3),
                            severity=sev,
                        )
                    )
                in_pause = False
    else:
        active_span_sec = 0.0
        articulation_ratio = 0.0

    # Speaker median F0 -> semitone normalization (speaker pitch-range invariant!)
    valid_f0 = f0_clean[np.isfinite(f0_clean)]
    if len(valid_f0) > 0:
        median_f0 = float(np.median(valid_f0))
        semitones = np.full_like(f0_clean, np.nan)
        mask = np.isfinite(f0_clean)
        semitones[mask] = 12.0 * np.log2(f0_clean[mask] / median_f0)
    else:
        semitones = np.full_like(f0_clean, np.nan)

    return f0_clean, voiced_probs, semitones, speech_mask, active_span_sec, articulation_ratio, pauses


def _detect_final_pitch_movement(semitones: np.ndarray, hop_sec: float) -> Tuple[str, float]:
    """Inspect pitch slope and delta in the final voiced tail of the utterance."""
    valid_idx = np.where(np.isfinite(semitones))[0]
    if len(valid_idx) < 8:
        return "UNKNOWN", 0.0

    # Take last 30% of voiced frames (at least 6 frames, capped at 45 frames ~ 0.45s)
    tail_count = max(6, min(45, int(len(valid_idx) * 0.30)))
    tail_idx = valid_idx[-tail_count:]
    tail_st = semitones[tail_idx]
    tail_t = (tail_idx - tail_idx[0]) * hop_sec

    split = max(2, len(tail_st) // 2)
    delta = float(np.mean(tail_st[split:]) - np.mean(tail_st[:split]))

    if float(tail_t[-1] - tail_t[0]) > 0.03:
        slope = float(np.polyfit(tail_t, tail_st, 1)[0])
    else:
        slope = 0.0

    if delta >= 1.3 or (slope >= 3.8 and delta >= 0.85):
        return "RISING", delta
    if delta <= -1.1 or (slope <= -3.2 and delta <= -0.75):
        return "FALLING", delta
    return "FLAT", delta


def _downsample_contour(f0: np.ndarray, semitones: np.ndarray, hop_sec: float, max_points: int = 72) -> List[PitchPoint]:
    n = len(f0)
    if n == 0:
        return []
    step = max(1, int(np.ceil(n / max_points)))
    points: List[PitchPoint] = []
    for i in range(0, n, step):
        seg_f0 = f0[i : i + step]
        seg_st = semitones[i : i + step]
        valid = np.isfinite(seg_f0)
        t_sec = round((i + 0.5 * min(step, n - i)) * hop_sec, 3)
        if np.any(valid):
            points.append(
                PitchPoint(
                    timeSec=t_sec,
                    f0Hz=round(float(np.median(seg_f0[valid])), 1),
                    semitone=round(float(np.median(seg_st[valid])), 2),
                    voiced=True,
                )
            )
        else:
            points.append(PitchPoint(timeSec=t_sec, f0Hz=None, semitone=None, voiced=False))
    return points


class IntonationService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def analyze(
        self,
        learner_samples: np.ndarray,
        sr: int,
        reference_text: str,
        reference_samples: Optional[np.ndarray] = None,
    ) -> Tuple[IntonationSection, List[str]]:
        if not self.settings.shadowing_intonation_enabled:
            return (
                IntonationSection(experimental=True, f0Available=False, reliability="UNRELIABLE"),
                ["Phân tích ngữ điệu câu (F0) đang tắt trong cấu hình."],
            )

        warnings: List[str] = []
        hop_sec = _HOP_LENGTH / float(sr)

        try:
            (
                f0,
                voiced_probs,
                semitones,
                speech_mask,
                active_span_sec,
                articulation_ratio,
                pauses,
            ) = _extract_f0_and_activity(learner_samples, sr)
        except Exception as exc:
            logger.warning("F0 extraction failed: %s", exc)
            return (
                IntonationSection(experimental=True, f0Available=False, reliability="UNRELIABLE"),
                [f"Lỗi trích xuất đường cao độ F0: {exc}"],
            )

        valid_mask = np.isfinite(semitones)
        valid_count = int(np.sum(valid_mask))
        speech_frames = max(1, int(np.sum(speech_mask)))
        voiced_ratio = float(min(1.0, valid_count / speech_frames))
        mean_vprob = float(np.mean(voiced_probs[valid_mask])) if valid_count > 0 else 0.0

        # Quality gating: NEVER fabricate an intonation score when F0 signal is insufficient
        if active_span_sec < 0.35 or valid_count < 10 or voiced_ratio < 0.15:
            warnings.append(
                "Không trích xuất đủ khung hữu thanh (F0) để phân tích ngữ điệu câu — không tạo điểm ngữ điệu."
            )
            return (
                IntonationSection(
                    experimental=True,
                    f0Available=False,
                    referenceComparisonAvailable=False,
                    reliability="UNRELIABLE",
                    confidence=0.0,
                    score=None,
                    voicedRatio=round(voiced_ratio, 3),
                    speakingDurationSec=round(active_span_sec, 3),
                    articulationRatio=round(articulation_ratio, 3),
                    pauseAnalysis=pauses,
                    feedback=[
                        "Tín hiệu cao độ giọng nói chưa đủ rõ để phân tích ngữ điệu câu. Hãy nói to, rõ và hạn chế tiếng ồn nền."
                    ],
                ),
                warnings,
            )

        valid_f0 = f0[valid_mask]
        valid_st = semitones[valid_mask]
        median_f0 = float(np.median(valid_f0))
        st_std = float(np.std(valid_st))
        st_range = float(np.percentile(valid_st, 95) - np.percentile(valid_st, 5))

        final_movement, final_delta = _detect_final_pitch_movement(semitones, hop_sec)
        expected_final = _expected_final_movement(reference_text)
        final_match: Optional[bool] = None
        if final_movement != "UNKNOWN":
            if expected_final == "RISING":
                final_match = final_movement == "RISING"
            else:
                final_match = final_movement in ("FALLING", "FLAT")

        contour = _downsample_contour(f0, semitones, hop_sec)
        excessive_pauses = [p for p in pauses if p.severity == "EXCESSIVE"]
        long_pauses = [p for p in pauses if p.severity == "LONG"]

        feedback_lines: List[str] = []
        ref_comparison: Optional[ReferenceIntonationComparison] = None
        ref_available = False
        experimental_score: Optional[float] = None

        # Reliability classification based on voiced stability & SNR/duration
        if voiced_ratio >= 0.45 and mean_vprob >= 0.55 and valid_count >= 25:
            reliability = "HIGH"
            base_conf = 0.80
        elif voiced_ratio >= 0.28 and valid_count >= 15:
            reliability = "MEDIUM"
            base_conf = 0.62
        else:
            reliability = "LOW"
            base_conf = 0.40
            warnings.append("Độ tin cậy trích xuất F0 ở mức thấp; chỉ số ngữ điệu mang tính tham khảo.")

        # Reference audio comparison via semitone DTW when reference audio is supplied
        if reference_samples is not None and len(reference_samples) > int(0.3 * sr):
            try:
                (
                    ref_f0,
                    _,
                    ref_st,
                    _,
                    ref_span_sec,
                    _,
                    ref_pauses,
                ) = _extract_f0_and_activity(reference_samples, sr)
                ref_valid_st = ref_st[np.isfinite(ref_st)]
                ref_valid_f0 = ref_f0[np.isfinite(ref_f0)]

                if len(ref_valid_st) >= 10 and ref_span_sec >= 0.3:
                    ref_available = True
                    # DTW on normalized semitone sequences (1D -> shape (1, T))
                    _, wp = librosa.sequence.dtw(
                        X=valid_st[np.newaxis, :],
                        Y=ref_valid_st[np.newaxis, :],
                        metric="euclidean",
                    )
                    wp = wp[::-1]
                    warped_learner = valid_st[wp[:, 0]]
                    warped_ref = ref_valid_st[wp[:, 1]]

                    dtw_mae = float(np.mean(np.abs(warped_learner - warped_ref)))
                    if np.std(warped_learner) > 1e-4 and np.std(warped_ref) > 1e-4:
                        corr = float(np.corrcoef(warped_learner, warped_ref)[0, 1])
                    else:
                        corr = 0.0
                    dur_ratio = float(active_span_sec / max(0.2, ref_span_sec))
                    pause_delta = len(pauses) - len(ref_pauses)

                    ref_comparison = ReferenceIntonationComparison(
                        dtwMaeSemitones=round(dtw_mae, 2),
                        contourCorrelation=round(corr, 3),
                        durationRatio=round(dur_ratio, 2),
                        pauseCountDelta=pause_delta,
                        referenceMedianF0Hz=round(float(np.median(ref_valid_f0)), 1),
                        referencePitchRangeSemitones=round(
                            float(np.percentile(ref_valid_st, 95) - np.percentile(ref_valid_st, 5)), 2
                        ),
                    )

                    # Experimental composite score against reference contour (0..100)
                    # MAE <= 1.2 st -> ~100, MAE >= 5.5 st -> ~20
                    mae_score = max(0.0, min(100.0, 100.0 - max(0.0, dtw_mae - 0.8) * 17.5))
                    corr_score = max(0.0, min(100.0, (corr + 1.0) * 50.0))
                    final_score = 100.0 if final_match is True else (45.0 if final_match is False else 75.0)
                    # Rhythm score penalizes extreme speed mismatch or excessive pauses
                    speed_penalty = min(40.0, abs(dur_ratio - 1.0) * 45.0)
                    pause_penalty = min(35.0, len(excessive_pauses) * 18.0 + max(0, abs(pause_delta) - 1) * 8.0)
                    rhythm_score = max(0.0, 100.0 - speed_penalty - pause_penalty)

                    experimental_score = round(
                        0.50 * mae_score + 0.20 * corr_score + 0.15 * final_score + 0.15 * rhythm_score,
                        1,
                    )
                    if dtw_mae <= 2.0 and corr >= 0.5:
                        feedback_lines.append(
                            f"Đường ngữ điệu F0 bám khá sát bản mẫu (sai lệch chuẩn hóa DTW ~{dtw_mae:.1f} bán cung)."
                        )
                    else:
                        feedback_lines.append(
                            f"Đường lên xuống cao độ còn khác bản mẫu (sai lệch DTW ~{dtw_mae:.1f} bán cung, tương quan {corr:.2f})."
                        )
                    if dur_ratio > 1.35:
                        feedback_lines.append(f"Tốc độ nói chậm hơn bản mẫu khá nhiều (tỉ lệ thời lượng {dur_ratio:.2f}x).")
                    elif dur_ratio < 0.72:
                        feedback_lines.append(f"Tốc độ nói nhanh hơn bản mẫu (tỉ lệ thời lượng {dur_ratio:.2f}x).")
            except Exception as exc:
                logger.warning("Reference audio intonation comparison failed: %s", exc)
                warnings.append("Không thể so sánh F0 với audio mẫu; chuyển sang phân tích ngữ điệu độc lập.")

        if not ref_available:
            # Self-contained experimental mode (no reference audio uploaded)
            base_conf = min(base_conf, 0.62)
            warnings.append(
                "Không có audio mẫu đi kèm — điểm ngữ điệu câu là chỉ số thử nghiệm (experimental) ước lượng từ đường F0, ngắt nghỉ và kết câu."
            )
            if reliability in ("HIGH", "MEDIUM"):
                # Pitch expressiveness: Japanese read speech typically shows 1.6–4.5 st std
                if st_std < 0.9:
                    expressiveness = 50.0
                elif st_std < 1.5:
                    expressiveness = 74.0
                elif st_std <= 5.5:
                    expressiveness = 92.0
                else:
                    expressiveness = 78.0
                final_score = 95.0 if final_match is True else (45.0 if final_match is False else 75.0)
                pause_penalty = min(40.0, len(excessive_pauses) * 20.0 + len(long_pauses) * 8.0)
                rhythm_score = max(35.0, 95.0 - pause_penalty)
                experimental_score = round(0.40 * expressiveness + 0.35 * final_score + 0.25 * rhythm_score, 1)
            else:
                experimental_score = None

        # Human-readable Vietnamese intonation insights
        if st_std < 1.1:
            feedback_lines.append(
                f"Giọng đọc hơi đều/phẳng (độ biến thiên F0 chỉ {st_std:.1f} bán cung). Hãy tạo độ lên xuống tự nhiên hơn giữa các cụm từ."
            )
        else:
            feedback_lines.append(
                f"Biên độ cao độ câu tự nhiên ({st_range:.1f} bán cung, F0 trung vị {median_f0:.0f} Hz)."
            )

        if expected_final == "RISING":
            if final_match is True:
                feedback_lines.append("Ngữ điệu cuối câu hỏi lên giọng rõ ràng (phù hợp câu nghi vấn tiếng Nhật).")
            elif final_match is False:
                feedback_lines.append(
                    f"Đây là câu hỏi nhưng cuối câu chưa lên giọng rõ (xu hướng đo được: {final_movement}, Δ={final_delta:+.1f} bán cung). Hãy nâng cao độ ở cuối câu."
                )
        else:
            if final_match is True:
                feedback_lines.append("Ngữ điệu kết thúc câu trần thuật tự nhiên (hạ nhẹ hoặc giữ ổn định).")
            elif final_match is False:
                feedback_lines.append(
                    "Cuối câu trần thuật bị lên giọng như câu hỏi; hãy thả lỏng và hạ nhẹ cao độ ở âm cuối."
                )

        if excessive_pauses:
            feedback_lines.append(
                f"Phát hiện {len(excessive_pauses)} khoảng ngắt nghỉ khá dài (>0.65 giây) giữa câu làm ngắt mạch nói."
            )
        elif long_pauses:
            feedback_lines.append(
                f"Có {len(long_pauses)} khoảng dừng hơi dài (0.35–0.65 giây) — thử nối các cụm từ trôi chảy hơn."
            )
        else:
            feedback_lines.append("Nhịp độ ngắt nghỉ trong câu khá liền mạch.")

        return (
            IntonationSection(
                experimental=True,
                f0Available=True,
                referenceComparisonAvailable=ref_available,
                reliability=reliability,
                confidence=round(base_conf, 3),
                score=experimental_score,
                medianF0Hz=round(median_f0, 1),
                pitchRangeSemitones=round(st_range, 2),
                pitchStdSemitones=round(st_std, 2),
                voicedRatio=round(voiced_ratio, 3),
                finalPitchMovement=final_movement,
                expectedFinalMovement=expected_final,
                finalPitchMatch=final_match,
                speakingDurationSec=round(active_span_sec, 3),
                articulationRatio=round(articulation_ratio, 3),
                pitchContour=contour,
                pauseAnalysis=pauses,
                referenceComparison=ref_comparison,
                feedback=feedback_lines,
            ),
            warnings,
        )
