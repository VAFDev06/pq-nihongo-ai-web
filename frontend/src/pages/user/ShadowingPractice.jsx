import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import FuriganaText from '../../components/common/FuriganaText';
import { useAuth } from '../../auth/AuthContext';
import { TTS_SPEED_OPTIONS, speakJapanese, speakJapaneseSequence, stopJapaneseAudio } from '../../utils/tts';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Award,
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
} from 'lucide-react';

export const ShadowingPractice = () => {
  const { id } = useParams();
  const { ttsSpeed, updateTtsSpeed } = useAuth();

  const [lesson, setLesson] = useState(null);
  const [lines, setLines] = useState([]);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [isPlayingFullDialogue, setIsPlayingFullDialogue] = useState(false);
  const [playingDialogueIdx, setPlayingDialogueIdx] = useState(-1);
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultsByLineIdx, setResultsByLineIdx] = useState({});
  const [error, setError] = useState('');

  const [showTranslation, setShowTranslation] = useState(false); // Mặc định ẩn bản dịch để tập trung luyện nghe
  const [showComparisonText, setShowComparisonText] = useState(true);

  const recognitionRef = useRef(null);
  const latestTranscriptRef = useRef('');
  const recordStartAtRef = useRef(0);
  const autoScoreOnEndRef = useRef(false);
  const isScoringRef = useRef(false);
  const activeLineRef = useRef(null);
  const activeLineIdxRef = useRef(0);

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
    return () => stopJapaneseAudio();
  }, [id]);

  const currentLine = lines[activeLineIndex] || null;
  const attemptResult = resultsByLineIdx[activeLineIndex] || null;

  useEffect(() => {
    activeLineRef.current = currentLine;
    activeLineIdxRef.current = activeLineIndex;
  }, [currentLine, activeLineIndex]);

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

  // Web Speech API
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

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        autoScoreOnEndRef.current = false;
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (autoScoreOnEndRef.current) {
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

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setShowComparisonText(true);
      alert('Trình duyệt không hỗ trợ Web Speech API tiếng Nhật. Bạn có thể nhập câu đọc vào ô đối chiếu.');
      return;
    }

    if (isRecording) {
      autoScoreOnEndRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        setIsRecording(false);
      }
    } else {
      stopJapaneseAudio();
      setIsPlayingSample(false);
      setIsPlayingFullDialogue(false);
      setPlayingDialogueIdx(-1);
      latestTranscriptRef.current = '';
      recordStartAtRef.current = Date.now();
      autoScoreOnEndRef.current = false;
      setTranscript('');
      setError('');
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Start recording failed:', err);
      }
    }
  };

  const handleResetLine = () => {
    stopJapaneseAudio();
    autoScoreOnEndRef.current = false;
    if (isRecording && recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
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
                      Đang ghi âm... Hãy đọc to câu tiếng Nhật phía trên, sau đó bấm Dừng để tự động chấm điểm!
                    </span>
                  ) : submitting ? (
                    <span className="text-primary fw-bold">
                      <Loader2 size={15} className="spinner-border spinner-border-sm me-1" />
                      Đang tự động chấm điểm phát âm...
                    </span>
                  ) : (
                    'Bấm Micro để đọc — Khi bấm Dừng ghi âm, hệ thống tự động chấm điểm ngay'
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

            {/* Attempt Result Card */}
            {attemptResult && (
              <div className="card pq-card p-4 rounded-4 shadow-sm border">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 border-bottom pb-3">
                  <div className="d-flex align-items-center gap-2">
                    <Award size={24} className="text-warning" />
                    <h6 className="fw-bold mb-0">Kết quả chấm điểm câu {activeLineIndex + 1}</h6>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="fs-3 fw-bold text-primary">
                      {Math.round(attemptResult.accuracy || attemptResult.accuracyScore || 0)}%
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowComparisonText((p) => !p)}
                    >
                      {showComparisonText ? 'Ẩn đối chiếu' : 'Hiện đối chiếu'}
                    </button>
                  </div>
                </div>

                <div className="row g-2 mb-3 text-start">
                  <div className="col-12 col-md-6">
                    <div className="p-2.5 bg-light rounded-3 border">
                      <div className="text-muted small fw-semibold mb-1">Câu gốc:</div>
                      <div className="font-jp fw-bold text-dark">{currentLine.japaneseText}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="p-2.5 bg-primary bg-opacity-10 rounded-3 border border-primary border-opacity-25">
                      <div className="text-primary small fw-semibold mb-1">Bạn đã nói:</div>
                      <div className="font-jp fw-bold text-dark">{attemptResult.recognizedText || transcript}</div>
                    </div>
                  </div>
                </div>

                {showComparisonText && (
                  <div className="p-3.5 rounded-4 border font-jp" style={{ background: '#1a1d24', color: '#ffffff' }}>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      {(attemptResult.wordDiff || attemptResult.tokenAlignments || []).map((tok, idx) => {
                        const text = tok.text || tok.expectedSurface || tok.heard || '';
                        const color =
                          tok.status === 'CORRECT'
                            ? { bg: 'rgba(16, 185, 129, 0.15)', bd: '#10b981', fg: '#34d399', icon: '✓' }
                            : tok.status === 'WRONG'
                            ? { bg: 'rgba(239, 68, 68, 0.15)', bd: '#ef4444', fg: '#f87171', icon: '✗' }
                            : tok.status === 'MISSING'
                            ? { bg: 'rgba(245, 158, 11, 0.15)', bd: '#f59e0b', fg: '#fbbf24', icon: '⚠' }
                            : { bg: 'rgba(56, 189, 248, 0.15)', bd: '#38bdf8', fg: '#7dd3fc', icon: '+' };
                        return (
                          <div
                            key={idx}
                            className="d-inline-flex align-items-center gap-1 px-2.5 py-1.5 rounded-3 fw-bold"
                            style={{
                              background: color.bg,
                              border: `1.5px solid ${color.bd}`,
                              color: color.fg,
                              fontSize: '1.05rem',
                            }}
                          >
                            <span>{text}</span>
                            <span style={{ fontSize: '0.8rem' }}>{color.icon}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShadowingPractice;
