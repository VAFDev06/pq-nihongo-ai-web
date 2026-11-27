import io
import numpy as np
import pytest
import soundfile as sf

from app.config.settings import Settings
from app.services.audio_preprocessor import AudioPreprocessor, AudioValidationError


def _make_wav_bytes(samples: np.ndarray, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, samples.astype(np.float32), sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def _sine_wave(duration_sec: float, freq: float = 220.0, amp: float = 0.25, sr: int = 16000) -> np.ndarray:
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False)
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def test_rejects_empty_audio():
    prep = AudioPreprocessor(Settings())
    with pytest.raises(AudioValidationError) as exc:
        with prep.prepare_audio(b"", "empty.wav", "audio/wav"):
            pass
    assert exc.value.code == "EMPTY_AUDIO"


def test_rejects_too_short_audio():
    prep = AudioPreprocessor(Settings())
    data = _make_wav_bytes(_sine_wave(0.1))
    with pytest.raises(AudioValidationError) as exc:
        with prep.prepare_audio(data, "short.wav", "audio/wav"):
            pass
    assert exc.value.code == "AUDIO_TOO_SHORT"


def test_rejects_silent_audio():
    prep = AudioPreprocessor(Settings())
    data = _make_wav_bytes(np.zeros(16000 * 2, dtype=np.float32))
    with pytest.raises(AudioValidationError) as exc:
        with prep.prepare_audio(data, "silent.wav", "audio/wav"):
            pass
    assert exc.value.code == "SILENT_AUDIO"


def test_rejects_unsupported_format():
    prep = AudioPreprocessor(Settings())
    with pytest.raises(AudioValidationError) as exc:
        with prep.prepare_audio(b"not audio text", "notes.pdf", "application/pdf"):
            pass
    assert exc.value.code == "UNSUPPORTED_AUDIO_FORMAT"


def test_rejects_corrupt_audio():
    prep = AudioPreprocessor(Settings())
    with pytest.raises(AudioValidationError) as exc:
        with prep.prepare_audio(b"corrupt_bytes_1234567890", "broken.webm", "audio/webm"):
            pass
    assert exc.value.code == "INVALID_AUDIO"


def test_prepares_valid_stereo_44k_and_cleans_up_temp_file():
    prep = AudioPreprocessor(Settings())
    sr = 44100
    mono = _sine_wave(1.2, freq=200.0, amp=0.3, sr=sr)
    stereo = np.stack([mono, mono], axis=1)
    buf = io.BytesIO()
    sf.write(buf, stereo, sr, format="WAV", subtype="PCM_16")

    tmp_path = None
    with prep.prepare_audio(buf.getvalue(), "stereo.wav", "audio/wav") as prepared:
        tmp_path = prepared.wav_path
        assert tmp_path.exists()
        assert prepared.sample_rate == 16000
        assert prepared.quality.originalSampleRate == 44100
        assert prepared.quality.originalChannels == 2
        assert abs(prepared.quality.durationSec - 1.2) < 0.05

    assert tmp_path is not None and not tmp_path.exists()
