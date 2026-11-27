import numpy as np

from app.config.settings import Settings
from app.services.intonation_service import IntonationService


def _synth_pitch_contour(f0_start: float, f0_end: float, duration_sec: float = 1.6, sr: int = 16000) -> np.ndarray:
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False)
    freqs = np.linspace(f0_start, f0_end, len(t))
    phase = 2.0 * np.pi * np.cumsum(freqs) / sr
    # Fundamental + 2nd harmonic for clean pYIN tracking
    sig = 0.25 * np.sin(phase) + 0.12 * np.sin(2 * phase)
    return sig.astype(np.float32)


def test_detects_rising_question_intonation():
    svc = IntonationService(Settings())
    rising = _synth_pitch_contour(180.0, 290.0, duration_sec=1.6)
    section, _ = svc.analyze(rising, 16000, "行きますか？")
    assert section.experimental is True
    assert section.f0Available is True
    assert section.expectedFinalMovement == "RISING"
    assert section.finalPitchMovement == "RISING"
    assert section.finalPitchMatch is True
    assert section.score is not None


def test_cross_speaker_pitch_normalization_and_dtw_reference_comparison():
    svc = IntonationService(Settings())
    # Same contour shape (rising +4 semitones) but male (~120 Hz) vs female (~240 Hz, exact octave shift)
    ref_male = _synth_pitch_contour(110.0, 145.0, duration_sec=1.5)
    learner_female = _synth_pitch_contour(220.0, 290.0, duration_sec=1.9)  # slower too
    section, _ = svc.analyze(learner_female, 16000, "行きますか？", reference_samples=ref_male)
    assert section.f0Available is True
    assert section.referenceComparisonAvailable is True
    assert section.referenceComparison is not None
    # Normalized semitone MAE should be very small despite 120Hz vs 240Hz raw F0 difference!
    assert section.referenceComparison.dtwMaeSemitones is not None
    assert section.referenceComparison.dtwMaeSemitones < 1.5
    assert section.score is not None and section.score >= 70.0


def test_unvoiced_noise_returns_null_score_no_fabrication():
    svc = IntonationService(Settings())
    rng = np.random.default_rng(42)
    noise = (0.05 * rng.standard_normal(16000 * 1)).astype(np.float32)
    section, warnings = svc.analyze(noise, 16000, "こんにちは。")
    assert section.experimental is True
    assert section.f0Available is False
    assert section.score is None
    assert section.reliability == "UNRELIABLE"
    assert len(warnings) > 0
