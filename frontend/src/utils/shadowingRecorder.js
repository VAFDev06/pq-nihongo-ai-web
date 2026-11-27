/**
 * Reusable browser MediaRecorder helper for PQ Nihongo Shadowing.
 * Captures real microphone audio (WebM/Opus, OGG/Opus, or MP4) for local AI server evaluation,
 * tracks recording duration, produces a local playback preview URL, and cleans up tracks safely.
 */

export function isMediaRecorderSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

export function pickSupportedAudioMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    try {
      if (typeof window.MediaRecorder.isTypeSupported === 'function' && window.MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // ignore unsupported check
    }
  }
  return '';
}

export function extensionForMimeType(mimeType = '') {
  const lower = String(mimeType).toLowerCase();
  if (lower.includes('ogg')) return '.ogg';
  if (lower.includes('mp4') || lower.includes('m4a')) return '.m4a';
  if (lower.includes('wav')) return '.wav';
  return '.webm';
}

export function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const tenths = Math.floor((total - Math.floor(total)) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export class ShadowingAudioRecorder {
  constructor({ onDurationChange, maxSeconds = 35 } = {}) {
    this.onDurationChange = onDurationChange;
    this.maxSeconds = maxSeconds;
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.startTimeMs = 0;
    this.timerId = null;
    this.mimeType = '';
    this._stopResolve = null;
    this._cancelled = false;
  }

  get isRecording() {
    return Boolean(this.mediaRecorder && this.mediaRecorder.state === 'recording');
  }

  async start() {
    if (!isMediaRecorderSupported()) {
      throw new Error('Trình duyệt không hỗ trợ ghi âm micro (MediaRecorder).');
    }

    this.chunks = [];
    this._cancelled = false;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.mimeType = pickSupportedAudioMimeType();
    const options = this.mimeType ? { mimeType: this.mimeType } : undefined;
    this.mediaRecorder = new window.MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this._clearTimer();
      this._releaseStream();
      const durationSec = Math.max(0, (Date.now() - this.startTimeMs) / 1000);
      const actualMime = this.mediaRecorder?.mimeType || this.mimeType || 'audio/webm';
      const blob = new Blob(this.chunks, { type: actualMime });
      const filename = `shadowing${extensionForMimeType(actualMime)}`;
      const objectUrl = !this._cancelled && blob.size > 0 ? URL.createObjectURL(blob) : null;

      if (this._stopResolve) {
        const resolve = this._stopResolve;
        this._stopResolve = null;
        resolve(
          this._cancelled
            ? null
            : {
                blob,
                filename,
                mimeType: actualMime,
                durationSec: Number(durationSec.toFixed(2)),
                objectUrl,
              }
        );
      }
    };

    this.startTimeMs = Date.now();
    this.mediaRecorder.start(250);

    if (typeof this.onDurationChange === 'function') {
      this.onDurationChange(0);
      this.timerId = window.setInterval(() => {
        const elapsed = (Date.now() - this.startTimeMs) / 1000;
        this.onDurationChange(elapsed);
        if (elapsed >= this.maxSeconds && this.isRecording) {
          this.stop();
        }
      }, 100);
    }
  }

  stop() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this._clearTimer();
      this._releaseStream();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this._stopResolve = resolve;
      try {
        this.mediaRecorder.stop();
      } catch {
        this._clearTimer();
        this._releaseStream();
        this._stopResolve = null;
        resolve(null);
      }
    });
  }

  cancel() {
    this._cancelled = true;
    this._clearTimer();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this._releaseStream();
  }

  _clearTimer() {
    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  _releaseStream() {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.stream = null;
    }
  }
}
