"""Audio validation, decoding, quality diagnostics, and temporary 16kHz mono WAV export.

Security & Privacy:
- Never logs raw audio bytes.
- Always deletes temporary WAV files via context manager cleanup.
- Rejects unsupported formats, oversized files, empty audio, and out-of-range durations.
"""
from contextlib import contextmanager
from dataclasses import dataclass
import io
import logging
import os
from pathlib import Path
import tempfile
from typing import Iterator, Optional, Tuple

import av
import librosa
import numpy as np
import soundfile as sf

from app.config.settings import Settings
from app.schemas.shadowing import AudioQualityInfo

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".wav", ".webm", ".ogg", ".opus", ".mp3", ".m4a", ".mp4", ".flac", ".aac"}
SUPPORTED_MIME_PREFIXES = (
    "audio/",
    "video/webm",
    "video/mp4",
    "application/octet-stream",
)


class AudioValidationError(ValueError):
    """Raised when uploaded audio fails format, size, duration, or decoding validation."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass
class PreparedAudio:
    samples: np.ndarray  # float32 mono [-1, 1]
    sample_rate: int
    wav_path: Path
    quality: AudioQualityInfo


class AudioPreprocessor:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.target_sr = settings.shadowing_target_sample_rate
        self.max_bytes = int(settings.shadowing_max_file_size_mb * 1024 * 1024)
        self.min_sec = settings.shadowing_min_audio_seconds
        self.max_sec = settings.shadowing_max_audio_seconds

    def _validate_header(self, data: bytes, filename: Optional[str], content_type: Optional[str]) -> None:
        if not data or len(data) == 0:
            raise AudioValidationError("EMPTY_AUDIO", "File ghi âm trống. Vui lòng ghi âm lại.")

        if len(data) > self.max_bytes:
            raise AudioValidationError(
                "AUDIO_TOO_LARGE",
                f"Kích thước file âm thanh vượt quá giới hạn {self.settings.shadowing_max_file_size_mb:.0f} MB.",
                status_code=413,
            )

        ext = Path(filename or "").suffix.lower()
        ct = (content_type or "").lower().split(";")[0].strip()

        ext_ok = (not ext) or (ext in SUPPORTED_EXTENSIONS)
        ct_ok = (not ct) or any(ct.startswith(p) for p in SUPPORTED_MIME_PREFIXES)
        if not ext_ok and not ct_ok:
            raise AudioValidationError(
                "UNSUPPORTED_AUDIO_FORMAT",
                f"Định dạng âm thanh không được hỗ trợ ({ext or ct}). Hỗ trợ WAV, WebM, OGG, MP3, M4A, FLAC.",
                status_code=415,
            )

    def _decode_bytes(self, data: bytes) -> Tuple[np.ndarray, int, int]:
        """Decode arbitrary audio container bytes into (float32 mono array, original_sr, original_channels)."""
        # Fast path: soundfile handles WAV / FLAC / OGG-Vorbis cleanly
        try:
            audio, orig_sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
            orig_channels = int(audio.shape[1])
            mono = audio.mean(axis=1) if orig_channels > 1 else audio[:, 0]
            if orig_sr != self.target_sr:
                mono = librosa.resample(mono, orig_sr=orig_sr, target_sr=self.target_sr)
            return np.asarray(mono, dtype=np.float32), int(orig_sr), orig_channels
        except Exception:
            pass

        # General container path: PyAV (bundled FFmpeg codecs — WebM/Opus, MP3, M4A, MP4, AAC, OGG-Opus)
        try:
            container = av.open(io.BytesIO(data))
            audio_streams = [s for s in container.streams if s.type == "audio"]
            if not audio_streams:
                container.close()
                raise AudioValidationError(
                    "INVALID_AUDIO", "File tải lên không chứa kênh âm thanh hợp lệ."
                )
            stream = audio_streams[0]
            orig_sr = int(stream.rate or self.target_sr)
            orig_channels = int(stream.channels or 1)

            resampler = av.audio.resampler.AudioResampler(
                format="flt", layout="mono", rate=self.target_sr
            )
            chunks = []
            for frame in container.decode(audio=0):
                for resampled in resampler.resample(frame):
                    arr = resampled.to_ndarray()
                    chunks.append(arr.reshape(-1))
            # Flush resampler
            for resampled in resampler.resample(None):
                arr = resampled.to_ndarray()
                chunks.append(arr.reshape(-1))
            container.close()

            if not chunks:
                raise AudioValidationError("EMPTY_AUDIO", "Không đọc được dữ liệu âm thanh từ bản ghi.")
            mono = np.concatenate(chunks).astype(np.float32)
            return mono, orig_sr, orig_channels
        except AudioValidationError:
            raise
        except Exception as exc:
            logger.warning("Audio decode failed (%s)", type(exc).__name__)
            raise AudioValidationError(
                "INVALID_AUDIO",
                "Không thể giải mã file âm thanh. File có thể bị hỏng hoặc sai định dạng.",
            ) from exc

    def _analyze_quality(
        self,
        samples: np.ndarray,
        orig_sr: int,
        orig_channels: int,
        file_size: int,
        enforce_speech: bool = True,
    ) -> AudioQualityInfo:
        duration_sec = float(len(samples) / self.target_sr)
        if duration_sec < self.min_sec:
            raise AudioValidationError(
                "AUDIO_TOO_SHORT",
                f"Bản ghi âm quá ngắn ({duration_sec:.2f} giây). Vui lòng nói rõ ràng hơn (tối thiểu {self.min_sec:.1f} giây).",
            )
        if duration_sec > self.max_sec:
            raise AudioValidationError(
                "AUDIO_TOO_LONG",
                f"Bản ghi âm quá dài ({duration_sec:.1f} giây). Giới hạn tối đa là {self.max_sec:.0f} giây cho mỗi lượt Shadowing.",
            )

        abs_samples = np.abs(samples)
        peak = float(np.max(abs_samples)) if len(samples) else 0.0
        rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0.0
        rms_db = float(20.0 * np.log10(max(rms, 1e-8)))
        clipping_ratio = float(np.mean(abs_samples >= 0.99))

        # Estimate SNR using 20ms frame RMS percentiles (90th = speech, 15th = noise floor)
        frame_len = max(1, int(self.target_sr * 0.02))
        n_frames = len(samples) // frame_len
        estimated_snr_db: Optional[float] = None
        if n_frames >= 5:
            framed = samples[: n_frames * frame_len].reshape(n_frames, frame_len)
            frame_rms = np.sqrt(np.mean(framed ** 2, axis=1))
            frame_db = 20.0 * np.log10(np.maximum(frame_rms, 1e-8))
            speech_db = float(np.percentile(frame_db, 90))
            noise_db = float(np.percentile(frame_db, 15))
            estimated_snr_db = round(max(0.0, speech_db - noise_db), 1)

        warnings = []
        if peak < 1e-4 or rms_db < -55.0:
            if enforce_speech:
                raise AudioValidationError(
                    "SILENT_AUDIO",
                    "Bản ghi gần như im lặng, không phát hiện giọng nói. Hãy kiểm tra micro và nói to hơn.",
                )
            warnings.append("Âm lượng bản ghi rất nhỏ hoặc gần như im lặng.")
        elif rms_db < -35.0:
            warnings.append("Âm lượng micro khá nhỏ — kết quả chấm phát âm và F0 có thể kém ổn định.")

        if clipping_ratio > 0.02:
            warnings.append("Bản ghi có hiện tượng vỡ tiếng (clipping) — hãy đặt micro xa miệng hơn một chút.")

        if estimated_snr_db is not None and estimated_snr_db < 8.0 and rms_db > -50.0:
            warnings.append("Môi trường ghi âm có tiếng ồn nền khá cao — kết quả có thể giảm độ tin cậy.")

        return AudioQualityInfo(
            durationSec=round(duration_sec, 3),
            sampleRate=self.target_sr,
            originalSampleRate=orig_sr,
            originalChannels=orig_channels,
            fileSizeBytes=file_size,
            rmsDb=round(rms_db, 2),
            peakAmplitude=round(peak, 4),
            clippingRatio=round(clipping_ratio, 4),
            estimatedSnrDb=estimated_snr_db,
            warnings=warnings,
        )

    @contextmanager
    def prepare_audio(
        self,
        data: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
        enforce_speech: bool = True,
    ) -> Iterator[PreparedAudio]:
        """Validate, decode, normalize, and yield a temporary 16kHz mono PCM16 WAV file."""
        self._validate_header(data, filename, content_type)
        samples, orig_sr, orig_channels = self._decode_bytes(data)

        # Clean NaN/Inf and clip safely to [-1, 1]
        if not np.all(np.isfinite(samples)):
            samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
        samples = np.clip(samples, -1.0, 1.0).astype(np.float32)

        quality = self._analyze_quality(
            samples, orig_sr, orig_channels, len(data), enforce_speech=enforce_speech
        )

        # Gentle peak normalization for very quiet audio without distorting already-normal speech
        peak = float(np.max(np.abs(samples)))
        export_samples = samples
        if 1e-4 < peak < 0.15:
            gain = min(0.5 / peak, 8.0)
            export_samples = np.clip(samples * gain, -1.0, 1.0).astype(np.float32)

        tmp_fd, tmp_path_str = tempfile.mkstemp(prefix="pq_shadow_", suffix=".wav")
        os.close(tmp_fd)
        tmp_path = Path(tmp_path_str)
        try:
            sf.write(str(tmp_path), export_samples, self.target_sr, subtype="PCM_16")
            yield PreparedAudio(
                samples=export_samples,
                sample_rate=self.target_sr,
                wav_path=tmp_path,
                quality=quality,
            )
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
