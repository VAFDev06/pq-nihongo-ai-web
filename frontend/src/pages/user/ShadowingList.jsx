import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import FuriganaText from '../../components/common/FuriganaText';
import ShadowingEvaluationPanel from '../../components/shadowing/ShadowingEvaluationPanel';
import { useAuth } from '../../auth/AuthContext';
import { TTS_SPEED_OPTIONS, speakJapanese, speakJapaneseSequence, stopJapaneseAudio } from '../../utils/tts';
import {
  ShadowingAudioRecorder,
  isMediaRecorderSupported,
  formatDuration,
} from '../../utils/shadowingRecorder';
import {
  Mic,
  MicOff,
  Play,
  History,
  Search,
  Sparkles,
  Edit3,
  List,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Youtube,
  Upload,
  Repeat,
  SkipForward,
  Star,
  Clock,
  CheckCircle2,
  Volume2,
  Languages,
  RefreshCw,
} from 'lucide-react';

// Hàm trích xuất YouTube Video ID chuẩn 11 ký tự từ mọi dạng URL YouTube
function extractYoutubeId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const regExp = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

function formatTime(sec) {
  if (sec === null || sec === undefined || Number.isNaN(Number(sec))) return '00:00';
  const total = Math.max(0, Math.floor(Number(sec)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const ShadowingList = () => {
  const { ttsSpeed, updateTtsSpeed } = useAuth();
  const [activeTab, setActiveTab] = useState('lessons'); // 'lessons' | 'youtube' | 'custom'
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('');
  const [search, setSearch] = useState('');

  // Custom Shadowing State (Multi-sentence translation + Voice reading, no manual Vietnamese input, no Pitch)
  const [customJa, setCustomJa] = useState(
    '今日は学校へ行きました。\n友達と日本語を勉強しました。\nとても楽しかったです。'
  );
  const [translatedSentences, setTranslatedSentences] = useState([]);
  const [translatingCustom, setTranslatingCustom] = useState(false);
  const [isPlayingCustomSeq, setIsPlayingCustomSeq] = useState(false);
  const [playingCustomIdx, setPlayingCustomIdx] = useState(-1);
  const [activeCustomTargetIdx, setActiveCustomTargetIdx] = useState(-1); // -1 = full text, >=0 = specific sentence
  const [isRecording, setIsRecording] = useState(false);
  const [customRecordingSec, setCustomRecordingSec] = useState(0);
  const [customAudioUrl, setCustomAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [customResult, setCustomResult] = useState(null);
  const [customError, setCustomError] = useState('');
  const [showCustomComparison, setShowCustomComparison] = useState(true);

  // YouTube Video Shadowing State (Section 3.2)
  const [ytUrlInput, setYtUrlInput] = useState('https://www.youtube.com/watch?v=86EKFDPTtgc');
  const [ytVideoId, setYtVideoId] = useState('');
  const [ytSegments, setYtSegments] = useState([]);
  const [ytLoadingCaptions, setYtLoadingCaptions] = useState(false);
  const [ytStatusStep, setYtStatusStep] = useState('');
  const [ytExtractMethod, setYtExtractMethod] = useState('');
  const [ytNotice, setYtNotice] = useState('');
  const [ytShowSubtitleInput, setYtShowSubtitleInput] = useState(false);
  const [ytRawSubtitles, setYtRawSubtitles] = useState('');
  const [ytActiveSegIndex, setYtActiveSegIndex] = useState(0);
  const [ytAutoAdvance, setYtAutoAdvance] = useState(false);
  const [ytLoopCurrent, setYtLoopCurrent] = useState(false);
  const [ytShowHiragana, setYtShowHiragana] = useState(true);
  const [ytShowTranslation, setYtShowTranslation] = useState(false); // Mặc định ẩn bản dịch để tập trung nghe tiếng Nhật, bật/tắt bằng nút "Hiện bản dịch / Ẩn bản dịch"
  const [ytShowDiff, setYtShowDiff] = useState(true);
  const [ytPlaybackRate, setYtPlaybackRate] = useState(1.0);
  const [ytHardIds, setYtHardIds] = useState(new Set());
  const [ytResultsBySegId, setYtResultsBySegId] = useState({});
  const [ytAudioUrlsBySegId, setYtAudioUrlsBySegId] = useState({});
  const [ytTranscript, setYtTranscript] = useState('');
  const [ytRecording, setYtRecording] = useState(false);
  const [ytRecordingSec, setYtRecordingSec] = useState(0);
  const [ytScoring, setYtScoring] = useState(false);
  const [ytFromCache, setYtFromCache] = useState(false);
  const [ytTranslatedCount, setYtTranslatedCount] = useState(0);
  const [ytPendingCount, setYtPendingCount] = useState(0);
  const [ytTranslatingBatch, setYtTranslatingBatch] = useState(false);
  const [ytRetranslatingId, setYtRetranslatingId] = useState(null);

  const ytPlayerRef = useRef(null);
  const ytIntervalRef = useRef(null);
  const ytSyncIntervalRef = useRef(null);
  const ytTranslateCancelRef = useRef(false);
  const ytSegmentsRef = useRef([]);
  const ytActiveSegIndexRef = useRef(0);
  const recorderRef = useRef(null);
  const customAudioUrlRef = useRef(null);
  const ytAudioUrlsRef = useRef({});
  const recognitionRef = useRef(null);
  const recordingTargetRef = useRef('custom'); // 'custom' | 'youtube'
  const latestCustomTranscriptRef = useRef('');
  const latestYtTranscriptRef = useRef('');
  const autoScoreTargetOnEndRef = useRef(null); // 'custom' | 'youtube' | null
  const isScoringCustomRef = useRef(false);
  const isScoringYtRef = useRef(false);
  const scoreCustomFnRef = useRef(null);
  const scoreYoutubeFnRef = useRef(null);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/shadowing/lessons');
      if (res.success && res.data) {
        setLessons(Array.isArray(res.data) ? res.data : res.data.content || []);
      }
    } catch (err) {
      console.error('Fetch shadowing lessons failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
    return () => {
      ytTranslateCancelRef.current = true;
      stopJapaneseAudio();
      recorderRef.current?.cancel();
      if (customAudioUrlRef.current) {
        try {
          URL.revokeObjectURL(customAudioUrlRef.current);
        } catch {}
      }
      Object.values(ytAudioUrlsRef.current).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
      if (ytSyncIntervalRef.current) clearInterval(ytSyncIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    ytSegmentsRef.current = ytSegments;
  }, [ytSegments]);

  useEffect(() => {
    ytActiveSegIndexRef.current = ytActiveSegIndex;
  }, [ytActiveSegIndex]);

  // Đồng bộ câu đang chọn với thời gian phát thực tế của trình phát YouTube
  useEffect(() => {
    if (activeTab !== 'youtube' || !ytVideoId) {
      if (ytSyncIntervalRef.current) clearInterval(ytSyncIntervalRef.current);
      return;
    }
    ytSyncIntervalRef.current = setInterval(() => {
      const player = ytPlayerRef.current;
      const segs = ytSegmentsRef.current;
      if (!player || typeof player.getPlayerState !== 'function' || segs.length === 0) return;
      try {
        // YT.PlayerState.PLAYING === 1
        if (player.getPlayerState() === 1 && !ytIntervalRef.current) {
          const curr = player.getCurrentTime();
          const foundIdx = segs.findIndex((s) => curr >= s.startTime && curr < s.endTime);
          if (foundIdx !== -1 && foundIdx !== ytActiveSegIndexRef.current) {
            setYtActiveSegIndex(foundIdx);
          }
        }
      } catch (e) {
        // ignore
      }
    }, 350);
    return () => {
      if (ytSyncIntervalRef.current) clearInterval(ytSyncIntervalRef.current);
    };
  }, [activeTab, ytVideoId]);

  // Load Official YouTube IFrame Player API
  useEffect(() => {
    if (activeTab !== 'youtube' || !ytVideoId) return;

    const initPlayer = () => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        ytPlayerRef.current.loadVideoById(ytVideoId);
        return;
      }
      ytPlayerRef.current = new window.YT.Player('yt-shadowing-player', {
        videoId: ytVideoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          cc_load_policy: 1,
        },
        events: {
          onReady: (e) => {
            try {
              e.target.setPlaybackRate(ytPlaybackRate);
            } catch (err) {
              // ignore
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    }
  }, [activeTab, ytVideoId]);

  // Web Speech API for Custom & YouTube Shadowing
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (recordingTargetRef.current === 'youtube') {
          latestYtTranscriptRef.current = currentTranscript;
          setYtTranscript(currentTranscript);
        } else {
          latestCustomTranscriptRef.current = currentTranscript;
          setTranscript(currentTranscript);
        }
      };

      recognition.onerror = () => {
        if (!recorderRef.current?.isRecording) {
          setIsRecording(false);
          setYtRecording(false);
          autoScoreTargetOnEndRef.current = null;
        }
      };

      recognition.onend = () => {
        if (recorderRef.current?.isRecording) return;
        setIsRecording(false);
        setYtRecording(false);
        const target = autoScoreTargetOnEndRef.current;
        autoScoreTargetOnEndRef.current = null;
        if (target === 'custom' && scoreCustomFnRef.current) {
          scoreCustomFnRef.current(latestCustomTranscriptRef.current);
        } else if (target === 'youtube' && scoreYoutubeFnRef.current) {
          scoreYoutubeFnRef.current(latestYtTranscriptRef.current);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Dịch tiếp các lô câu tiếng Nhật còn lại (PENDING) trong nền và lưu vào PostgreSQL
  const translateRemainingBatchesInBackground = async (vid) => {
    setYtTranslatingBatch(true);
    try {
      let guard = 0;
      while (!ytTranslateCancelRef.current && guard < 12) {
        guard++;
        const batchRes = await axiosClient.post(`/shadowing/youtube/${vid}/translate-batch?batchSize=45`);
        if (!batchRes?.success || !batchRes.data) break;
        const d = batchRes.data;
        if (Array.isArray(d.segments) && d.segments.length > 0) {
          setYtSegments(d.segments);
          setYtTranslatedCount(d.translatedCount ?? 0);
          setYtPendingCount(d.pendingCount ?? 0);
          setYtNotice(d.message || '');
        }
        if (!d.pendingCount || d.pendingCount <= 0) {
          break;
        }
      }
    } catch (err) {
      console.warn('Background batch translation paused:', err);
    } finally {
      setYtTranslatingBatch(false);
    }
  };

  // Dịch lại 1 câu bị lỗi hoặc chưa có bản dịch tiếng Việt
  const handleRetranslateSentence = async (e, sentenceId) => {
    if (e) e.stopPropagation();
    if (!ytVideoId || !sentenceId || ytRetranslatingId) return;
    setYtRetranslatingId(sentenceId);
    try {
      const res = await axiosClient.post(`/shadowing/youtube/${ytVideoId}/sentences/${sentenceId}/retranslate`);
      if (res.success && res.data) {
        setYtSegments((prev) =>
          prev.map((seg) => (seg.id === sentenceId || seg.sentenceId === sentenceId ? { ...seg, ...res.data } : seg))
        );
        setYtTranslatedCount((c) => c + 1);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Dịch lại câu thất bại. Vui lòng thử lại.');
    } finally {
      setYtRetranslatingId(null);
    }
  };

  // Load YouTube Video & Try Fetching Official Public Captions / Auto ASR / STT Fallback + Vietnamese Translation
  const handleLoadYoutubeVideo = async (e, overrideUrl = null) => {
    if (e) e.preventDefault();
    const urlToLoad = overrideUrl !== null ? overrideUrl : ytUrlInput;
    if (overrideUrl !== null) setYtUrlInput(overrideUrl);

    const vid = extractYoutubeId(urlToLoad);
    if (!vid) {
      setYtNotice('Đường dẫn YouTube không hợp lệ. Vui lòng nhập URL hợp lệ (VD: https://www.youtube.com/watch?v=...).');
      return;
    }

    ytTranslateCancelRef.current = true;
    setYtVideoId(vid);
    setYtLoadingCaptions(true);
    setYtStatusStep('Đang kiểm tra PostgreSQL, trích xuất phụ đề & dịch ngữ cảnh tiếng Việt...');
    setYtExtractMethod('');
    setYtFromCache(false);
    setYtTranslatedCount(0);
    setYtPendingCount(0);
    setYtNotice('');
    setYtSegments([]);
    setYtActiveSegIndex(0);

    try {
      const res = await axiosClient.get(`/shadowing/youtube/captions?videoId=${vid}`);
      if (res.success && res.data) {
        if (res.data.hasAutoCaptions && Array.isArray(res.data.segments) && res.data.segments.length > 0) {
          setYtSegments(res.data.segments);
          setYtShowSubtitleInput(false);
          setYtExtractMethod(res.data.method || 'METHOD_1_MANUAL_SUBTITLE');
          setYtFromCache(!!res.data.fromCache);
          setYtTranslatedCount(res.data.translatedCount ?? 0);
          setYtPendingCount(res.data.pendingCount ?? 0);
          setYtStatusStep(
            `Đã tải ${res.data.segments.length} câu (${res.data.translatedCount ?? 0}/${res.data.segments.length} đã dịch tiếng Việt)`
          );
          setYtNotice(res.data.message);

          if ((res.data.pendingCount ?? 0) > 0) {
            ytTranslateCancelRef.current = false;
            translateRemainingBatchesInBackground(vid);
          }
        } else {
          setYtShowSubtitleInput(true);
          setYtStatusStep('Cần nhập phụ đề thủ công (.SRT / .VTT)');
          setYtNotice(
            res.data.message ||
              'Không lấy được phụ đề tự động từ video này. Vui lòng tải file phụ đề (.SRT / .VTT) hoặc nhập phụ đề có timestamp bên dưới.'
          );
        }
      }
    } catch (err) {
      setYtShowSubtitleInput(true);
      setYtStatusStep('Lỗi kết nối khi trích xuất transcript');
      setYtNotice('Không thể tải phụ đề tự động. Bạn có thể tải file .SRT/.VTT hoặc nhập phụ đề kèm mốc thời gian bên dưới.');
    } finally {
      setYtLoadingCaptions(false);
    }
  };

  const handleSubtitleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setYtRawSubtitles(text);
    await handleParseManualSubtitles(text);
  };

  const handleParseManualSubtitles = async (rawTextOverride = null) => {
    const contentToParse = rawTextOverride !== null ? rawTextOverride : ytRawSubtitles;
    if (!contentToParse || !contentToParse.trim()) {
      setYtNotice('Vui lòng dán nội dung phụ đề (.SRT / .VTT hoặc "MM:SS - MM:SS Câu tiếng Nhật") trước khi phân tích.');
      return;
    }

    try {
      const res = await axiosClient.post('/shadowing/youtube/parse-subtitles', {
        content: contentToParse,
        videoId: ytVideoId || '',
      });
      if (res.success && Array.isArray(res.data)) {
        setYtSegments(res.data);
        setYtActiveSegIndex(0);
        setYtShowSubtitleInput(false);
        const trCount = res.data.filter((s) => s.vietnameseTranslation || s.textVi).length;
        setYtTranslatedCount(trCount);
        setYtPendingCount(Math.max(0, res.data.length - trCount));
        setYtNotice(`Đã phân tích thành công ${res.data.length} câu kèm Hiragana và bản dịch tiếng Việt (${trCount}/${res.data.length})!`);
      }
    } catch (err) {
      setYtNotice(err.response?.data?.message || 'Định dạng phụ đề chưa hợp lệ. Hãy dùng chuẩn SRT/VTT hoặc "00:05 - 00:09 Câu tiếng Nhật".');
    }
  };

  const playYoutubeSegment = (index) => {
    const seg = ytSegments[index];
    if (!seg) return;
    setYtActiveSegIndex(index);
    setYtTranscript('');

    const player = ytPlayerRef.current;
    if (player && typeof player.seekTo === 'function') {
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
      try {
        player.setPlaybackRate(ytPlaybackRate);
      } catch (e) {
        // ignore
      }
      player.seekTo(seg.startTime, true);
      player.playVideo();

      ytIntervalRef.current = setInterval(() => {
        try {
          const curr = player.getCurrentTime();
          if (curr >= seg.endTime) {
            if (ytLoopCurrent) {
              player.seekTo(seg.startTime, true);
            } else {
              player.pauseVideo();
              clearInterval(ytIntervalRef.current);
              ytIntervalRef.current = null;
            }
          }
        } catch (err) {
          clearInterval(ytIntervalRef.current);
          ytIntervalRef.current = null;
        }
      }, 150);
    } else {
      // Fallback đọc bằng TTS nếu trình phát đang khởi tạo
      speakJapanese(seg.textJa, { rate: ttsSpeed });
    }
  };

  const evaluateYoutubeAudioWithLocalAi = async (recording, fallbackText = '') => {
    const seg = ytSegmentsRef.current[ytActiveSegIndexRef.current];
    if (!seg) return;
    if (!recording?.blob || recording.blob.size === 0) {
      setYtNotice('Không thu được dữ liệu âm thanh từ micro. Vui lòng thử ghi âm lại.');
      return;
    }
    if (recording.durationSec < 0.35) {
      setYtNotice('Thời gian ghi âm quá ngắn. Vui lòng đọc trọn câu tiếng Nhật.');
      return;
    }
    if (isScoringYtRef.current) return;

    if (recording.objectUrl) {
      setYtAudioUrlsBySegId((prev) => {
        if (prev[seg.id]) {
          try {
            URL.revokeObjectURL(prev[seg.id]);
          } catch {}
        }
        const next = { ...prev, [seg.id]: recording.objectUrl };
        ytAudioUrlsRef.current = next;
        return next;
      });
    }

    isScoringYtRef.current = true;
    setYtScoring(true);
    try {
      const formData = new FormData();
      formData.append('audio', recording.blob, recording.filename || 'youtube-shadowing.webm');
      formData.append('textJa', seg.textJa || '');
      if (seg.vietnameseTranslation || seg.textVi) {
        formData.append('textVi', seg.vietnameseTranslation || seg.textVi);
      }
      formData.append('playbackSpeed', String(ytPlaybackRate || 1.0));
      if (fallbackText && fallbackText.trim()) {
        formData.append('fallbackTranscript', fallbackText.trim());
      }

      const res = await axiosClient.post('/shadowing/custom/evaluate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 130000,
      });

      if (res.success && res.data) {
        const recognized = res.data.recognizedText || fallbackText || '';
        latestYtTranscriptRef.current = recognized;
        setYtTranscript(recognized);
        setYtShowDiff(true);
        setYtResultsBySegId((prev) => ({
          ...prev,
          [seg.id]: res.data,
        }));

        if (ytAutoAdvance && ytActiveSegIndexRef.current + 1 < ytSegmentsRef.current.length) {
          setTimeout(() => {
            playYoutubeSegment(ytActiveSegIndexRef.current + 1);
          }, 1200);
        }
      }
    } catch (err) {
      setYtNotice(err.response?.data?.message || 'Chấm điểm phát âm bằng Local AI thất bại.');
    } finally {
      setYtScoring(false);
      isScoringYtRef.current = false;
    }
  };

  const toggleYoutubeRecording = async () => {
    if (ytRecording) {
      setYtRecording(false);
      if (recorderRef.current?.isRecording) {
        autoScoreTargetOnEndRef.current = null;
        try {
          recognitionRef.current?.stop();
        } catch {}
        const recording = await recorderRef.current.stop();
        await evaluateYoutubeAudioWithLocalAi(recording, latestYtTranscriptRef.current);
        return;
      }
      autoScoreTargetOnEndRef.current = 'youtube';
      try {
        recognitionRef.current?.stop();
      } catch {
        setYtRecording(false);
      }
      return;
    }

    if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {}
    }
    recordingTargetRef.current = 'youtube';
    autoScoreTargetOnEndRef.current = null;
    latestYtTranscriptRef.current = '';
    setYtRecordingSec(0);
    setYtTranscript('');

    if (isMediaRecorderSupported()) {
      try {
        const recorder = new ShadowingAudioRecorder({
          onDurationChange: (sec) => setYtRecordingSec(sec),
          maxSeconds: 35,
        });
        recorderRef.current = recorder;
        await recorder.start();
        setYtRecording(true);
        try {
          recognitionRef.current?.start();
        } catch {}
      } catch (err) {
        setYtNotice(
          err?.name === 'NotAllowedError'
            ? 'Vui lòng cấp quyền Micro cho trình duyệt để ghi âm.'
            : err?.message || 'Không thể khởi động micro.'
        );
      }
      return;
    }

    if (!recognitionRef.current) {
      setYtShowDiff(true);
      setYtNotice('Trình duyệt không hỗ trợ ghi âm micro hoặc Web Speech API.');
      return;
    }

    try {
      recognitionRef.current.start();
      setYtRecording(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScoreYoutubeSegment = async (overrideText = null) => {
    const seg = ytSegments[ytActiveSegIndex];
    if (!seg) return;
    const textToScore = (overrideText !== null && typeof overrideText === 'string' ? overrideText : ytTranscript).trim();
    if (!textToScore) {
      setYtNotice('Chưa nhận diện được giọng nói từ micro. Vui lòng bấm Ghi âm và đọc to câu tiếng Nhật trong video.');
      return;
    }
    if (isScoringYtRef.current) return;

    isScoringYtRef.current = true;
    setYtScoring(true);
    try {
      const res = await axiosClient.post('/shadowing/custom-score', {
        textJa: seg.textJa,
        recognizedText: textToScore,
        playbackSpeed: ytPlaybackRate,
      });

      if (res.success && res.data) {
        setYtShowDiff(true);
        setYtResultsBySegId((prev) => ({
          ...prev,
          [seg.id]: res.data,
        }));

        if (ytAutoAdvance && ytActiveSegIndex + 1 < ytSegments.length) {
          setTimeout(() => {
            playYoutubeSegment(ytActiveSegIndex + 1);
          }, 1200);
        }
      }
    } catch (err) {
      setYtNotice(err.response?.data?.message || 'Chấm điểm câu thất bại.');
    } finally {
      setYtScoring(false);
      isScoringYtRef.current = false;
    }
  };

  const evaluateCustomAudioWithLocalAi = async (recording, fallbackText = '') => {
    const targetSentenceObj =
      activeCustomTargetIdx >= 0 && translatedSentences[activeCustomTargetIdx]
        ? translatedSentences[activeCustomTargetIdx]
        : null;
    const expectedJa = targetSentenceObj ? targetSentenceObj.japanese : customJa.trim();
    const expectedVi = targetSentenceObj
      ? targetSentenceObj.vietnamese
      : translatedSentences.map((s) => s.vietnamese).filter(Boolean).join(' ');

    if (!expectedJa) {
      setCustomError('Vui lòng nhập câu tiếng Nhật bạn muốn luyện tập.');
      return;
    }
    if (!recording?.blob || recording.blob.size === 0) {
      setCustomError('Không thu được dữ liệu âm thanh từ micro. Vui lòng thử ghi âm lại.');
      return;
    }
    if (recording.durationSec < 0.35) {
      setCustomError('Thời gian ghi âm quá ngắn. Vui lòng đọc trọn câu tiếng Nhật.');
      return;
    }
    if (isScoringCustomRef.current) return;

    if (recording.objectUrl) {
      if (customAudioUrlRef.current) {
        try {
          URL.revokeObjectURL(customAudioUrlRef.current);
        } catch {}
      }
      customAudioUrlRef.current = recording.objectUrl;
      setCustomAudioUrl(recording.objectUrl);
    }

    isScoringCustomRef.current = true;
    setSubmittingCustom(true);
    setCustomError('');

    try {
      const formData = new FormData();
      formData.append('audio', recording.blob, recording.filename || 'custom-shadowing.webm');
      formData.append('textJa', expectedJa);
      if (expectedVi) formData.append('textVi', expectedVi);
      formData.append('playbackSpeed', String(ttsSpeed || 1.0));
      if (fallbackText && fallbackText.trim()) {
        formData.append('fallbackTranscript', fallbackText.trim());
      }

      const res = await axiosClient.post('/shadowing/custom/evaluate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 130000,
      });

      if (res.success && res.data) {
        const recognized = res.data.recognizedText || fallbackText || '';
        latestCustomTranscriptRef.current = recognized;
        setTranscript(recognized);
        setCustomResult({ ...res.data, expectedJa });
        setShowCustomComparison(true);
      }
    } catch (err) {
      setCustomError(
        err.response?.data?.message ||
          'Chấm điểm phát âm bằng Local AI thất bại. Bạn có thể kiểm tra Local AI server hoặc dùng nút chấm lại theo văn bản.'
      );
    } finally {
      setSubmittingCustom(false);
      isScoringCustomRef.current = false;
    }
  };

  const toggleRecordingCustom = async () => {
    if (isRecording) {
      setIsRecording(false);
      if (recorderRef.current?.isRecording) {
        autoScoreTargetOnEndRef.current = null;
        try {
          recognitionRef.current?.stop();
        } catch {}
        const recording = await recorderRef.current.stop();
        await evaluateCustomAudioWithLocalAi(recording, latestCustomTranscriptRef.current);
        return;
      }
      autoScoreTargetOnEndRef.current = 'custom';
      try {
        recognitionRef.current?.stop();
      } catch {
        setIsRecording(false);
      }
      return;
    }

    stopJapaneseAudio();
    recordingTargetRef.current = 'custom';
    autoScoreTargetOnEndRef.current = null;
    latestCustomTranscriptRef.current = '';
    setCustomRecordingSec(0);
    setTranscript('');
    setCustomResult(null);
    setCustomError('');

    if (isMediaRecorderSupported()) {
      try {
        const recorder = new ShadowingAudioRecorder({
          onDurationChange: (sec) => setCustomRecordingSec(sec),
          maxSeconds: 35,
        });
        recorderRef.current = recorder;
        await recorder.start();
        setIsRecording(true);
        try {
          recognitionRef.current?.start();
        } catch {}
      } catch (err) {
        setCustomError(
          err?.name === 'NotAllowedError'
            ? 'Trình duyệt chưa được cấp quyền Micro. Vui lòng bật quyền Micro và thử lại.'
            : err?.message || 'Không thể bắt đầu ghi âm từ micro.'
        );
      }
      return;
    }

    if (!recognitionRef.current) {
      setShowCustomComparison(true);
      setCustomError('Trình duyệt không hỗ trợ ghi âm micro hoặc Web Speech API tiếng Nhật.');
      return;
    }

    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Start recording failed:', err);
    }
  };

  const splitCustomSentencesClient = (raw) => {
    const normalized = String(raw || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];
    const out = [];
    normalized.split(/\n+/).forEach((line) => {
      const t = line.trim();
      if (!t) return;
      const parts = t.match(/[^。！？!?]+[。！？!?]*[」』）)]*/g);
      if (parts) {
        parts.forEach((p) => {
          const s = p.trim();
          if (s) out.push(s);
        });
      } else {
        out.push(t);
      }
    });
    return out;
  };

  const handleTranslateCustom = async () => {
    if (!customJa.trim()) {
      setCustomError('Vui lòng nhập ít nhất một câu tiếng Nhật để dịch.');
      return;
    }
    setTranslatingCustom(true);
    setCustomError('');
    try {
      const res = await axiosClient.post('/shadowing/custom/translate', {
        text: customJa.trim(),
      });
      if (res.success && res.data && Array.isArray(res.data.sentences)) {
        setTranslatedSentences(res.data.sentences);
        setActiveCustomTargetIdx(-1);
      }
    } catch (err) {
      setCustomError(
        err.response?.data?.message || 'Dịch câu tiếng Nhật thất bại. Vui lòng kiểm tra cấu hình Gemini API Key.'
      );
    } finally {
      setTranslatingCustom(false);
    }
  };

  const handleSpeakAllCustomJapanese = () => {
    if (isPlayingCustomSeq) {
      stopJapaneseAudio();
      setIsPlayingCustomSeq(false);
      setPlayingCustomIdx(-1);
      return;
    }
    const items =
      translatedSentences.length > 0
        ? translatedSentences.map((s) => s.japanese)
        : splitCustomSentencesClient(customJa);
    if (items.length === 0) {
      setCustomError('Vui lòng nhập câu tiếng Nhật trước khi bấm đọc.');
      return;
    }
    setCustomError('');
    setIsPlayingCustomSeq(true);
    speakJapaneseSequence(items, {
      rate: ttsSpeed,
      pauseMs: 320,
      onItemStart: (idx) => setPlayingCustomIdx(idx),
      onEnd: () => {
        setIsPlayingCustomSeq(false);
        setPlayingCustomIdx(-1);
      },
      onError: () => {
        setIsPlayingCustomSeq(false);
        setPlayingCustomIdx(-1);
      },
    });
  };

  const handleScoreCustom = async (overrideText = null) => {
    const targetSentenceObj =
      activeCustomTargetIdx >= 0 && translatedSentences[activeCustomTargetIdx]
        ? translatedSentences[activeCustomTargetIdx]
        : null;
    const expectedJa = targetSentenceObj ? targetSentenceObj.japanese : customJa.trim();
    const expectedVi = targetSentenceObj
      ? targetSentenceObj.vietnamese
      : translatedSentences.map((s) => s.vietnamese).filter(Boolean).join(' ');

    if (!expectedJa) {
      setCustomError('Vui lòng nhập câu tiếng Nhật bạn muốn luyện tập.');
      return;
    }
    const textToScore = (overrideText !== null && typeof overrideText === 'string' ? overrideText : transcript).trim();
    if (!textToScore) {
      setCustomError('Chưa nhận diện được giọng nói từ micro. Vui lòng bấm micro và đọc to câu tiếng Nhật.');
      return;
    }
    if (isScoringCustomRef.current) return;

    isScoringCustomRef.current = true;
    setSubmittingCustom(true);
    setCustomError('');

    try {
      const res = await axiosClient.post('/shadowing/custom-score', {
        textJa: expectedJa,
        textVi: expectedVi,
        recognizedText: textToScore,
        playbackSpeed: ttsSpeed,
      });

      if (res.success && res.data) {
        setCustomResult({ ...res.data, expectedJa });
        setShowCustomComparison(true);
      }
    } catch (err) {
      setCustomError(err.response?.data?.message || 'Chấm điểm phát âm thất bại.');
    } finally {
      setSubmittingCustom(false);
      isScoringCustomRef.current = false;
    }
  };

  scoreCustomFnRef.current = handleScoreCustom;
  scoreYoutubeFnRef.current = handleScoreYoutubeSegment;

  const filtered = lessons.filter((lesson) => {
    const matchesLevel = !levelFilter || lesson.jlptLevel === levelFilter;
    const matchesSearch =
      !search ||
      lesson.title?.toLowerCase().includes(search.toLowerCase()) ||
      lesson.japaneseText?.includes(search) ||
      lesson.vietnameseMeaning?.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const activeYtSegment = ytSegments[ytActiveSegIndex] || null;
  const activeYtResult = activeYtSegment ? ytResultsBySegId[activeYtSegment.id] : null;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h3 className="fw-bold mb-1">Luyện phản xạ & phát âm (Shadowing)</h3>
          <p className="text-muted small mb-0">
            Luyện nói theo câu mẫu, luyện Shadowing theo từng câu trong Video YouTube hoặc tự nhập câu của bạn với tốc độ đọc tự nhiên.
          </p>
        </div>

        <Link to="/app/shadowing/history" className="btn btn-outline-secondary d-flex align-items-center gap-1.5 shadow-sm">
          <History size={16} />
          <span>Lịch sử luyện tập</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="d-flex flex-wrap gap-2 border-bottom pb-2">
        <button
          className={`btn btn-sm d-flex align-items-center gap-1.5 px-3.5 py-2 fw-semibold rounded-pill ${
            activeTab === 'lessons' ? 'btn-primary' : 'btn-light text-secondary'
          }`}
          onClick={() => setActiveTab('lessons')}
        >
          <List size={16} />
          <span>Shadowing theo chủ đề ({lessons.length})</span>
        </button>

        <button
          className={`btn btn-sm d-flex align-items-center gap-1.5 px-3.5 py-2 fw-semibold rounded-pill ${
            activeTab === 'youtube' ? 'btn-danger text-white' : 'btn-light text-secondary'
          }`}
          onClick={() => setActiveTab('youtube')}
        >
          <Youtube size={16} />
          <span>Shadowing theo Video YouTube</span>
        </button>

        <button
          className={`btn btn-sm d-flex align-items-center gap-1.5 px-3.5 py-2 fw-semibold rounded-pill ${
            activeTab === 'custom' ? 'btn-primary' : 'btn-light text-secondary'
          }`}
          onClick={() => setActiveTab('custom')}
        >
          <Edit3 size={16} />
          <span>Tự nhập câu của bạn</span>
        </button>
      </div>

      {/* TAB 1: BÀI HỌC HỆ THỐNG */}
      {activeTab === 'lessons' && (
        <>
          <div className="card pq-card p-3 shadow-sm border-0">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-8">
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0 text-muted">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    className="form-control bg-light border-start-0 ps-1"
                    placeholder="Tìm bài học theo tiêu đề, câu tiếng Nhật hoặc nghĩa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-12 col-md-4">
                <select
                  className="form-select bg-light"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                >
                  <option value="">Tất cả cấp độ JLPT</option>
                  <option value="N5">N5 - Nhập môn</option>
                  <option value="N4">N4 - Sơ cấp</option>
                  <option value="N3">N3 - Trung cấp</option>
                  <option value="N2">N2 - Trung cao</option>
                  <option value="N1">N1 - Cao cấp</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted small mt-2">Đang tải danh sách bài học...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card pq-card text-center py-5 text-muted shadow-sm border-0">
              <Mic size={48} className="opacity-50 mb-2 mx-auto" />
              <h6>Không tìm thấy bài học Shadowing nào.</h6>
            </div>
          ) : (
            <div className="row g-4">
              {filtered.map((item) => {
                const isDialogue = item.isDialogue || (item.lineCount && item.lineCount > 1);
                return (
                  <div key={item.id} className="col-12 col-md-6">
                    <div className="card pq-card p-4 h-100 d-flex flex-column justify-content-between gap-3">
                      <div>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                          <div className="d-flex align-items-center gap-1.5">
                            <span className={`badge badge-jlpt-${(item.jlptLevel || 'n5').toLowerCase()} px-2 py-1`}>
                              {item.jlptLevel || 'N5'}
                            </span>
                            {isDialogue && (
                              <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1">
                                Hội thoại A/B · {item.lineCount} câu
                              </span>
                            )}
                          </div>
                          <span className="small text-muted">{item.topicNameVi || item.topic || 'Giao tiếp hàng ngày'}</span>
                        </div>

                        <h5 className="fw-bold text-dark mb-2">{item.title}</h5>
                        {item.description && (
                          <p className="text-muted small mb-2">{item.description}</p>
                        )}

                        <div className="p-3 bg-light rounded-3 mb-2 font-jp fs-6 fw-bold text-dark border">
                          <FuriganaText text={`${item.japaneseText || item.textJa}[${item.reading || ''}]`} />
                        </div>

                        <p className="text-muted small mb-0">{item.vietnameseMeaning || item.textVi}</p>
                      </div>

                      <div className="d-flex align-items-center justify-content-between border-top pt-3">
                        <div className="d-flex align-items-center gap-2">
                          <AudioButton text={item.japaneseText || item.textJa} audioUrl={item.audioUrl} />
                          <span className="small text-muted">Nghe mẫu ({ttsSpeed}x)</span>
                        </div>
                        <Link
                          to={`/app/shadowing/practice/${item.id}`}
                          className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm fw-semibold"
                        >
                          <Mic size={14} />
                          <span>{isDialogue ? 'Luyện hội thoại' : 'Vào luyện nói'}</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: YOUTUBE VIDEO SHADOWING (SECTION 3.2) */}
      {activeTab === 'youtube' && (
        <div className="d-flex flex-column gap-4">
          {/* URL Input Bar */}
          <div className="card pq-card p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                  <Youtube size={22} className="text-danger" />
                  <span>YouTube Video Shadowing — Luyện nói theo từng câu trong video</span>
                </h5>
                <div className="small text-muted">
                  Nhập đường dẫn video YouTube có tiếng Nhật để nhúng trình phát chính thức và luyện nói theo từng câu kèm timestamp.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setYtShowSubtitleInput((prev) => !prev)}
              >
                {ytShowSubtitleInput ? 'Ẩn khung nhập phụ đề SRT/VTT' : 'Nhập / Tải file phụ đề (.SRT / .VTT)'}
              </button>
            </div>

            <form onSubmit={handleLoadYoutubeVideo} className="row g-2">
              <div className="col-12 col-md-9">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Dán đường dẫn YouTube vào đây (VD: https://www.youtube.com/watch?v=...)"
                  value={ytUrlInput}
                  onChange={(e) => setYtUrlInput(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-3">
                <button
                  type="submit"
                  className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                  disabled={ytLoadingCaptions || !ytUrlInput.trim()}
                >
                  {ytLoadingCaptions ? (
                    <>
                      <Loader2 size={16} className="spinner-border spinner-border-sm" />
                      <span>Đang tải video...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Tải Video & Phụ đề</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick sample video button & pipeline status */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
              <div className="d-flex flex-wrap align-items-center gap-2 small">
                <span className="text-muted">Video mẫu tiếng Nhật có sẵn phụ đề:</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger py-0.5 px-2"
                  onClick={() => handleLoadYoutubeVideo(null, 'https://www.youtube.com/watch?v=86EKFDPTtgc')}
                >
                  ▶ Describe What You See in Japan! (N4 - Ken-san)
                </button>
              </div>
              {ytStatusStep && (
                <span className="badge bg-light text-dark border px-2.5 py-1.5">
                  Trạng thái: <strong>{ytStatusStep}</strong>
                  {ytExtractMethod && ` [${ytExtractMethod}]`}
                </span>
              )}
            </div>

            {ytNotice && (
              <div className={`alert ${ytSegments.length > 0 ? 'alert-success' : 'alert-info'} d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 px-3 small rounded-3 mt-3 mb-0`}>
                <div>
                  {ytNotice}
                  {ytFromCache && (
                    <span className="badge bg-success ms-2">Đã lưu PostgreSQL</span>
                  )}
                </div>
                {ytTranslatingBatch && (
                  <span className="d-inline-flex align-items-center gap-1 text-primary fw-semibold">
                    <Loader2 size={14} className="spinner-border spinner-border-sm" />
                    Đang dịch tiếp bản dịch tiếng Việt ({ytTranslatedCount}/{ytSegments.length} câu)...
                  </span>
                )}
              </div>
            )}

            {/* Manual SRT/VTT or Timestamped Transcript Input when video has no public auto captions */}
            {ytShowSubtitleInput && (
              <div className="mt-3 p-3 bg-light rounded-3 border">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div className="small fw-bold text-dark">
                    Tải file phụ đề chuẩn (.SRT / .VTT) hoặc dán phụ đề kèm mốc thời gian thật:
                  </div>
                  <label className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 mb-0" style={{ cursor: 'pointer' }}>
                    <Upload size={14} />
                    <span>Chọn file .SRT / .VTT từ máy tính</span>
                    <input
                      type="file"
                      accept=".srt,.vtt,.txt"
                      className="d-none"
                      onChange={handleSubtitleFileUpload}
                    />
                  </label>
                </div>

                <textarea
                  className="form-control font-jp small mb-2"
                  rows={5}
                  placeholder={`Ví dụ định dạng SRT hoặc dòng có timestamp:\n00:00 - 00:04 こんにちは、皆さん。今日も日本語を勉強しましょう。\n00:04 - 00:09 朝ごはんは何を食べましたか。\n00:09 - 00:14 私はパンとコーヒーをいただきました。`}
                  value={ytRawSubtitles}
                  onChange={(e) => setYtRawSubtitles(e.target.value)}
                />

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleParseManualSubtitles()}
                  >
                    Phân tích phụ đề & Đồng bộ Timestamp
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Main YouTube Player + Timeline Split View */}
          {ytVideoId && (
            <div className="row g-4">
              {/* Left: Official YouTube Embed + Active Sentence Shadowing Box */}
              <div className="col-12 col-lg-7">
                <div className="card pq-card p-3 mb-3">
                  <div className="ratio ratio-16x9 rounded-3 overflow-hidden bg-dark">
                    <div id="yt-shadowing-player" />
                  </div>

                  {/* Playback controls toolbar */}
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 pt-2 border-top">
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-secondary fw-semibold">Tốc độ Video:</span>
                      {[0.75, 1.0, 1.25, 1.5].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          className={`btn btn-sm py-0.5 px-2 ${
                            ytPlaybackRate === spd ? 'btn-primary fw-bold' : 'btn-outline-secondary'
                          }`}
                          onClick={() => {
                            setYtPlaybackRate(spd);
                            if (ytPlayerRef.current && typeof ytPlayerRef.current.setPlaybackRate === 'function') {
                              try {
                                ytPlayerRef.current.setPlaybackRate(spd);
                              } catch (e) {}
                            }
                          }}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm d-flex align-items-center gap-1 ${
                          ytLoopCurrent ? 'btn-warning text-dark fw-semibold' : 'btn-light border text-secondary'
                        }`}
                        onClick={() => setYtLoopCurrent(!ytLoopCurrent)}
                      >
                        <Repeat size={14} />
                        <span>Lặp câu</span>
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm d-flex align-items-center gap-1 ${
                          ytAutoAdvance ? 'btn-success text-white fw-semibold' : 'btn-light border text-secondary'
                        }`}
                        onClick={() => setYtAutoAdvance(!ytAutoAdvance)}
                      >
                        <SkipForward size={14} />
                        <span>Tự chuyển câu</span>
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm d-flex align-items-center gap-1 ${
                          ytShowHiragana ? 'btn-outline-primary fw-semibold' : 'btn-light border text-secondary'
                        }`}
                        onClick={() => setYtShowHiragana(!ytShowHiragana)}
                      >
                        {ytShowHiragana ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>{ytShowHiragana ? 'Ẩn Hiragana' : 'Hiện Hiragana'}</span>
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm d-flex align-items-center gap-1 ${
                          ytShowTranslation ? 'btn-primary text-white fw-semibold' : 'btn-outline-success fw-semibold'
                        }`}
                        onClick={() => setYtShowTranslation(!ytShowTranslation)}
                      >
                        <Languages size={14} />
                        <span>{ytShowTranslation ? 'Ẩn bản dịch' : 'Hiện bản dịch'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Sentence Practice Card */}
                {activeYtSegment && (
                  <div className="card pq-card p-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                      <span className="badge bg-primary px-3 py-2">
                        Câu {ytActiveSegIndex + 1} · Thời gian: {formatTime(activeYtSegment.startTime)} – {formatTime(activeYtSegment.endTime)}
                      </span>

                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                          onClick={() => playYoutubeSegment(ytActiveSegIndex)}
                        >
                          <Play size={14} /> Phát câu hiện tại
                        </button>
                        <button
                          type="button"
                          className="btn btn-light border btn-sm d-flex align-items-center gap-1"
                          onClick={() => speakJapanese(activeYtSegment.textJa, { rate: ttsSpeed })}
                        >
                          <Volume2 size={14} /> Giọng mẫu ({ttsSpeed}x)
                        </button>
                        <button
                          type="button"
                          className="btn btn-light border btn-sm d-flex align-items-center gap-1"
                          disabled={ytActiveSegIndex >= ytSegments.length - 1}
                          onClick={() => playYoutubeSegment(ytActiveSegIndex + 1)}
                        >
                          <SkipForward size={14} /> Câu tiếp theo
                        </button>
                      </div>
                    </div>

                    {/* Câu tiếng Nhật + Hiragana + Bản dịch tiếng Việt (bật/tắt) */}
                    <div className="fs-4 fw-bold font-jp text-dark mb-2">{activeYtSegment.textJa}</div>
                    {ytShowHiragana && activeYtSegment.reading && (
                      <div className="text-primary font-jp mb-3">{activeYtSegment.reading}</div>
                    )}

                    {ytShowTranslation ? (
                      <div className="p-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3 mb-3">
                        {activeYtSegment.vietnameseTranslation || activeYtSegment.textVi ? (
                          <div className="text-dark">
                            <span className="fw-bold text-success me-1">Nghĩa:</span>
                            <span>{activeYtSegment.vietnameseTranslation || activeYtSegment.textVi}</span>
                          </div>
                        ) : (
                          <div className="d-flex justify-content-between align-items-center gap-2 small">
                            <span className="text-muted fst-italic">
                              {activeYtSegment.translationStatus === 'FAILED'
                                ? 'Chưa dịch được câu này.'
                                : 'Đang chờ dịch tiếng Việt...'}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                              disabled={ytRetranslatingId === activeYtSegment.id}
                              onClick={(e) => handleRetranslateSentence(e, activeYtSegment.id)}
                            >
                              <RefreshCw size={13} className={ytRetranslatingId === activeYtSegment.id ? 'spinner-border spinner-border-sm' : ''} />
                              <span>Dịch lại</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="small text-muted mb-3">
                        Bản dịch tiếng Việt đang ẩn để bạn tập trung luyện nghe tiếng Nhật. Bấm{' '}
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold align-baseline"
                          onClick={() => setYtShowTranslation(true)}
                        >
                          Hiện bản dịch
                        </button>{' '}
                        khi cần kiểm tra nghĩa.
                      </div>
                    )}

                    <div className="d-flex flex-wrap align-items-center gap-2 pt-2 border-top">
                      <button
                        type="button"
                        className={`btn ${ytRecording ? 'btn-danger' : 'btn-primary'} d-flex align-items-center gap-1.5 rounded-pill px-3`}
                        onClick={toggleYoutubeRecording}
                      >
                        {ytRecording ? <MicOff size={16} /> : <Mic size={16} />}
                        <span>
                          {ytRecording
                            ? `Dừng ghi âm (${formatDuration(ytRecordingSec)})`
                            : 'Ghi âm câu này (Local AI)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1.5 rounded-pill px-3"
                        onClick={() => handleScoreYoutubeSegment()}
                        disabled={ytScoring || ytRecording || !ytTranscript.trim()}
                      >
                        {ytScoring ? <Loader2 size={15} className="spinner-border spinner-border-sm" /> : <Sparkles size={15} />}
                        <span>Chấm lại</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-light border btn-sm ms-auto"
                        onClick={() => setYtShowDiff(!ytShowDiff)}
                      >
                        {ytShowDiff ? 'Ẩn văn bản đối chiếu' : 'Hiện văn bản đối chiếu'}
                      </button>
                    </div>

                    {(ytShowDiff || ytTranscript || ytRecording) && (
                      <div className="mt-3">
                        <div className="small fw-semibold text-secondary mb-1">Bạn đã nói:</div>
                        <input
                          type="text"
                          className="form-control font-jp"
                          placeholder="Câu nhận diện từ giọng nói của bạn..."
                          value={ytTranscript}
                          onChange={(e) => {
                            latestYtTranscriptRef.current = e.target.value;
                            setYtTranscript(e.target.value);
                          }}
                        />
                      </div>
                    )}

                    {activeYtResult && (
                      <div className="mt-3">
                        <ShadowingEvaluationPanel
                          attemptResult={activeYtResult}
                          expectedTextJa={activeYtSegment.textJa}
                          recordedAudioUrl={ytAudioUrlsBySegId[activeYtSegment.id] || null}
                          title={`Kết quả câu ${ytActiveSegIndex + 1}`}
                          showComparisonText={ytShowDiff}
                          onToggleComparisonText={() => setYtShowDiff((v) => !v)}
                          compact
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Sentence Timeline List */}
              <div className="col-12 col-lg-5">
                <div className="card pq-card p-3 h-100">
                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <span className="fw-bold text-dark">
                      Danh sách câu theo Timeline ({ytSegments.length} câu)
                    </span>
                    <span className="small text-muted">
                      Đã luyện: {Object.keys(ytResultsBySegId).length}/{ytSegments.length}
                    </span>
                  </div>

                  {ytSegments.length === 0 ? (
                    <div className="text-center py-5 text-muted small">
                      Chưa có danh sách câu. Hãy bấm <strong>"Nhập / Tải file phụ đề (.SRT / .VTT)"</strong> phía trên để nạp phụ đề có timestamp thật cho video này.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2 overflow-auto" style={{ maxHeight: '520px' }}>
                      {ytSegments.map((seg, idx) => {
                        const isCurrent = idx === ytActiveSegIndex;
                        const segRes = ytResultsBySegId[seg.id];
                        const isHard = ytHardIds.has(seg.id);

                        return (
                          <div
                            key={seg.id || idx}
                            className={`p-3 rounded-3 border ${
                              isCurrent ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'
                            }`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => playYoutubeSegment(idx)}
                          >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-dark text-white d-inline-flex align-items-center gap-1">
                                  <Clock size={11} />
                                  {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
                                </span>
                                {segRes ? (
                                  <span className="badge bg-success d-inline-flex align-items-center gap-1">
                                    <CheckCircle2 size={11} /> Đã luyện ({Math.round(segRes.accuracy)}%)
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary bg-opacity-25 text-secondary">
                                    Chưa luyện
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                className={`btn btn-sm p-0 border-0 ${isHard ? 'text-warning' : 'text-muted'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setYtHardIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(seg.id)) next.delete(seg.id);
                                    else next.add(seg.id);
                                    return next;
                                  });
                                }}
                                title="Đánh dấu câu khó"
                              >
                                <Star size={16} fill={isHard ? 'currentColor' : 'none'} />
                              </button>
                            </div>

                            <div className="font-jp fw-bold text-dark">{seg.textJa}</div>
                            {ytShowHiragana && seg.reading && (
                              <div className="font-jp small text-primary mt-1">{seg.reading}</div>
                            )}
                            {ytShowTranslation && (
                              <div className="small mt-1 pt-1 border-top">
                                {seg.vietnameseTranslation || seg.textVi ? (
                                  <span className="text-success fw-medium">
                                    Nghĩa: {seg.vietnameseTranslation || seg.textVi}
                                  </span>
                                ) : (
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-muted fst-italic">Chưa dịch</span>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 text-decoration-none"
                                      disabled={ytRetranslatingId === seg.id}
                                      onClick={(e) => handleRetranslateSentence(e, seg.id)}
                                    >
                                      {ytRetranslatingId === seg.id ? 'Đang dịch...' : 'Dịch lại'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TỰ NHẬP CÂU SHADOWING (ĐÃ SỬA DỊCH NHIỀU CÂU, BỎ Ô NGHĨA THỦ CÔNG & BỎ PITCH) */}
      {activeTab === 'custom' && (
        <div className="card pq-card p-4 p-md-5 shadow-sm border-0 rounded-4" style={{ maxWidth: '880px', margin: '0 auto', width: '100%' }}>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
            <div>
              <h4 className="fw-bold text-dark mb-1">Luyện Shadowing tự nhập (Hỗ trợ nhiều câu)</h4>
              <p className="text-muted small mb-0">
                Nhập 1 hoặc nhiều câu tiếng Nhật — hệ thống sẽ tự động tách từng câu, sinh Hiragana, dịch đầy đủ sang tiếng Việt và đọc tuần tự toàn bộ câu tiếng Nhật.
              </p>
            </div>

            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 ${
                showCustomComparison ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setShowCustomComparison(!showCustomComparison)}
            >
              {showCustomComparison ? <EyeOff size={15} /> : <Eye size={15} />}
              <span>{showCustomComparison ? 'Ẩn văn bản đối chiếu' : 'Hiện văn bản đối chiếu'}</span>
            </button>
          </div>

          {customError && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-4">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div>{customError}</div>
            </div>
          )}

          {/* Ô nhập nhiều câu tiếng Nhật (KHÔNG còn ô Nghĩa tiếng Việt tùy chọn) */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-secondary">
              Đoạn hoặc nhiều câu tiếng Nhật (Kanji/Kana) *
            </label>
            <textarea
              className="form-control font-jp fs-5 p-3 rounded-3"
              rows={4}
              value={customJa}
              onChange={(e) => {
                setCustomJa(e.target.value);
                setTranslatedSentences([]);
                setActiveCustomTargetIdx(-1);
              }}
              placeholder={"VD:\n今日は学校へ行きました。\n友達と日本語を勉強しました。\nとても楽しかったです。"}
            />
          </div>

          {/* Tốc độ đọc (CHỈ giữ tốc độ đọc, đã bỏ Cao độ / Pitch) */}
          <div className="p-3 bg-light rounded-3 border mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="small fw-semibold text-secondary">Tốc độ đọc tiếng Nhật:</span>
                <div className="btn-group btn-group-sm">
                  {TTS_SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`btn ${ttsSpeed === opt.value ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                      onClick={() => updateTtsSpeed(opt.value)}
                    >
                      {opt.value}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-3 py-2 fw-semibold d-inline-flex align-items-center gap-1.5"
                  onClick={handleTranslateCustom}
                  disabled={translatingCustom || !customJa.trim()}
                >
                  {translatingCustom ? (
                    <>
                      <Loader2 size={15} className="spinner-border spinner-border-sm" />
                      <span>Đang dịch toàn bộ câu...</span>
                    </>
                  ) : (
                    <>
                      <Languages size={15} />
                      <span>Dịch</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className={`btn btn-sm px-3 py-2 fw-semibold d-inline-flex align-items-center gap-1.5 ${
                    isPlayingCustomSeq ? 'btn-danger' : 'btn-outline-primary bg-white'
                  }`}
                  onClick={handleSpeakAllCustomJapanese}
                  disabled={!customJa.trim()}
                >
                  <Volume2 size={15} />
                  <span>{isPlayingCustomSeq ? 'Dừng đọc' : `Đọc tiếng Nhật (${ttsSpeed}x)`}</span>
                </button>

                <button
                  type="button"
                  className={`btn btn-sm px-3 py-2 fw-semibold d-inline-flex align-items-center gap-1.5 ${
                    isRecording ? 'btn-danger' : 'btn-success text-white'
                  }`}
                  onClick={toggleRecordingCustom}
                  disabled={!customJa.trim()}
                >
                  {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
                  <span>{isRecording ? 'Dừng & Chấm điểm' : 'Bắt đầu Shadowing'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Kết quả tách & dịch ĐẦY ĐỦ tất cả các câu */}
          {translatedSentences.length > 0 && (
            <div className="card border rounded-4 overflow-hidden mb-4">
              <div className="px-3.5 py-2.5 bg-primary bg-opacity-10 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span className="small fw-bold text-primary">
                  ✓ Đã tách & dịch đầy đủ {translatedSentences.length} câu tiếng Nhật
                </span>
                {activeCustomTargetIdx >= 0 && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm py-0.5 px-2"
                    onClick={() => setActiveCustomTargetIdx(-1)}
                  >
                    Đang luyện Câu {activeCustomTargetIdx + 1} · Quay lại luyện cả đoạn
                  </button>
                )}
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '48px' }}>#</th>
                      <th>Câu tiếng Nhật & Hiragana</th>
                      <th>Nghĩa tiếng Việt</th>
                      <th className="text-end" style={{ width: '130px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {translatedSentences.map((s, idx) => {
                      const isPlayingThis = playingCustomIdx === idx;
                      const isTargetThis = activeCustomTargetIdx === idx;
                      return (
                        <tr
                          key={s.order || idx}
                          className={
                            isPlayingThis
                              ? 'table-warning'
                              : isTargetThis
                              ? 'table-primary bg-opacity-10'
                              : ''
                          }
                        >
                          <td className="fw-bold text-muted">{s.order || idx + 1}</td>
                          <td>
                            <div className="font-jp fw-bold text-dark fs-6">{s.japanese}</div>
                            {s.hiragana && (
                              <div className="font-jp text-primary" style={{ fontSize: '0.82rem' }}>
                                {s.hiragana}
                              </div>
                            )}
                          </td>
                          <td className="text-dark fw-medium">{s.vietnamese || '-'}</td>
                          <td className="text-end">
                            <div className="d-inline-flex align-items-center gap-1">
                              <AudioButton text={s.japanese} rate={ttsSpeed} size="sm" />
                              <button
                                type="button"
                                className={`btn btn-sm py-0.5 px-2 ${
                                  isTargetThis ? 'btn-primary' : 'btn-outline-secondary'
                                }`}
                                onClick={() => setActiveCustomTargetIdx(isTargetThis ? -1 : idx)}
                                title="Chọn câu này để luyện ghi âm Shadowing"
                              >
                                {isTargetThis ? 'Đang chọn' : 'Luyện câu'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ghi âm giọng người dùng */}
          <div className="text-center border-top pt-4 mb-4">
            {activeCustomTargetIdx >= 0 && translatedSentences[activeCustomTargetIdx] && (
              <div className="p-2.5 mb-3 rounded-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 text-start">
                <div className="small fw-bold text-primary">Đang luyện câu {activeCustomTargetIdx + 1}:</div>
                <div className="font-jp fw-bold text-dark fs-5">
                  {translatedSentences[activeCustomTargetIdx].japanese}
                </div>
              </div>
            )}

            <div className="d-flex justify-content-center mb-3">
              <button
                className={`btn rounded-circle p-4 shadow-lg ${
                  isRecording ? 'btn-danger' : 'btn-primary'
                }`}
                style={{ width: '84px', height: '84px' }}
                onClick={toggleRecordingCustom}
              >
                {isRecording ? <MicOff size={34} /> : <Mic size={34} />}
              </button>
            </div>

            <div className="small fw-semibold text-muted mb-3">
              {isRecording ? (
                <span className="text-danger fw-bold">
                  Đang ghi âm ({formatDuration(customRecordingSec)})... Hãy đọc to câu tiếng Nhật phía trên, sau đó bấm Dừng để Local AI chấm điểm!
                </span>
              ) : submittingCustom ? (
                <span className="text-primary fw-bold">
                  <Loader2 size={16} className="spinner-border spinner-border-sm me-1" />
                  Local AI đang phân tích phát âm, mora, trọng âm & ngữ điệu F0...
                </span>
              ) : transcript ? (
                <span className="text-success fw-bold">✓ Đã phân tích phát âm xong!</span>
              ) : (
                'Bấm biểu tượng Micro để ghi âm — Khi bấm Dừng, hệ thống tự động chấm phát âm chi tiết bằng Local AI'
              )}
            </div>

            {(showCustomComparison || transcript || isRecording) && (
              <div className="p-3 bg-light rounded-3 text-start border mb-4">
                <div className="small fw-bold text-secondary mb-1">
                  Bạn đã nói (Văn bản nhận diện được từ giọng nói của bạn):
                </div>
                <input
                  type="text"
                  className="form-control font-jp fs-5"
                  placeholder="Bấm micro để nói hoặc nhập câu tiếng Nhật..."
                  value={transcript}
                  onChange={(e) => {
                    latestCustomTranscriptRef.current = e.target.value;
                    setTranscript(e.target.value);
                  }}
                />
              </div>
            )}

            <button
              className="btn btn-outline-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 rounded-3 shadow-xs fw-semibold"
              onClick={() => handleScoreCustom()}
              disabled={submittingCustom || isRecording || !transcript.trim()}
            >
              {submittingCustom ? (
                <>
                  <Loader2 size={18} className="spinner-border spinner-border-sm" />
                  <span>Đang chấm điểm...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Chấm điểm lại theo văn bản trên</span>
                </>
              )}
            </button>
          </div>

          {customResult && (
            <div className="mt-3">
              <ShadowingEvaluationPanel
                attemptResult={customResult}
                expectedTextJa={customResult.expectedJa || customJa}
                recordedAudioUrl={customAudioUrl}
                title="Kết quả đánh giá phát âm"
                showComparisonText={showCustomComparison}
                onToggleComparisonText={() => setShowCustomComparison(!showCustomComparison)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShadowingList;
