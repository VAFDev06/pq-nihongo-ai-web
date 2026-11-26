/**
 * Global Japanese Text-to-Speech & Audio Playback Engine
 * - Default speed: 1.0x (clear, natural speed)
 * - Supported speeds: 0.75x, 0.85x, 1.0x, 1.15x, 1.25x, 1.5x
 * - Pitch controls removed for cleaner natural voice output
 * - Supports sequential multi-sentence playback (Custom Shadowing & A/B Dialogue Shadowing)
 */

export const TTS_SPEED_OPTIONS = [
  { value: 0.75, label: '0.75x (Rất chậm)' },
  { value: 0.85, label: '0.85x (Chậm)' },
  { value: 1.0, label: '1.0x (Chuẩn)' },
  { value: 1.15, label: '1.15x (Tự nhiên)' },
  { value: 1.25, label: '1.25x (Nhanh)' },
  { value: 1.5, label: '1.5x (Bản xứ)' },
];

const VALID_SPEEDS = TTS_SPEED_OPTIONS.map((o) => o.value);
const storedRaw = parseFloat(localStorage.getItem('pq_tts_speed'));
let globalTtsSpeed = VALID_SPEEDS.includes(storedRaw) ? storedRaw : 1.0;

let cachedJaVoices = [];
let activeAudio = null;
let sequenceToken = 0;
let activeListeners = new Set();

function notifyListeners(isPlaying, activeText = '') {
  activeListeners.forEach((fn) => {
    try {
      fn(isPlaying, activeText);
    } catch (err) {
      // ignore
    }
  });
}

export function subscribeTtsState(listener) {
  activeListeners.add(listener);
  return () => activeListeners.delete(listener);
}

export function getGlobalTtsSpeed() {
  return globalTtsSpeed;
}

export function setGlobalTtsSpeed(speed) {
  const num = parseFloat(speed);
  if (!Number.isNaN(num) && num >= 0.5 && num <= 2.0) {
    globalTtsSpeed = num;
    localStorage.setItem('pq_tts_speed', String(num));
    if (activeAudio && !activeAudio.paused) {
      activeAudio.playbackRate = num;
    }
  }
}

function loadJapaneseVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return [];

  const jaVoices = voices.filter(
    (v) =>
      (v.lang && v.lang.toLowerCase().startsWith('ja')) ||
      v.name.includes('Japanese') ||
      v.name.includes('日本語')
  );

  // Sắp xếp ưu tiên giọng Natural / Online / Google / Nanami / Keita
  jaVoices.sort((a, b) => {
    const score = (v) => {
      if (v.name.includes('Natural') || v.name.includes('Online')) return 4;
      if (v.name.includes('Google')) return 3;
      if (v.name.includes('Nanami') || v.name.includes('Keita') || v.name.includes('Kyoko') || v.name.includes('Haruka')) return 2;
      return 1;
    };
    return score(b) - score(a);
  });

  cachedJaVoices = jaVoices;
  return jaVoices;
}

export function getBestJapaneseVoice(speaker = null) {
  const jaVoices = cachedJaVoices.length > 0 ? cachedJaVoices : loadJapaneseVoices();
  if (jaVoices.length === 0) return null;

  if (speaker && String(speaker).trim().toUpperCase() === 'B' && jaVoices.length > 1) {
    // Ưu tiên chọn giọng thứ 2 khác giọng A để phân biệt rõ 2 nhân vật A/B
    return jaVoices[1];
  }
  return jaVoices[0];
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedJaVoices = [];
    loadJapaneseVoices();
  };
}

export function stopJapaneseAudio() {
  sequenceToken++;
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (e) {
      // ignore
    }
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  notifyListeners(false, '');
}

