import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import FuriganaText from '../../components/common/FuriganaText';
import { useAuth } from '../../auth/AuthContext';
import { speakJapanese, stopJapaneseAudio, TTS_SPEED_OPTIONS } from '../../utils/tts';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  Plus,
  History,
  Loader2,
  AlertCircle,
  Volume2,
  Trash2,
  RotateCcw,
} from 'lucide-react';

const JLPT_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'N5', label: 'N5' },
  { value: 'N4', label: 'N4' },
  { value: 'N3', label: 'N3' },
  { value: 'N2', label: 'N2' },
  { value: 'N1', label: 'N1' },
];

export const ConversationRoom = () => {
  const [searchParams] = useSearchParams();
  const existingConvId = searchParams.get('id');
  const { ttsSpeed, updateTtsSpeed } = useAuth();

  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [levelFilter, setLevelFilter] = useState('ALL'); // ALL | N5 | N4 | N3 | N2 | N1
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [activeLevel, setActiveLevel] = useState('N5');
  const [previewBeforeVoiceSend, setPreviewBeforeVoiceSend] = useState(false);

  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'ai_speaking'

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [autoSpeakAi, setAutoSpeakAi] = useState(true);

  // Tạo chủ đề hội thoại cá nhân
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false);
  const [newTopicForm, setNewTopicForm] = useState({
    nameVi: '',
    description: '',
    aiRole: 'Người bản xứ Nhật Bản',
    userRole: 'Người học tiếng Nhật',
    jlptLevel: 'N5',
  });
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Luyện đọc lại câu đã sửa khi nói sai
  const [practicingCorrectionText, setPracticingCorrectionText] = useState('');

  // Speech to text refs (VOICE-ONLY)
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const latestVoiceTextRef = useRef('');
  const autoSendVoiceOnEndRef = useRef(false);
  const sendVoiceFnRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Ending summary modal
  const [summary, setSummary] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Saved words track
  const [savedWords, setSavedWords] = useState(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Lọc chủ đề THẬT từ PostgreSQL theo cấp độ JLPT (ALL / N5 / N4 / N3 / N2 / N1)
  const fetchTopics = useCallback(async (lvl = levelFilter) => {
    setLoadingTopics(true);
    try {
      const params = lvl && lvl !== 'ALL' ? { level: lvl } : {};
      const res = await axiosClient.get('/conversations/topics', { params });
      if (res.success && Array.isArray(res.data)) {
        setTopics(res.data);
        if (res.data.length > 0) {
          setSelectedTopicId((prev) => {
            const exists = res.data.some((t) => t.id === prev);
            return exists ? prev : res.data[0].id;
          });
          setActiveLevel(lvl !== 'ALL' ? lvl : (res.data[0].jlptLevel || 'N5'));
        } else {
          setSelectedTopicId('');
        }
      }
    } catch (err) {
      console.error('Fetch conversation topics failed:', err);
    } finally {
      setLoadingTopics(false);
    }
  }, [levelFilter]);

  useEffect(() => {
    fetchTopics(levelFilter);
  }, [levelFilter, fetchTopics]);

  useEffect(() => {
    return () => stopJapaneseAudio();
  }, []);

  // Load existing conversation if ?id= is present
  useEffect(() => {
    if (existingConvId) {
      setLoading(true);
      axiosClient
        .get(`/conversations/${existingConvId}`)
        .then((res) => {
          if (res.success && res.data) {
            setActiveConversation(res.data);
            setMessages(res.data.messages || []);
            if (res.data.jlptLevel) setActiveLevel(res.data.jlptLevel);
          }
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Không thể tải cuộc hội thoại.');
        })
        .finally(() => setLoading(false));
    }
  }, [existingConvId]);

  // Web Speech API (Voice-Only Auto-Send on Mic Stop)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';

      recognition.onresult = (event) => {
        let current = '';
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        latestVoiceTextRef.current = current;
        setVoiceTranscript(current);
      };

      recognition.onerror = () => {
        setIsRecording(false);
        setVoiceStatus('idle');
        autoSendVoiceOnEndRef.current = false;
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (autoSendVoiceOnEndRef.current) {
          autoSendVoiceOnEndRef.current = false;
          const finalRecognized = (latestVoiceTextRef.current || '').trim();
          if (!finalRecognized) {
            setVoiceStatus('idle');
            setError('Chưa nhận diện được giọng nói tiếng Nhật từ Micro. Vui lòng bấm Micro và nói to rõ hơn.');
          } else if (previewBeforeVoiceSend) {
            setVoiceStatus('idle');
          } else if (sendVoiceFnRef.current) {
            setVoiceStatus('processing');
            sendVoiceFnRef.current(finalRecognized);
          }
        } else {
          setVoiceStatus('idle');
        }
      };

      recognitionRef.current = recognition;
    }
  }, [previewBeforeVoiceSend]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('Trình duyệt của bạn không hỗ trợ Web Speech API tiếng Nhật. Vui lòng dùng Chrome/Edge hoặc chọn 1 trong các câu gợi ý bên trên.');
      return;
    }

    if (isRecording) {
      autoSendVoiceOnEndRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        setIsRecording(false);
      }
    } else {
      stopJapaneseAudio();
      latestVoiceTextRef.current = '';
      autoSendVoiceOnEndRef.current = false;
      setVoiceTranscript('');
      setError('');
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setVoiceStatus('listening');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreatePersonalTopic = async (e) => {
    e.preventDefault();
    if (!newTopicForm.nameVi.trim()) return;
    setCreatingTopic(true);
    try {
      const res = await axiosClient.post('/conversations/topics/custom', newTopicForm);
      if (res.success && res.data) {
        setLevelFilter('ALL');
        await fetchTopics('ALL');
        setSelectedTopicId(res.data.id);
        setActiveLevel(res.data.jlptLevel || 'N5');
        setShowCreateTopicModal(false);
        setNewTopicForm({
          nameVi: '',
          description: '',
          aiRole: 'Người bản xứ Nhật Bản',
          userRole: 'Người học tiếng Nhật',
          jlptLevel: 'N5',
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tạo chủ đề cá nhân.');
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleDeletePersonalTopic = async (e, topicId) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa chủ đề hội thoại cá nhân này?')) return;
    try {
      const res = await axiosClient.delete(`/conversations/topics/custom/${topicId}`);
      if (res.success) {
        const remaining = topics.filter((t) => t.id !== topicId);
        setTopics(remaining);
        if (selectedTopicId === topicId) {
          setSelectedTopicId(remaining.length > 0 ? remaining[0].id : '');
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa chủ đề.');
    }
  };

  const handleStartConversation = async () => {
    if (!selectedTopicId) return;
    setLoading(true);
    setError('');

    const chosenTopic = topics.find((t) => t.id === selectedTopicId);
    const effectiveLevel = levelFilter !== 'ALL' ? levelFilter : (chosenTopic?.jlptLevel || 'N5');
    setActiveLevel(effectiveLevel);

    try {
      const res = await axiosClient.post('/conversations/start', {
        topicId: selectedTopicId,
        jlptLevel: effectiveLevel,
        levelMode: effectiveLevel,
        tutorMode: 'DAILY_JAPANESE',
        chatMode: 'VOICE',
      });

      if (res.success && res.data) {
        setActiveConversation(res.data);
        const initMsgs = res.data.messages || [];
        setMessages(initMsgs);
        if (autoSpeakAi && initMsgs.length > 0) {
          const firstAi = initMsgs[initMsgs.length - 1];
          const textJa = firstAi.contentJa || firstAi.content;
          if (textJa) {
            speakJapanese(textJa, {
              rate: ttsSpeed,
              onStart: () => setVoiceStatus('ai_speaking'),
              onEnd: () => setVoiceStatus('idle'),
              onError: () => setVoiceStatus('idle'),
            });
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể khởi tạo phiên hội thoại với AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeLiveLevel = async (newLevel) => {
    setActiveLevel(newLevel);
    if (!activeConversation) return;
    try {
      await axiosClient.patch(`/conversations/${activeConversation.id}/settings`, {
        jlptLevel: newLevel,
        chatMode: 'VOICE',
      });
    } catch (err) {
      // ignore
    }
  };

  const sendVoiceText = async (rawText) => {
    const userText = (rawText || '').trim();
    if (!userText || sending || !activeConversation) return;

    setVoiceTranscript('');
    setPracticingCorrectionText('');
    setSending(true);
    setError('');

    const tempId = Date.now();
    const tempUserMsg = {
      id: tempId,
      role: 'USER',
      messageType: 'CHAT',
      contentJa: userText,
      content: userText,
      corrections: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await axiosClient.post(`/conversations/${activeConversation.id}/messages`, {
        text: userText,
        content: userText,
        messageType: 'CHAT',
        levelMode: activeLevel,
        tutorMode: 'DAILY_JAPANESE',
      });

      if (res.success && res.data) {
        const aiData = res.data.aiMessage || res.data;
        const corrections = aiData.corrections || [];
        const newWords = aiData.newWords || aiData.newVocabularies || [];
        const suggestedReplies = aiData.suggestedReplies || [];
        const replyJa = aiData.contentJa || aiData.content || '';

        const aiReplyMsg = {
          id: aiData.id || Date.now() + 1,
          role: 'AI',
          messageType: 'CHAT',
          contentJa: replyJa,
          contentVi: aiData.contentVi || aiData.vietnameseTranslation || '',
          newWords,
          suggestedReplies,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) =>
          prev
            .map((m) => (m.id === tempId ? { ...m, corrections } : m))
            .concat(aiReplyMsg)
        );

        if (autoSpeakAi && replyJa) {
          speakJapanese(replyJa, {
            rate: ttsSpeed,
            onStart: () => setVoiceStatus('ai_speaking'),
            onEnd: () => setVoiceStatus('idle'),
            onError: () => setVoiceStatus('idle'),
          });
        } else {
          setVoiceStatus('idle');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gửi câu nói thất bại.');
      setVoiceStatus('idle');
    } finally {
      setSending(false);
    }
  };

  sendVoiceFnRef.current = sendVoiceText;

  const handlePracticeCorrection = (correctedSentence) => {
    const clean = (correctedSentence || '').trim();
    if (!clean) return;
    setPracticingCorrectionText(clean);
    speakJapanese(clean, { rate: ttsSpeed });
  };

  const handleSaveWord = async (word) => {
    const jp = word.word || word.japaneseText;
    const vi = word.meaningVi || word.vietnameseMeaning;
    try {
      const res = await axiosClient.post('/vocab/my', {
        word: jp,
        japaneseText: jp,
        reading: word.reading || null,
        meaningVi: vi,
        vietnameseMeaning: vi,
        source: 'CONVERSATION',
      });
      if (res.success) {
        setSavedWords((prev) => new Set(prev).add(jp));
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setSavedWords((prev) => new Set(prev).add(jp));
      } else {
        alert(err.response?.data?.message || 'Lưu từ vựng thất bại.');
      }
    }
  };

  const handleEndConversation = async () => {
    if (!activeConversation) return;
    if (!window.confirm('Bạn có chắc muốn kết thúc hội thoại và nhận nhận xét tổng quát từ Gia sư AI?')) return;

    try {
      const res = await axiosClient.post(`/conversations/${activeConversation.id}/end`);
      if (res.success && res.data) {
        setSummary(res.data);
        setActiveConversation(res.data);
        setShowSummaryModal(true);
      }
    } catch (err) {
      alert('Kết thúc hội thoại thất bại.');
    }
  };

  const latestAiChatMsg = [...messages].reverse().find((m) => m.role === 'AI');
  const activeSuggestions = latestAiChatMsg?.suggestedReplies || [];

  return (
    <div className="d-flex flex-column gap-3" style={{ minHeight: 'calc(100vh - 130px)' }}>
      {/* Top Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0">Hội thoại AI 1–1 (Voice Mode)</h3>
            <span className="badge bg-primary fw-bold">Luyện nói giọng nói</span>
          </div>
          <p className="text-muted small mb-0">
            Luyện nói tiếng Nhật trực tiếp qua micro với Gia sư Gemini AI — sửa lỗi tự nhiên, giải thích tiếng Việt và gợi ý câu trả lời tiếp theo.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="d-flex align-items-center gap-1 bg-light border rounded-pill px-2.5 py-1 small">
            <Volume2 size={14} className="text-primary" />
            <span className="text-secondary">Tốc độ đọc:</span>
            <select
              className="form-select form-select-sm border-0 bg-transparent py-0 ps-1 pe-4 fw-bold text-primary shadow-none"
              style={{ width: 'auto', fontSize: '0.8rem' }}
              value={ttsSpeed}
              onChange={(e) => updateTtsSpeed(parseFloat(e.target.value))}
            >
              {TTS_SPEED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value}x
                </option>
              ))}
            </select>
          </div>

          <Link to="/app/conversation/history" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
            <History size={16} />
            <span>Lịch sử hội thoại</span>
          </Link>

          {activeConversation && (
            <>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  stopJapaneseAudio();
                  setActiveConversation(null);
                  setMessages([]);
                  setError('');
                }}
              >
                Đổi chủ đề
              </button>
              {activeConversation.status !== 'ENDED' && (
                <button className="btn btn-outline-danger btn-sm" onClick={handleEndConversation}>
                  Kết thúc & Nhận xét
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-0">
          <AlertCircle size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Main Area */}
      {!activeConversation ? (
        /* Topic Selection Screen — Voice Mode Only + Working JLPT Level Filter */
        <div className="card pq-card p-4 p-md-5 my-auto" style={{ maxWidth: '880px', margin: '0 auto', width: '100%' }}>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
            <div>
              <h4 className="fw-bold text-dark mb-1">Chọn chủ đề luyện nói với AI</h4>
              <p className="text-muted small mb-0">
                Lọc chủ đề theo cấp độ JLPT (N5 – N1) hoặc tự tạo tình huống trò chuyện cá nhân của riêng bạn
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 rounded-pill px-3 py-2 fw-semibold shadow-xs"
              onClick={() => setShowCreateTopicModal(true)}
            >
              <Plus size={16} />
              <span>Tự tạo chủ đề cá nhân</span>
            </button>
          </div>

          {/* Working JLPT Filter Bar */}
          <div className="mb-4">
            <label className="form-label small fw-bold text-secondary">
              Lọc chủ đề theo trình độ JLPT:
            </label>
            <div className="d-flex flex-wrap gap-2">
              {JLPT_FILTER_OPTIONS.map((lvl) => (
                <button
                  key={lvl.value}
                  type="button"
                  className={`btn btn-sm px-3.5 py-1.5 fw-bold rounded-pill ${
                    levelFilter === lvl.value ? 'btn-primary shadow-xs' : 'btn-light border text-secondary'
                  }`}
                  onClick={() => setLevelFilter(lvl.value)}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtered Topics Grid */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label small fw-bold text-secondary mb-0">
                Danh sách chủ đề hội thoại ({topics.length} chủ đề):
              </label>
              {levelFilter !== 'ALL' && (
                <span className="small text-primary fw-semibold">Đang lọc: JLPT {levelFilter}</span>
              )}
            </div>

            {loadingTopics ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm text-primary me-2" />
                Đang lọc chủ đề...
              </div>
            ) : topics.length === 0 ? (
              <div className="p-4 text-center bg-light rounded-3 border text-muted">
                <div className="fw-semibold text-dark mb-1">
                  Chưa có chủ đề nào ở cấp độ {levelFilter}.
                </div>
                <p className="small mb-2">Bạn có thể chọn "Tất cả" hoặc tự tạo một chủ đề mới cho trình độ {levelFilter}.</p>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    setNewTopicForm((prev) => ({ ...prev, jlptLevel: levelFilter !== 'ALL' ? levelFilter : 'N5' }));
                    setShowCreateTopicModal(true);
                  }}
                >
                  + Tạo chủ đề {levelFilter} ngay
                </button>
              </div>
            ) : (
              <div className="row g-2.5">
                {topics.map((t) => {
                  const topicName = t.nameVi || t.title;
                  const isSelected = selectedTopicId === t.id;
                  const isPersonal = t.isPersonal || t.createdBy != null;
                  return (
                    <div key={t.id} className="col-12 col-md-6">
                      <div
                        className={`card p-3 border rounded-3 h-100 ${
                          isSelected ? 'border-primary bg-primary bg-opacity-10 shadow-xs' : 'bg-light'
                        }`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedTopicId(t.id);
                          setActiveLevel(t.jlptLevel || 'N5');
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <div className="d-flex align-items-center gap-1.5">
                              <span className="fw-bold text-dark">{topicName}</span>
                              {isPersonal && (
                                <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle small">
                                  Cá nhân
                                </span>
                              )}
                            </div>
                            {t.nameJa && <div className="small text-primary font-jp">{t.nameJa}</div>}
                          </div>
                          <div className="d-flex align-items-center gap-1">
                            <span className={`badge badge-jlpt-${(t.jlptLevel || 'n5').toLowerCase()}`}>
                              {t.jlptLevel || 'N5'}
                            </span>
                            {isPersonal && (
                              <button
                                type="button"
                                className="btn btn-sm p-1 text-danger border-0"
                                onClick={(e) => handleDeletePersonalTopic(e, t.id)}
                                title="Xóa chủ đề cá nhân"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="small text-muted mt-1.5">{t.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            className="btn btn-sky w-100 py-2.5 d-flex align-items-center justify-content-center gap-2 fw-semibold"
            onClick={handleStartConversation}
            disabled={loading || !selectedTopicId}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spinner-border spinner-border-sm" />
                <span>Gia sư Gemini AI đang mở phòng hội thoại giọng nói...</span>
              </>
            ) : (
              <>
                <Mic size={18} />
                <span>Bắt đầu hội thoại Voice Mode ({activeLevel})</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Active Voice-Only Conversation Room */
        <div className="card pq-card d-flex flex-column flex-grow-1 overflow-hidden" style={{ minHeight: '580px' }}>
          {/* Active Room Toolbar */}
          <div className="px-3.5 py-2.5 bg-light border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="badge bg-primary rounded-pill px-2.5 py-1">🎙️ Voice Mode</span>
              <span className="fw-bold text-dark small">
                {activeConversation.topicNameVi || activeConversation.title || 'Phòng luyện nói AI 1-1'}
              </span>

              <select
                className="form-select form-select-sm bg-white fw-semibold"
                style={{ width: 'auto' }}
                value={activeLevel}
                onChange={(e) => handleChangeLiveLevel(e.target.value)}
                title="Đổi trình độ tiếng Nhật của AI"
              >
                {['N5', 'N4', 'N3', 'N2', 'N1'].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Trình độ: JLPT {lvl}
                  </option>
                ))}
              </select>
            </div>

            <label className="form-check form-switch mb-0 small d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="form-check-input mt-0"
                checked={autoSpeakAi}
                onChange={(e) => setAutoSpeakAi(e.target.checked)}
              />
              <span className="text-secondary">Tự động đọc giọng AI</span>
            </label>
          </div>

          {/* Messages Body */}
          <div className="p-3 p-md-4 overflow-auto flex-grow-1 d-flex flex-column gap-3" style={{ maxHeight: '50vh' }}>
            {messages.map((msg, idx) => {
              const isAi = msg.role === 'AI' || msg.role === 'ASSISTANT' || msg.role === 'SYSTEM';
              const textJa = msg.contentJa || msg.content || '';
              const textVi = msg.contentVi || msg.vietnameseTranslation || '';
              const corrections = msg.corrections || [];
              const newWords = msg.newWords || msg.newVocabularies || [];

              return (
                <div
                  key={msg.id || idx}
                  className={`d-flex flex-column ${isAi ? 'align-items-start' : 'align-items-end'}`}
                >
                  <div
                    className={`p-3 rounded-4 shadow-xs ${
                      isAi ? 'bg-white text-dark border' : 'bg-primary text-white'
                    }`}
                    style={{ maxWidth: '85%' }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="small fw-bold opacity-75">
                        {isAi ? '🤖 Gia sư PQ Nihongo AI' : '🎙️ Bạn đã nói'}
                      </span>
                      {textJa && <AudioButton text={textJa} size="sm" />}
                    </div>

                    <div className="font-jp fs-5 mb-1" style={{ whiteSpace: 'pre-line' }}>
                      <FuriganaText text={textJa} />
                    </div>

                    {textVi && (
                      <div className={`small ${isAi ? 'text-muted' : 'text-white text-opacity-75'} fst-italic border-top pt-1 mt-1`}>
                        {textVi}
                      </div>
                    )}
                  </div>

                  {/* Error Correction + Explanation */}
                  {corrections.length > 0 && (
                    <div
                      className="mt-2 p-3 bg-warning bg-opacity-10 border border-warning rounded-4 small shadow-xs"
                      style={{ maxWidth: '85%' }}
                    >
                      <div className="fw-bold text-warning-emphasis mb-2">
                        💡 Gia sư sửa câu vừa rồi của bạn:
                      </div>
                      {corrections.map((corr, cIdx) => {
                        const wrongStr = corr.original || corr.originalText;
                        const rightStr = corr.corrected || corr.correctedText;
                        const expl = corr.explanationVi || corr.explanation;
                        return (
                          <div key={cIdx} className="p-2.5 bg-white rounded-3 border mb-2">
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                              <div>
                                <div className="text-danger text-decoration-line-through font-jp">
                                  ✗ Câu bạn nói: {wrongStr}
                                </div>
                                <div className="text-success fw-bold font-jp fs-6 d-flex align-items-center gap-1.5 mt-1">
                                  <span>✓ Câu đúng tự nhiên: {rightStr}</span>
                                  <AudioButton text={rightStr} size="sm" />
                                </div>
                              </div>

                              <button
                                type="button"
                                className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1 rounded-pill"
                                onClick={() => handlePracticeCorrection(rightStr)}
                              >
                                <RotateCcw size={13} />
                                <span>Nghe & nói lại</span>
                              </button>
                            </div>
                            {expl && <div className="text-muted mt-1.5">{expl}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Suggested New Words */}
                  {newWords.length > 0 && (
                    <div className="mt-2 d-flex flex-wrap gap-1.5" style={{ maxWidth: '85%' }}>
                      {newWords.map((w, wIdx) => {
                        const jp = w.word || w.japaneseText;
                        const vi = w.meaningVi || w.vietnameseMeaning;
                        if (!jp) return null;
                        const isSaved = savedWords.has(jp);
                        return (
                          <button
                            key={wIdx}
                            type="button"
                            className={`btn btn-sm d-inline-flex align-items-center gap-1 ${
                              isSaved ? 'btn-success' : 'btn-outline-primary bg-white'
                            }`}
                            onClick={() => handleSaveWord(w)}
                            disabled={isSaved}
                            title="Lưu từ này vào sổ từ vựng cá nhân"
                          >
                            <span className="font-jp fw-bold">{jp}</span>
                            {w.reading && <span className="small font-jp">[{w.reading}]</span>}
                            <span className="small">({vi})</span>
                            {isSaved ? <Check size={12} /> : <Plus size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* 2–3 Suggested Japanese Replies (Speak or Click to Send) */}
          {activeConversation.status !== 'ENDED' && activeSuggestions.length > 0 && (
            <div className="px-3.5 py-2.5 bg-light border-top">
              <div className="small fw-bold text-primary d-flex align-items-center gap-1 mb-1.5">
                <Sparkles size={14} /> Gợi ý câu trả lời tiếp theo (Nghe mẫu để đọc theo hoặc bấm dùng ngay):
              </div>
              <div className="row g-2">
                {activeSuggestions.slice(0, 3).map((sug, sIdx) => (
                  <div key={sIdx} className="col-12 col-md-4">
                    <div className="p-2.5 bg-white rounded-3 border h-100 d-flex flex-column justify-content-between shadow-xs">
                      <div>
                        <div className="d-flex justify-content-between align-items-start gap-1">
                          <span className="font-jp fw-bold text-dark">{sug.japanese}</span>
                          <AudioButton text={sug.japanese} size="sm" />
                        </div>
                        {sug.reading && (
                          <div className="font-jp text-primary" style={{ fontSize: '0.78rem' }}>
                            {sug.reading}
                          </div>
                        )}
                        {sug.vietnamese && (
                          <div className="text-muted fst-italic mt-0.5" style={{ fontSize: '0.78rem' }}>
                            {sug.vietnamese}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-0.5 px-2 mt-2 fw-semibold"
                        style={{ fontSize: '0.76rem' }}
                        disabled={sending}
                        onClick={() => sendVoiceText(sug.japanese)}
                      >
                        Trả lời bằng câu này
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeConversation.summary && (
            <div className="px-4 py-3 bg-info bg-opacity-10 border-top border-info small">
              <strong className="text-dark d-block mb-1">📋 Nhận xét tổng kết từ Gia sư AI:</strong>
              <div className="text-secondary" style={{ whiteSpace: 'pre-line' }}>{activeConversation.summary}</div>
            </div>
          )}

          {/* VOICE-ONLY MICROPHONE CONTROLS (Chat Mode removed) */}
          {activeConversation.status !== 'ENDED' && (
            <div className="p-3 bg-white border-top text-center">
              {practicingCorrectionText && (
                <div className="small text-success fw-semibold mb-2 d-flex align-items-center justify-content-center gap-2">
                  <span>🎯 Đọc lại câu chuẩn: <strong className="font-jp">{practicingCorrectionText}</strong></span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-muted text-decoration-none"
                    onClick={() => setPracticingCorrectionText('')}
                  >
                    Đóng
                  </button>
                </div>
              )}

              <div className="d-flex justify-content-center align-items-center gap-3 mb-2">
                <button
                  type="button"
                  className={`btn rounded-circle d-inline-flex align-items-center justify-content-center shadow ${
                    isRecording ? 'btn-danger' : 'btn-primary'
                  }`}
                  style={{ width: '74px', height: '74px' }}
                  onClick={toggleVoiceInput}
                  disabled={sending}
                  title={isRecording ? 'Bấm để dừng ghi âm và tự động gửi cho AI' : 'Bấm để bắt đầu nói tiếng Nhật'}
                >
                  {isRecording ? <MicOff size={30} /> : <Mic size={30} />}
                </button>
              </div>

              <div className="small fw-bold mb-2">
                {isRecording ? (
                  <span className="text-danger">
                    🎙️ Đang nghe bạn nói tiếng Nhật... (Nhấn Dừng để tự động gửi đến Gia sư AI)
                  </span>
                ) : sending || voiceStatus === 'processing' ? (
                  <span className="text-primary">
                    <Loader2 size={15} className="spinner-border spinner-border-sm me-1" />
                    Đang xử lý câu nói và phản hồi...
                  </span>
                ) : voiceStatus === 'ai_speaking' ? (
                  <span className="text-success">🔊 Gia sư AI đang trả lời bằng giọng nói...</span>
                ) : (
                  <span className="text-secondary">
                    Nhấn Micro để nói tiếng Nhật — Khi nhấn Dừng, hệ thống tự động gửi đến AI
                  </span>
                )}
              </div>

              {voiceTranscript && (
                <div className="p-2.5 bg-light rounded-3 border mx-auto mb-2" style={{ maxWidth: '640px' }}>
                  <div className="small text-muted">Bạn vừa nói:</div>
                  <div className="font-jp fw-bold text-dark fs-5">{voiceTranscript}</div>
                  {previewBeforeVoiceSend && !isRecording && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm mt-2 rounded-pill px-3"
                      onClick={() => sendVoiceText(voiceTranscript)}
                      disabled={sending}
                    >
                      Gửi câu nói này
                    </button>
                  )}
                </div>
              )}

              <label className="form-check-label d-inline-flex align-items-center gap-1.5 small text-muted" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="form-check-input mt-0"
                  checked={previewBeforeVoiceSend}
                  onChange={(e) => setPreviewBeforeVoiceSend(e.target.checked)}
                />
                <span>Xem trước văn bản nhận diện trước khi gửi</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Modal Tự tạo chủ đề hội thoại cá nhân */}
      {showCreateTopicModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Tự tạo chủ đề trò chuyện cá nhân</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateTopicModal(false)}></button>
              </div>
              <form onSubmit={handleCreatePersonalTopic}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Tên chủ đề / Tình huống *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: Mua sắm tại cửa hàng tiện lợi Konbini"
                      value={newTopicForm.nameVi}
                      onChange={(e) => setNewTopicForm({ ...newTopicForm, nameVi: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary">Vai của Gia sư AI</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newTopicForm.aiRole}
                        onChange={(e) => setNewTopicForm({ ...newTopicForm, aiRole: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary">Vai của bạn</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newTopicForm.userRole}
                        onChange={(e) => setNewTopicForm({ ...newTopicForm, userRole: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Cấp độ JLPT</label>
                    <select
                      className="form-select"
                      value={newTopicForm.jlptLevel}
                      onChange={(e) => setNewTopicForm({ ...newTopicForm, jlptLevel: e.target.value })}
                    >
                      <option value="N5">N5 - Cơ bản</option>
                      <option value="N4">N4 - Sơ cấp</option>
                      <option value="N3">N3 - Trung cấp</option>
                      <option value="N2">N2 - Trung cao</option>
                      <option value="N1">N1 - Cao cấp</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold text-secondary">Mô tả ngữ cảnh chi tiết</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="VD: Hỏi mua cơm nắm onigiri, nhờ hâm nóng đồ ăn và thanh toán..."
                      value={newTopicForm.description}
                      onChange={(e) => setNewTopicForm({ ...newTopicForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowCreateTopicModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-sky" disabled={creatingTopic}>
                    {creatingTopic ? 'Đang tạo...' : 'Lưu chủ đề cá nhân'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && summary && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Tổng kết phiên học cùng Gia sư AI</h5>
                <button type="button" className="btn-close" onClick={() => setShowSummaryModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="p-3 bg-light rounded-3 small text-dark" style={{ whiteSpace: 'pre-line' }}>
                  {summary.summary || 'Đã hoàn thành phiên hội thoại.'}
                </div>
              </div>
              <div className="modal-footer border-top">
                <button type="button" className="btn btn-primary" onClick={() => setShowSummaryModal(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationRoom;
