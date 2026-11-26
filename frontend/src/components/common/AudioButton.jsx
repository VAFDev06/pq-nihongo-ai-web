import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { speakJapanese, stopJapaneseAudio, getGlobalTtsSpeed } from '../../utils/tts';
import { useAuth } from '../../auth/AuthContext';

/**
 * Japanese Text-to-Speech Button using shared TTS speed (no pitch distortion).
 */
export const AudioButton = ({
  text,
  audioUrl,
  rate = null,
  speaker = null,
  size = 'sm',
  className = '',
  variant = 'light',
}) => {
  const [playing, setPlaying] = useState(false);
  const auth = useAuth();
  const effectiveSpeed = rate !== null && rate !== undefined ? rate : (auth?.ttsSpeed || getGlobalTtsSpeed());

  const handleSpeak = (e) => {
    e.stopPropagation();

    if (playing) {
      stopJapaneseAudio();
      setPlaying(false);
      return;
    }

    speakJapanese(text, {
      audioUrl,
      rate: effectiveSpeed,
      speaker,
      onStart: () => setPlaying(true),
      onEnd: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };

  const dim = size === 'lg' ? '48px' : size === 'md' ? '38px' : '30px';
  const iconSize = size === 'lg' ? 22 : size === 'md' ? 18 : 15;

  const styleVariant =
    variant === 'green'
      ? {
          background: '#65a30d',
          color: '#ffffff',
          border: 'none',
        }
      : {};

  return (
    <button
      type="button"
      className={`btn ${variant === 'green' ? '' : 'btn-light text-primary'} border-0 shadow-none d-inline-flex align-items-center justify-content-center p-0 ${className}`}
      onClick={handleSpeak}
      title={`Nghe phát âm tiếng Nhật (Tốc độ ${effectiveSpeed}x)`}
      style={{
        borderRadius: '50%',
        width: dim,
        height: dim,
        flexShrink: 0,
        ...styleVariant,
      }}
    >
      {playing ? (
        <VolumeX size={iconSize} className={variant === 'green' ? 'text-white' : 'text-danger'} />
      ) : (
        <Volume2 size={iconSize} />
      )}
    </button>
  );
};

export default AudioButton;
