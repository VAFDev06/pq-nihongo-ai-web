import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
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
  ArrowLeft,
  Mic,
  MicOff,
  AlertCircle,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Volume2,
  RotateCcw,
  Square,
  Play,
  SkipForward,
  CheckCircle2,
  MessagesSquare,
  Cpu,
} from 'lucide-react';

export const ShadowingPractice = () => {
  const { id } = useParams();
  const { ttsSpeed, updateTtsSpeed } = useAuth();

  const [lesson, setLesson] = useState(null);
  const [lines, setLines] = useState([]);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [isPlayingFullDialogue, setIsPlayingFullDialogue] = useState(false);
  const [playingDialogueIdx, setPlayingDialogueIdx] = useState(-1);
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultsByLineIdx, setResultsByLineIdx] = useState({});
  const [audioUrlsByLineIdx, setAudioUrlsByLineIdx] = useState({});
  const [aiStatus, setAiStatus] = useState(null);
  const [error, setError] = useState('');

  const [showTranslation, setShowTranslation] = useState(false); // Mặc định ẩn bản dịch để tập trung luyện nghe
  const [showComparisonText, setShowComparisonText] = useState(true);

  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const latestTranscriptRef = useRef('');
  const recordStartAtRef = useRef(0);
  const autoScoreOnEndRef = useRef(false);
  const isScoringRef = useRef(false);
  const activeLineRef = useRef(null);
  const activeLineIdxRef = useRef(0);
  const audioUrlsRef = useRef({});

  useEffect(() => {
    const fetchLesson = async () => {
      setLoading(true);
      try {
        const res = await axiosClient.get(`/shadowing/lessons/${id}`);
        if (res.success && res.data) {
          const data = res.data;
          setLesson(data);
          const loadedLines =
            Array.isArray(data.lines) && data.lines.length > 0
              ? data.lines
              : [
                  {
                    id: null,
                    lineOrder: 1,
                    speaker: 'A',
                    japaneseText: data.textJa || data.japaneseText || '',
                    hiraganaText: data.reading || '',
                    vietnameseTranslation: data.textVi || data.vietnameseMeaning || '',
                    audioUrl: data.audioUrl || null,
                  },
                ];
          setLines(loadedLines);
          setActiveLineIndex(0);
        }
      } catch (err) {
        setError('Không thể tải thông tin bài luyện tập.');
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();

    axiosClient
      .get('/shadowing/ai-status')
      .then((res) => {
        if (res?.success && res.data) setAiStatus(res.data);
      })
      .catch(() => {});

    return () => {
      stopJapaneseAudio();
      recorderRef.current?.cancel();
      Object.values(audioUrlsRef.current).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
  }, [id]);

  const currentLine = lines[activeLineIndex] || null;
  const attemptResult = resultsByLineIdx[activeLineIndex] || null;
  const recordedAudioUrl = audioUrlsByLineIdx[activeLineIndex] || null;

  useEffect(() => {
    activeLineRef.current = currentLine;
    activeLineIdxRef.current = activeLineIndex;
  }, [currentLine, activeLineIndex]);

  const scoreAudioWithLocalAi = async (recording, fallbackText = '') => {
    const line = activeLineRef.current;
    const idxToSave = activeLineIdxRef.current;
    if (!recording?.blob || recording.blob.size === 0 || !line) {
      setError('Không thu được dữ liệu âm thanh từ micro. Vui lòng thử ghi âm lại.');
      return;
    }
    if (recording.durationSec < 0.35) {
      setError('Thời gian ghi âm quá ngắn. Vui lòng bấm Micro và đọc trọn câu tiếng Nhật.');
      return;
    }
    if (isScoringRef.current) return;

    isScoringRef.current = true;
    setSubmitting(true);
    setError('');

    if (recording.objectUrl) {
      setAudioUrlsByLineIdx((prev) => {
        if (prev[idxToSave]) {
          try {
            URL.revokeObjectURL(prev[idxToSave]);
          } catch {}
        }
        const next = { ...prev, [idxToSave]: recording.objectUrl };
        audioUrlsRef.current = next;
        return next;
      });
    }

    try {
      const formData = new FormData();
      formData.append('audio', recording.blob, recording.filename || 'shadowing.webm');
      if (line.id) formData.append('lineId', String(line.id));
      formData.append('expectedTextJa', line.japaneseText || '');
      formData.append('playbackSpeed', String(ttsSpeed || 1.0));
      if (fallbackText && fallbackText.trim()) {
        formData.append('fallbackTranscript', fallbackText.trim());
      }

      const res = await axiosClient.post(`/shadowing/lessons/${id}/evaluate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 130000,
      });

      if (res.success && res.data) {
        const recognized = res.data.recognizedText || fallbackText || '';
        latestTranscriptRef.current = recognized;
        setTranscript(recognized);
        setResultsByLineIdx((prev) => ({ ...prev, [idxToSave]: res.data }));
        setShowComparisonText(true);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Chấm điểm phát âm bằng Local AI thất bại. Vui lòng kiểm tra Local Shadowing AI server hoặc bấm "Chấm điểm lại theo văn bản trên".'
      );
    } finally {
      setSubmitting(false);
      isScoringRef.current = false;
    }
  };

  const scoreRecognizedText = async (textToScore) => {
    const line = activeLineRef.current;
    const idxToSave = activeLineIdxRef.current;
    const cleanText = (textToScore !== undefined ? textToScore : transcript).trim();
    if (!cleanText || !line) {
      setError('Chưa nhận diện được giọng nói. Vui lòng bấm micro và đọc to câu tiếng Nhật.');
      return;
    }
    if (isScoringRef.current) return;

    isScoringRef.current = true;
    setSubmitting(true);
    setError('');

    try {
      const res = await axiosClient.post(`/shadowing/lessons/${id}/attempt`, {
        lineId: line.id || null,
        expectedTextJa: line.japaneseText,
        recognizedText: cleanText,
        playbackSpeed: ttsSpeed,
      });

      if (res.success && res.data) {
        setResultsByLineIdx((prev) => ({ ...prev, [idxToSave]: res.data }));
        setShowComparisonText(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Chấm điểm thất bại.');
    } finally {
      setSubmitting(false);
      isScoringRef.current = false;
    }
  };

  const scoreFnRef = useRef(scoreRecognizedText);
  scoreFnRef.current = scoreRecognizedText;

  // Web Speech API (live transcript preview & fallback if MediaRecorder unavailable)
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
        latestTranscriptRef.current = currentTranscript;
        setTranscript(currentTranscript);
      };

      recognition.onerror = () => {
        if (!recorderRef.current?.isRecording) {
          setIsRecording(false);
          autoScoreOnEndRef.current = false;
        }
      };

      recognition.onend = () => {
        // Only trigger text-only auto-score when MediaRecorder is NOT active
        if (!recorderRef.current?.isRecording && autoScoreOnEndRef.current) {
          setIsRecording(false);
          autoScoreOnEndRef.current = false;
          const finalRecognized = (latestTranscriptRef.current || '').trim();
          const durationMs = Date.now() - recordStartAtRef.current;
          if (!finalRecognized) {
            setError(
              durationMs < 700
                ? 'Thời gian ghi âm quá ngắn. Vui lòng bấm Micro và đọc to câu tiếng Nhật.'
                : 'Chưa nhận diện được giọng nói từ micro. Vui lòng đọc to và rõ hơn.'
            );
          } else {
            scoreFnRef.current(finalRecognized);
          }
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const handlePlayFullDialogue = () => {
    if (isPlayingFullDialogue) {
      stopJapaneseAudio();
      setIsPlayingFullDialogue(false);
      setPlayingDialogueIdx(-1);
      return;
    }
    if (lines.length === 0) return;

    setIsPlayingSample(false);
    setIsPlayingFullDialogue(true);
    speakJapaneseSequence(
      lines.map((l) => ({
        text: l.japaneseText,
        audioUrl: l.audioUrl,
        speaker: l.speaker,
      })),
      {
        rate: ttsSpeed,
        pauseMs: 350,
        onItemStart: (idx) => {
          setPlayingDialogueIdx(idx);
          setActiveLineIndex(idx);
        },
        onEnd: () => {
          setIsPlayingFullDialogue(false);
          setPlayingDialogueIdx(-1);
        },
        onError: () => {
          setIsPlayingFullDialogue(false);
          setPlayingDialogueIdx(-1);
        },
      }
    );
  };

  const handlePlayLine = (line, idx = activeLineIndex) => {
    if (!line) return;
    setActiveLineIndex(idx);
    setIsPlayingFullDialogue(false);
    setPlayingDialogueIdx(-1);

    if (isPlayingSample && idx === activeLineIndex) {
      stopJapaneseAudio();
      setIsPlayingSample(false);
      return;
    }
    speakJapanese(line.japaneseText, {
      audioUrl: line.audioUrl,
      rate: ttsSpeed,
      speaker: line.speaker,
      onStart: () => setIsPlayingSample(true),
      onEnd: () => setIsPlayingSample(false),
      onError: () => setIsPlayingSample(false),
    });
  };

  const handleSelectLine = (idx) => {
    stopJapaneseAudio();
    setIsPlayingSample(false);
    setIsPlayingFullDialogue(false);
    setPlayingDialogueIdx(-1);
    setActiveLineIndex(idx);
    setTranscript(resultsByLineIdx[idx]?.recognizedText || '');
    latestTranscriptRef.current = resultsByLineIdx[idx]?.recognizedText || '';
    setError('');
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      if (recorderRef.current?.isRecording) {
        autoScoreOnEndRef.current = false;
        try {
          recognitionRef.current?.stop();
        } catch {}
        const recording = await recorderRef.current.stop();
        const fallbackText = (latestTranscriptRef.current || '').trim();
        await scoreAudioWithLocalAi(recording, fallbackText);
        return;
      }
      autoScoreOnEndRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        setIsRecording(false);
      }
      return;
    }

    stopJapaneseAudio();
    setIsPlayingSample(false);
    setIsPlayingFullDialogue(false);
    setPlayingDialogueIdx(-1);
    latestTranscriptRef.current = '';
    recordStartAtRef.current = Date.now();
    autoScoreOnEndRef.current = false;
    setRecordingSec(0);
    setTranscript('');
    setError('');

    if (isMediaRecorderSupported()) {
      try {
        const recorder = new ShadowingAudioRecorder({
          onDurationChange: (sec) => setRecordingSec(sec),
          maxSeconds: 35,
        });
        recorderRef.current = recorder;
        await recorder.start();
        setIsRecording(true);
        // Optional parallel Web Speech live preview (best effort, never blocks recording)
        try {
          recognitionRef.current?.start();
        } catch {}
      } catch (err) {
        setError(
          err?.name === 'NotAllowedError'
            ? 'Trình duyệt chưa được cấp quyền sử dụng Micro. Vui lòng cho phép quyền Micro và thử lại.'
            : err?.message || 'Không thể bắt đầu ghi âm từ micro.'
        );
      }
      return;
    }

    if (!recognitionRef.current) {
      setShowComparisonText(true);
      setError('Trình duyệt không hỗ trợ ghi âm micro hoặc Web Speech API. Bạn có thể gõ câu đọc vào ô đối chiếu.');
      return;
    }

    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Start recording failed:', err);
    }
  };

  const handleResetLine = () => {
    stopJapaneseAudio();
    autoScoreOnEndRef.current = false;
    recorderRef.current?.cancel();
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    setRecordingSec(0);
    setIsPlayingSample(false);
    setIsPlayingFullDialogue(false);
    setPlayingDialogueIdx(-1);
    latestTranscriptRef.current = '';
    setTranscript('');
    setResultsByLineIdx((prev) => {
      const next = { ...prev };
      delete next[activeLineIndex];
      return next;
    });
    setAudioUrlsByLineIdx((prev) => {
      if (prev[activeLineIndex]) {
        try {
          URL.revokeObjectURL(prev[activeLineIndex]);
        } catch {}
      }
      const next = { ...prev };
      delete next[activeLineIndex];
      audioUrlsRef.current = next;
      return next;
    });
    setError('');
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Đang tải bài học Shadowing...</p>
      </div>
    );
  }

  if (!lesson || !currentLine) {
    return (
      <div className="card pq-card p-5 text-center">
        <h5>Không tìm thấy bài học</h5>
        <Link to="/app/shadowing" className="btn btn-sky mt-2">Quay lại danh sách</Link>
      </div>
    );
  }

  const isDialogue = lines.length > 1 || lesson.isDialogue;
  const completedCount = Object.keys(resultsByLineIdx).length;

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: '1040px', margin: '0 auto' }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex align-items-center gap-2">
          <Link to="/app/shadowing" className="btn btn-light btn-sm p-2 text-muted border">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h4 className="fw-bold mb-0 text-dark">{lesson.title}</h4>
              <span className={`badge badge-jlpt-${(lesson.jlptLevel || 'n5').toLowerCase()} px-2 py-1`}>
                {lesson.jlptLevel || 'N5'}
              </span>
              {isDialogue && (
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1">
                  Hội thoại A/B · {lines.length} câu
                </span>
              )}
            </div>
            <p className="text-muted small mb-0">
              {lesson.topicNameVi || lesson.topic || 'Giao tiếp hàng ngày'}
              {lesson.description ? ` — ${lesson.description}` : ''}
            </p>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {aiStatus && (
            <span
              className={`badge rounded-pill px-2.5 py-1.5 border d-inline-flex align-items-center gap-1 ${
                aiStatus.available
                  ? 'bg-primary bg-opacity-10 text-primary border-primary border-opacity-25'
                  : 'bg-light text-secondary'
              }`}
              title={aiStatus.message || ''}
            >
              <Cpu size={13} />
              <span>{aiStatus.available ? 'Local AI sẵn sàng' : 'Local AI offline'}</span>
            </span>
          )}
          <button
            type="button"
            className={`btn btn-sm d-flex align-items-center gap-1.5 rounded-pill px-3 py-1.5 fw-semibold ${
              showTranslation ? 'btn-success text-white' : 'btn-outline-secondary'
            }`}
            onClick={() => setShowTranslation((prev) => !prev)}
          >
            {showTranslation ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{showTranslation ? 'Ẩn bản dịch' : 'Hiện bản dịch'}</span>
          </button>
        </div>
      </div>

      {/* Top Dialogue Control Bar (Speed + Nghe toàn bộ hội thoại) */}
      <div className="card pq-card p-3.5">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className={`btn ${isPlayingFullDialogue ? 'btn-danger' : 'btn-primary'} rounded-pill px-4 py-2 d-inline-flex align-items-center gap-2 fw-semibold shadow-xs`}
              onClick={handlePlayFullDialogue}
            >
              {isPlayingFullDialogue ? <Square size={16} /> : <Play size={16} />}
              <span>
                {isPlayingFullDialogue
                  ? `Dừng phát hội thoại (Câu ${playingDialogueIdx + 1}/${lines.length})`
                  : isDialogue
                  ? `Nghe toàn bộ hội thoại (${lines.length} câu · ${ttsSpeed}x)`
                  : `Nghe câu mẫu (${ttsSpeed}x)`}
              </span>
            </button>

            <span className="badge bg-light text-dark border px-3 py-2">
              Đã luyện: <strong>{completedCount} / {lines.length}</strong> câu
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="small text-secondary fw-semibold">Tốc độ đọc:</span>
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
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-0">
          <AlertCircle size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <div className="row g-4">
        {/* LEFT COLUMN (if dialogue): FULL A/B DIALOGUE SCRIPT */}
        {isDialogue && (
          <div className="col-12 col-lg-5">
            <div className="card pq-card p-3.5 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <MessagesSquare size={18} className="text-primary" />
                  <span>Nội dung hội thoại A / B</span>
                </h6>
                <span className="small text-muted">Bấm từng câu để luyện</span>
              </div>

              <div className="d-flex flex-column gap-2 overflow-auto" style={{ maxHeight: '560px' }}>
                {lines.map((line, idx) => {
                  const isActive = idx === activeLineIndex;
                  const isSpeakerA = String(line.speaker || 'A').trim().toUpperCase().startsWith('A');
                  const lineRes = resultsByLineIdx[idx];
                  return (
                    <div
                      key={line.id || idx}
                      className={`p-3 rounded-3 border ${
                        isActive
                          ? 'border-primary bg-primary bg-opacity-10 shadow-xs'
                          : 'bg-light bg-opacity-50'
                      }`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelectLine(idx)}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-1.5">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className={`badge rounded-pill px-2.5 py-1 fw-bold ${
                              isSpeakerA ? 'bg-primary text-white' : 'bg-success text-white'
                            }`}
                          >
                            Người {line.speaker || 'A'}
                          </span>
                          <span className="small text-muted fw-semibold">Câu {idx + 1}</span>
                          {playingDialogueIdx === idx && (
                            <span className="badge bg-danger">🔊 Đang đọc</span>
                          )}
                        </div>
                        <div className="d-flex align-items-center gap-1.5">
                          {lineRes && (
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                              <CheckCircle2 size={11} className="me-1" />
                              {Math.round(lineRes.accuracy || 0)}%
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn btn-light btn-sm border rounded-circle p-1 text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayLine(line, idx);
                            }}
                            title="Nghe câu này"
                          >
                            <Volume2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="font-jp fw-bold text-dark">{line.japaneseText}</div>
                      {line.hiraganaText && (
                        <div className="font-jp small text-primary mt-0.5">{line.hiraganaText}</div>
                      )}
                      {showTranslation && line.vietnameseTranslation && (
                        <div className="small text-success mt-1 pt-1 border-top">
                          Nghĩa: {line.vietnameseTranslation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: ACTIVE LINE SHADOWING PRACTICE */}
        <div className={isDialogue ? 'col-12 col-lg-7' : 'col-12'}>
          <div className="d-flex flex-column gap-3">
            <div className="card pq-card p-4 text-center">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="badge bg-light text-secondary border px-3 py-1.5">
                  Câu {activeLineIndex + 1} / {lines.length} · Người {currentLine.speaker || 'A'}
                </span>

                <div className="d-flex gap-1.5">
                  <button
                    type="button"
                    className="btn btn-light btn-sm border d-inline-flex align-items-center gap-1 text-secondary"
                    onClick={handleResetLine}
                  >
                    <RotateCcw size={14} />
                    <span>Luyện lại</span>
                  </button>
                  {activeLineIndex + 1 < lines.length && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 fw-semibold"
                      onClick={() => handleSelectLine(activeLineIndex + 1)}
                    >
                      <span>Câu tiếp</span>
                      <SkipForward size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Japanese + Hiragana + Optional Vietnamese */}
              <div className="fs-3 fw-bold font-jp text-dark mb-1">
                <FuriganaText text={currentLine.japaneseText} />
              </div>
              {currentLine.hiraganaText && (
                <div className="font-jp text-primary fw-semibold mb-2">{currentLine.hiraganaText}</div>
              )}
              {showTranslation && currentLine.vietnameseTranslation && (
                <div className="text-success fw-semibold small mb-3">
                  Nghĩa: {currentLine.vietnameseTranslation}
                </div>
              )}

              {/* Play current line */}
              <div className="d-flex justify-content-center gap-2 my-3">
                <button
                  type="button"
                  className={`btn ${isPlayingSample ? 'btn-danger' : 'btn-outline-primary'} rounded-pill px-4 py-2 d-inline-flex align-items-center gap-2 fw-semibold`}
                  onClick={() => handlePlayLine(currentLine, activeLineIndex)}
                >
                  {isPlayingSample ? <Square size={16} /> : <Volume2 size={16} />}
                  <span>{isPlayingSample ? 'Dừng phát' : `Nghe câu này (${ttsSpeed}x)`}</span>
                </button>
              </div>

              {/* Record Voice */}
              <div className="border-top pt-4">
                <div className="d-flex justify-content-center mb-3">
                  <button
                    className={`btn rounded-circle p-4 shadow ${isRecording ? 'btn-danger' : 'btn-primary'}`}
                    style={{ width: '80px', height: '80px' }}
                    onClick={toggleRecording}
                    title={isRecording ? 'Dừng ghi âm & tự động chấm điểm' : 'Bắt đầu đọc câu này'}
                  >
                    {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
                  </button>
                </div>

                <div className="small fw-semibold text-muted mb-3">
                  {isRecording ? (
                    <span className="text-danger fw-bold">
                      Đang ghi âm ({formatDuration(recordingSec)})... Hãy đọc to câu tiếng Nhật phía trên, sau đó bấm Dừng để Local AI chấm điểm!
                    </span>
                  ) : submitting ? (
                    <span className="text-primary fw-bold">
                      <Loader2 size={15} className="spinner-border spinner-border-sm me-1" />
                      Local AI đang phân tích phát âm, mora, trọng âm & ngữ điệu F0...
                    </span>
                  ) : (
                    'Bấm Micro để ghi âm — Khi bấm Dừng, hệ thống tự động chấm phát âm chi tiết bằng Local AI'
                  )}
                </div>

                <div className="p-3 bg-light rounded-3 text-start mb-3 border">
                  <div className="small fw-bold text-secondary mb-1">
                    Bạn đã nói (nhận diện giọng nói):
                  </div>
                  <input
                    type="text"
                    className="form-control font-jp fs-5"
                    placeholder="Bấm Micro để đọc hoặc gõ câu để kiểm tra..."
                    value={transcript}
                    onChange={(e) => {
                      latestTranscriptRef.current = e.target.value;
                      setTranscript(e.target.value);
                    }}
                  />
                </div>

                <button
                  className="btn btn-outline-primary btn-sm px-3 py-1.5 d-inline-flex align-items-center gap-1.5 fw-semibold"
                  onClick={() => scoreRecognizedText(transcript)}
                  disabled={submitting || isRecording || !transcript.trim()}
                >
                  <Sparkles size={15} />
                  <span>Chấm điểm lại theo văn bản trên</span>
                </button>
              </div>
            </div>

            {/* Attempt Result Card (Local AI Structured Evaluation + Kuromoji Word Diff) */}
            {attemptResult && (
              <ShadowingEvaluationPanel
                attemptResult={attemptResult}
                expectedTextJa={currentLine.japaneseText}
                recordedAudioUrl={recordedAudioUrl}
                title={`Kết quả chấm điểm câu ${activeLineIndex + 1}`}
                showComparisonText={showComparisonText}
                onToggleComparisonText={() => setShowComparisonText((p) => !p)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShadowingPractice;