export function pauseJapaneseAudio() {
  if (activeAudio && !activeAudio.paused) {
    activeAudio.pause();
    return;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

export function resumeJapaneseAudio() {
  if (activeAudio && activeAudio.paused) {
    activeAudio.play().catch(() => {});
    return;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

function cleanJapaneseText(text) {
  return String(text || '').replace(/\[[^\]]+\]/g, '').trim();
}

export function speakJapanese(text, options = {}) {
  const {
    audioUrl = null,
    rate = null,
    speaker = null,
    onStart = null,
    onEnd = null,
    onError = null,
  } = options;

  stopJapaneseAudio();
  const myToken = sequenceToken;
  const effectiveRate = rate !== null && rate !== undefined ? parseFloat(rate) : globalTtsSpeed;

  playSingleItem({ text, audioUrl, speaker }, effectiveRate, myToken, onStart, onEnd, onError);
}

/**
 * Đọc tuần tự nhiều câu tiếng Nhật (VD: Shadowing tự nhập nhiều câu hoặc toàn bộ hội thoại A/B).
 * Đảm bảo giữ đúng tốc độ đã chọn xuyên suốt tất cả các câu, không đọc chồng lấn và dừng ngay khi gọi stopJapaneseAudio().
 */
export function speakJapaneseSequence(items = [], options = {}) {
  const {
    rate = null,
    pauseMs = 280,
    onItemStart = null,
    onEnd = null,
    onError = null,
  } = options;

  stopJapaneseAudio();
  const normalized = (items || [])
    .map((item) =>
      typeof item === 'string'
        ? { text: item, audioUrl: null, speaker: null }
        : {
            text: item.text || item.japaneseText || item.japanese || '',
            audioUrl: item.audioUrl || null,
            speaker: item.speaker || null,
          }
    )
    .filter((x) => cleanJapaneseText(x.text).length > 0 || x.audioUrl);

  if (normalized.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  const myToken = sequenceToken;

  const playNext = (index) => {
    if (myToken !== sequenceToken) return;
    if (index >= normalized.length) {
      notifyListeners(false, '');
      if (onEnd) onEnd();
      return;
    }

    const currentItem = normalized[index];
    const effectiveRate = rate !== null && rate !== undefined ? parseFloat(rate) : globalTtsSpeed;

    playSingleItem(
      currentItem,
      effectiveRate,
      myToken,
      () => {
        if (myToken !== sequenceToken) return;
        if (onItemStart) onItemStart(index, currentItem);
      },
      () => {
        if (myToken !== sequenceToken) return;
        setTimeout(() => {
          playNext(index + 1);
        }, pauseMs);
      },
      () => {
        if (myToken !== sequenceToken) return;
        if (onError) onError(index);
        setTimeout(() => {
          playNext(index + 1);
        }, pauseMs);
      }
    );
  };

  playNext(0);
}

function playSingleItem(item, effectiveRate, myToken, onStart, onEnd, onError) {
  const { text, audioUrl, speaker } = item;

  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      audio.playbackRate = effectiveRate;
      if ('preservesPitch' in audio) audio.preservesPitch = true;
      activeAudio = audio;

      audio.onplay = () => {
        if (myToken !== sequenceToken) return;
        notifyListeners(true, text || audioUrl);
        if (onStart) onStart();
      };
      audio.onended = () => {
        activeAudio = null;
        if (myToken !== sequenceToken) return;
        notifyListeners(false, '');
        if (onEnd) onEnd();
      };
      audio.onerror = () => {
        activeAudio = null;
        if (myToken !== sequenceToken) return;
        if (text) {
          speakWithWebSpeech(text, effectiveRate, speaker, myToken, onStart, onEnd, onError);
        } else {
          notifyListeners(false, '');
          if (onError) onError();
        }
      };

      audio.play().catch(() => {
        activeAudio = null;
        if (myToken !== sequenceToken) return;
        if (text) {
          speakWithWebSpeech(text, effectiveRate, speaker, myToken, onStart, onEnd, onError);
        } else if (onError) {
          onError();
        }
      });
      return;
    } catch (e) {
      // Fallback sang Web Speech API
    }
  }

  speakWithWebSpeech(text, effectiveRate, speaker, myToken, onStart, onEnd, onError);
}

function speakWithWebSpeech(text, effectiveRate, speaker, myToken, onStart, onEnd, onError) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onError) onError();
    return;
  }

  const cleanText = cleanJapaneseText(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'ja-JP';
  utterance.rate = Math.min(2.0, Math.max(0.5, effectiveRate));
  utterance.pitch = 1.0;

  const voice = getBestJapaneseVoice(speaker);
  if (voice) {
    utterance.voice = voice;
  }

  utterance.onstart = () => {
    if (myToken !== sequenceToken) return;
    notifyListeners(true, cleanText);
    if (onStart) onStart();
  };
  utterance.onend = () => {
    if (myToken !== sequenceToken) return;
    notifyListeners(false, '');
    if (onEnd) onEnd();
  };
  utterance.onerror = () => {
    if (myToken !== sequenceToken) return;
    notifyListeners(false, '');
    if (onError) onError();
  };

  window.speechSynthesis.speak(utterance);
}
