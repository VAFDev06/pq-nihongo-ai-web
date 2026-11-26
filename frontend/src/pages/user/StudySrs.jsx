import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { speakJapanese } from '../../utils/tts';
import { useAuth } from '../../auth/AuthContext';
import SrsOverviewModal from '../../components/srs/SrsOverviewModal';
import {
  ArrowLeft,
  Volume2,
  CheckCircle,
  Eye,
  EyeOff,
  RotateCw,
  RotateCcw,
  History,
  Layers,
  Clock,
  BookOpen,
  Search,
  RefreshCw,
} from 'lucide-react';

const LEVEL_BUTTONS = [
  {
    level: 1,
    title: 'Level 1',
    subtitle: 'Đang học',
    interval: '4 giờ',
    bg: '#fff7ed',
    border: '#fdba74',
    color: '#c2410c',
    badgeClass: 'bg-danger text-white',
  },
  {
    level: 2,
    title: 'Level 2',
    subtitle: 'Đang ghi nhớ',
    interval: '3 ngày',
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#b45309',
    badgeClass: 'bg-warning text-dark',
  },
  {
    level: 3,
    title: 'Level 3',
    subtitle: 'Ghi nhớ tốt',
    interval: '7 ngày',
    bg: '#f0f9ff',
    border: '#bae6fd',
    color: '#0369a1',
    badgeClass: 'bg-info text-dark',
  },
  {
    level: 4,
    title: 'Level 4',
    subtitle: 'Ghi nhớ rất tốt',
    interval: '14 ngày',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    color: '#6d28d9',
    badgeClass: 'bg-primary text-white',
  },
  {
    level: 5,
    title: 'Level 5',
    subtitle: 'Đã thuộc',
    interval: 'Vĩnh viễn',
    bg: '#f0fdf4',
    border: '#86efac',
    color: '#15803d',
    badgeClass: 'bg-success text-white',
  },
];

function getLevelBadgeMeta(level) {
  switch (Number(level ?? 0)) {
    case 0:
      return { label: 'Level 0 · Từ mới', className: 'bg-light text-secondary border' };
    case 1:
      return { label: 'Level 1 · Đang học (4 giờ)', className: 'bg-danger bg-opacity-10 text-danger border-danger border-opacity-25' };
    case 2:
      return { label: 'Level 2 · Đang ghi nhớ (3 ngày)', className: 'bg-warning bg-opacity-10 text-warning-emphasis border-warning border-opacity-25' };
    case 3:
      return { label: 'Level 3 · Ghi nhớ tốt (7 ngày)', className: 'bg-info bg-opacity-10 text-info-emphasis border-info border-opacity-25' };
    case 4:
      return { label: 'Level 4 · Ghi nhớ rất tốt (14 ngày)', className: 'bg-primary bg-opacity-10 text-primary border-primary border-opacity-25' };
    case 5:
      return { label: 'Level 5 · Đã thuộc (Vĩnh viễn)', className: 'bg-success bg-opacity-10 text-success border-success border-opacity-25' };
    default:
      return { label: `Level ${level}`, className: 'bg-light text-dark border' };
  }
}

export const StudySrs = () => {
  const { id: rawDeckId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAllDecks = !rawDeckId || rawDeckId === 'all';
  const deckIdParam = isAllDecks ? null : rawDeckId;

  const initialMode = searchParams.get('mode') === 'relearn' && deckIdParam ? 'SET_RELEARN' : 'DUE_REVIEW';
  const limitParam = Number(searchParams.get('limit')) || 100;
  const includeNewParam = searchParams.get('includeNew') === 'true';
  const filterParam = searchParams.get('filter') || '';

  const { ttsSpeed } = useAuth();

  const [activeView, setActiveView] = useState('study'); // 'study' | 'history'
  const [studyMode, setStudyMode] = useState(initialMode); // 'DUE_REVIEW' | 'SET_RELEARN'
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const [showExampleVi, setShowExampleVi] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);

  // 3 chỉ số SRS đồng bộ 100% với Dashboard & PostgreSQL
  const [globalStats, setGlobalStats] = useState(null);

  // Lịch sử ôn tập SRS
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRange, setHistoryRange] = useState('30d');
  const [historyRating, setHistoryRating] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');

  const cardShownAtRef = useRef(Date.now());

  const fetchStats = useCallback(async () => {
    try {
      const res = await axiosClient.get('/srs/stats');
      if (res?.success && res.data) {
        setGlobalStats(res.data);
      }
    } catch (err) {
      console.error('Fetch SRS stats failed:', err);
    }
  }, []);

  const fetchSessionCards = useCallback(async (modeOverride = null) => {
    const modeToUse = modeOverride || studyMode;
    setLoading(true);
    try {
      await fetchStats();
      let res;
      if (modeToUse === 'SET_RELEARN' && deckIdParam) {
        res = await axiosClient.get(`/srs/decks/${deckIdParam}/relearn`);
      } else {
        const params = new URLSearchParams();
        if (deckIdParam) params.set('deckId', deckIdParam);
        params.set('limit', String(limitParam));
        if (includeNewParam) params.set('includeNew', 'true');
        if (filterParam) params.set('filter', filterParam);
        res = await axiosClient.get(`/srs/due?${params.toString()}`);
      }

      if (res?.success && Array.isArray(res.data)) {
        setCards(res.data);
        setSessionCompleted(false);
      } else {
        setCards([]);
      }
      setCurrentIndex(0);
      setIsFlipped(false);
      cardShownAtRef.current = Date.now();
    } catch (err) {
      console.error('Fetch SRS cards failed:', err);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [deckIdParam, studyMode, limitParam, includeNewParam, filterParam, fetchStats]);

  const fetchReviewHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = {
        deckId: deckIdParam || undefined,
        range: historyRange || 'all',
        rating: historyRating ? Number(historyRating) : undefined,
        q: historyQuery || undefined,
      };
      const res = await axiosClient.get('/srs/history', { params });
      if (res.success && Array.isArray(res.data)) {
        setHistoryList(res.data);
      }
    } catch (err) {
      console.error('Fetch review history failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [deckIdParam, historyRange, historyRating, historyQuery]);

  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'relearn' && deckIdParam ? 'SET_RELEARN' : 'DUE_REVIEW';
    setStudyMode(modeFromUrl);
    fetchSessionCards(modeFromUrl);
  }, [deckIdParam, searchParams, fetchSessionCards]);

  useEffect(() => {
    if (activeView === 'history') {
      fetchReviewHistory();
    }
  }, [activeView, fetchReviewHistory]);

  const currentCard = cards[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleSpeakWord = (e) => {
    if (e) e.stopPropagation();
    if (!currentCard) return;
    speakJapanese(currentCard.front || currentCard.japaneseText, { rate: ttsSpeed });
  };

  const handleSpeakExample = (e) => {
    if (e) e.stopPropagation();
    if (!currentCard) return;
    const exJa = currentCard.exampleJa || currentCard.exampleSentence;
    if (exJa) speakJapanese(exJa, { rate: ttsSpeed });
  };

  const handleStartRelearnDeck = () => {
    if (!deckIdParam) return;
    setStudyMode('SET_RELEARN');
    setSearchParams({ mode: 'relearn' });
  };

  const handleRate = useCallback(async (targetLevel) => {
    if (!currentCard || submitting || !isFlipped) return;
    setSubmitting(true);

    try {
      const cardId = currentCard.flashcardId || currentCard.cardId || currentCard.id;
      const durationMs = Math.max(200, Date.now() - cardShownAtRef.current);
      await axiosClient.post('/srs/review', {
        flashcardId: cardId,
        targetLevel, // 1..5 (Level 1..Level 5)
        reviewMode: studyMode,
        durationMs,
      });

      await fetchStats();

      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        cardShownAtRef.current = Date.now();
      } else {
        setSessionCompleted(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Ghi nhận ôn tập thất bại.');
    } finally {
      setSubmitting(false);
    }
  }, [currentCard, submitting, isFlipped, studyMode, fetchStats, currentIndex, cards.length]);

  // Phím tắt: Space = Lật thẻ, 1-5 = Chọn cấp độ SRS sau khi đã lật thẻ
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeView !== 'study' || sessionCompleted || loading || !currentCard) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
          handleRate(Number(e.key));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, isFlipped, currentCard, sessionCompleted, loading, handleFlip, handleRate]);

  const activeStats = globalStats || {
    totalSrsCards: 0,
    rememberedCards: 0,
    dueTodayCards: 0,
  };

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header & View Switcher */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div className="d-flex align-items-center gap-2.5">
          <Link
            to={deckIdParam ? `/app/decks/${deckIdParam}` : '/app/decks'}
            className="btn btn-light btn-sm border text-secondary d-flex align-items-center gap-1.5 px-2.5 py-1.5"
          >
            <ArrowLeft size={16} />
            <span>Bộ thẻ</span>
          </Link>
          <div>
            <h4 className="fw-bold text-dark mb-0">
              {studyMode === 'SET_RELEARN' ? 'Học lại bộ thẻ (SRS 6 cấp độ)' : 'Ôn tập ngắt quãng SRS (6 cấp độ)'}
            </h4>
            <p className="text-muted small mb-0">
              {studyMode === 'SET_RELEARN'
                ? 'Học lại toàn bộ thẻ (bao gồm Level 5) — đánh giá mới sẽ ghi đè cấp độ và giữ nguyên lịch sử học cũ'
                : 'Chọn trực tiếp cấp độ ghi nhớ Level 1–5 sau khi lật thẻ; số liệu đồng bộ 100% với Dashboard'}
            </p>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1.5 fw-semibold"
            onClick={() => setShowOverviewModal(true)}
          >
            Tổng quan SRS
          </button>

          <button
            type="button"
            className={`btn btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill fw-semibold ${
              activeView === 'study' ? 'btn-primary shadow-xs' : 'btn-light border text-secondary'
            }`}
            onClick={() => setActiveView('study')}
          >
            <Layers size={15} />
            <span>Phiên học</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill fw-semibold ${
              activeView === 'history' ? 'btn-primary shadow-xs' : 'btn-light border text-secondary'
            }`}
            onClick={() => setActiveView('history')}
          >
            <History size={15} />
            <span>Lịch sử</span>
          </button>
        </div>
      </div>

      {/* 3 Synchronized SRS Metrics Bar (Matches Dashboard & Decks 100%) */}
      <div className="row g-3 text-center">
        <div className="col-4">
          <div className="card pq-card p-3 h-100 border">
            <div className="text-muted small fw-semibold">Tổng số thẻ</div>
            <div className="fs-4 fw-bold text-dark">{activeStats.totalSrsCards ?? 0}</div>
          </div>
        </div>
        <div className="col-4">
          <div className="card pq-card p-3 h-100 border border-success border-opacity-25 bg-success bg-opacity-10">
            <div className="text-success small fw-semibold">Đã nhớ (Level 5)</div>
            <div className="fs-4 fw-bold text-success">{activeStats.rememberedCards ?? 0}</div>
          </div>
        </div>
        <div className="col-4">
          <div className="card pq-card p-3 h-100 border border-primary border-opacity-25 bg-primary bg-opacity-10">
            <div className="text-primary small fw-semibold">Đến hạn hôm nay</div>
            <div className="fs-4 fw-bold text-primary">{activeStats.dueTodayCards ?? 0}</div>
          </div>
        </div>
      </div>

      {/* VIEW 1: SRS REVIEW HISTORY */}
      {activeView === 'history' && (
        <div className="card pq-card p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
            <div>
              <h5 className="fw-bold text-dark mb-0">Lịch sử ôn tập SRS</h5>
              <span className="small text-muted">Mọi lần ôn tập và học lại đều được lưu vết đầy đủ, không ghi đè hay xóa lịch sử cũ</span>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
              onClick={fetchReviewHistory}
            >
              <RefreshCw size={14} />
              <span>Làm mới</span>
            </button>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-12 col-md-5">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tìm theo từ tiếng Nhật, Hiragana hoặc nghĩa..."
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select
                className="form-select form-select-sm"
                value={historyRange}
                onChange={(e) => setHistoryRange(e.target.value)}
              >
                <option value="today">Hôm nay</option>
                <option value="7d">7 ngày qua</option>
                <option value="30d">30 ngày qua</option>
                <option value="all">Tất cả thời gian</option>
              </select>
            </div>
            <div className="col-6 col-md-4">
              <select
                className="form-select form-select-sm"
                value={historyRating}
                onChange={(e) => setHistoryRating(e.target.value)}
              >
                <option value="">Tất cả cấp độ (Level 1–5)</option>
                <option value="1">Level 1 · Đang học (4 giờ)</option>
                <option value="2">Level 2 · Đang ghi nhớ (3 ngày)</option>
                <option value="3">Level 3 · Ghi nhớ tốt (7 ngày)</option>
                <option value="4">Level 4 · Ghi nhớ rất tốt (14 ngày)</option>
                <option value="5">Level 5 · Đã thuộc (Vĩnh viễn)</option>
              </select>
            </div>
          </div>

          {historyLoading ? (
            <div className="text-center py-4 text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2" />
              Đang tải lịch sử ôn tập...
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <History size={38} className="opacity-50 mb-2" />
              <div className="fw-semibold text-dark">Chưa có lịch sử ôn tập nào khớp bộ lọc.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle small mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Thời gian</th>
                    <th>Từ vựng</th>
                    <th>Nghĩa tiếng Việt</th>
                    <th>Chuyển cấp độ</th>
                    <th>Chế độ</th>
                    <th>Hẹn ôn tiếp theo</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((item) => {
                    const lvl = item.newLevel ?? item.rating ?? 1;
                    const meta = getLevelBadgeMeta(lvl);
                    const modeLabel =
                      item.reviewMode === 'SET_RELEARN'
                        ? 'Học lại bộ thẻ'
                        : item.reviewMode === 'MANUAL_LEVEL'
                        ? 'Đổi cấp độ'
                        : 'Ôn đến hạn';
                    return (
                      <tr key={item.id}>
                        <td className="text-muted">
                          {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString('vi-VN') : '-'}
                        </td>
                        <td>
                          <div className="fw-bold font-jp text-dark fs-6">{item.front}</div>
                          {item.reading && <div className="text-muted font-jp">{item.reading}</div>}
                        </td>
                        <td className="fw-semibold text-dark">{item.back}</td>
                        <td>
                          <span className="text-muted me-1">
                            {item.previousLevel !== null && item.previousLevel !== undefined ? `Lv${item.previousLevel} →` : ''}
                          </span>
                          <span className={`badge border ${meta.className}`}>{meta.label}</span>
                        </td>
                        <td>
                          <span className="badge bg-light text-secondary border">{modeLabel}</span>
                        </td>
                        <td className="fw-semibold">
                          {lvl === 5 ? (
                            <span className="text-success">Đã thuộc (Vĩnh viễn)</span>
                          ) : item.nextDueAt ? (
                            <span className="text-primary">{new Date(item.nextDueAt).toLocaleString('vi-VN')}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SRS STUDY FLASHCARD */}
      {activeView === 'study' && (
        <>
          {loading ? (
            <div className="card pq-card p-5 text-center">
              <div className="spinner-border text-primary mx-auto" role="status"></div>
              <p className="text-muted small mt-2 mb-0">Đang nạp danh sách thẻ...</p>
            </div>
          ) : sessionCompleted || cards.length === 0 ? (
            <div className="card pq-card p-5 text-center">
              <CheckCircle size={56} className="text-success mx-auto mb-3" />
              <h4 className="fw-bold text-dark mb-2">
                {sessionCompleted
                  ? studyMode === 'SET_RELEARN'
                    ? 'Đã hoàn thành lượt học lại bộ thẻ!'
                    : 'Hoàn thành phiên ôn tập SRS!'
                  : 'Hiện không còn thẻ nào đến hạn ôn ngay lúc này'}
              </h4>
              <p className="text-muted mb-4" style={{ maxWidth: '540px', margin: '0 auto' }}>
                Toàn bộ cấp độ Level 0–5 và lịch ôn tiếp theo đã được cập nhật trong PostgreSQL và đồng bộ với Trang Tổng quan.
              </p>

              <div className="d-flex flex-wrap justify-content-center gap-2.5">
                {deckIdParam && (
                  <button
                    type="button"
                    className="btn btn-primary fw-semibold d-flex align-items-center gap-1.5"
                    onClick={handleStartRelearnDeck}
                  >
                    <RotateCcw size={16} />
                    <span>Học lại bộ thẻ</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-outline-primary d-flex align-items-center gap-1.5"
                  onClick={() => setShowOverviewModal(true)}
                >
                  <Layers size={16} />
                  <span>Mở Tổng quan SRS</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary d-flex align-items-center gap-1.5"
                  onClick={() => setActiveView('history')}
                >
                  <History size={16} />
                  <span>Xem lịch sử ôn tập</span>
                </button>

                <Link to="/app/decks" className="btn btn-light border">
                  Về danh sách bộ thẻ
                </Link>
              </div>
            </div>
          ) : (
            (() => {
              const frontText = currentCard.front || currentCard.japaneseText || '';
              const readingText = currentCard.reading || '';
              const backText = currentCard.back || currentCard.vietnameseMeaning || '';
              const partOfSpeech = currentCard.partOfSpeech || '';
              const hanViet = currentCard.hanViet || '';
              const exJa = currentCard.exampleJa || currentCard.exampleSentence || '';
              const exVi = currentCard.exampleVi || currentCard.exampleMeaning || '';
              const exReading = currentCard.exampleReading || '';
              const levelBadge = getLevelBadgeMeta(currentCard.srsLevel ?? 0);

              return (
                <div className="d-flex flex-column gap-3">
                  {/* Session Progress & Display Toggles */}
                  <div className="card pq-card px-3.5 py-2.5 d-flex flex-wrap flex-row justify-content-between align-items-center gap-2">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span className={`badge border ${levelBadge.className} px-2.5 py-1`}>
                        {levelBadge.label}
                      </span>
                      {studyMode === 'SET_RELEARN' && (
                        <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25">
                          Chế độ Học lại bộ thẻ
                        </span>
                      )}
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-grow-1 mx-md-4" style={{ maxWidth: '340px' }}>
                      <div className="progress flex-grow-1" style={{ height: '8px', borderRadius: '999px' }}>
                        <div
                          className="progress-bar bg-primary"
                          style={{
                            width: `${((currentIndex + 1) / cards.length) * 100}%`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <span className="small text-dark fw-bold">
                        Thẻ {currentIndex + 1} / {cards.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-light btn-sm border d-flex align-items-center gap-1 text-secondary"
                      onClick={() => setShowFurigana(!showFurigana)}
                    >
                      {showFurigana ? <Eye size={15} /> : <EyeOff size={15} />}
                      <span className="small">Hiragana: {showFurigana ? 'Bật' : 'Tắt'}</span>
                    </button>
                  </div>

                  {/* MAIN SRS CARD */}
                  <div
                    className="card pq-card p-4 p-md-5 d-flex flex-column justify-content-between position-relative"
                    style={{
                      minHeight: '380px',
                      borderRadius: '20px',
                      border: isFlipped ? '1.5px solid #bfdbfe' : '1.5px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 8px 28px rgba(15, 23, 42, 0.06)',
                      cursor: 'pointer',
                    }}
                    onClick={handleFlip}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="small fw-semibold text-uppercase text-muted" style={{ letterSpacing: '0.05em' }}>
                        {isFlipped ? 'Mặt sau • Đáp án & Ví dụ' : 'Mặt trước • Từ vựng tiếng Nhật'}
                      </span>

                      <button
                        type="button"
                        className="btn btn-light border rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-1.5 text-primary fw-semibold shadow-xs"
                        onClick={handleSpeakWord}
                        title="Nghe phát âm từ vựng"
                      >
                        <Volume2 size={18} />
                        <span className="small">Phát âm ({ttsSpeed}x)</span>
                      </button>
                    </div>

                    <div className="text-center my-auto py-3">
                      <div
                        className="font-jp fw-bold text-dark mb-2"
                        style={{
                          fontSize: isFlipped ? 'clamp(2.2rem, 5vw, 3.1rem)' : 'clamp(2.8rem, 6.5vw, 4.2rem)',
                          lineHeight: 1.25,
                        }}
                      >
                        {frontText}
                      </div>

                      {showFurigana && readingText && (
                        <div className="d-inline-block font-jp fs-4 fw-semibold text-primary bg-primary bg-opacity-10 px-3.5 py-1 rounded-pill">
                          {readingText}
                        </div>
                      )}

                      {isFlipped && (
                        <div
                          className="mt-4 pt-4 border-top text-start mx-auto"
                          style={{ maxWidth: '640px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-3.5 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-25 text-center mb-3">
                            <div className="small text-primary fw-semibold text-uppercase mb-1">Nghĩa tiếng Việt</div>
                            <div className="fs-3 fw-bold text-dark">{backText}</div>

                            <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-2">
                              {partOfSpeech && (
                                <span className="badge bg-white text-secondary border px-2.5 py-1">
                                  Từ loại: {partOfSpeech}
                                </span>
                              )}
                              {hanViet && (
                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1 fw-bold">
                                  Hán Việt: {hanViet.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>

                          {exJa && (
                            <div className="p-3.5 rounded-4 bg-light border mb-2">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="small fw-bold text-secondary d-flex align-items-center gap-1">
                                  <BookOpen size={14} /> Câu ví dụ ngữ cảnh:
                                </span>
                                <div className="d-flex align-items-center gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm bg-white border py-0.5 px-2 d-inline-flex align-items-center gap-1 text-primary"
                                    onClick={handleSpeakExample}
                                  >
                                    <Volume2 size={14} />
                                    <span className="small">Nghe câu</span>
                                  </button>
                                  {exVi && (
                                    <button
                                      type="button"
                                      className="btn btn-sm bg-white border py-0.5 px-2 text-secondary small"
                                      onClick={() => setShowExampleVi(!showExampleVi)}
                                    >
                                      {showExampleVi ? 'Ẩn dịch' : 'Hiện dịch'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="font-jp fw-bold text-dark fs-5">{exJa}</div>
                              {exReading && <div className="font-jp small text-primary mt-0.5">{exReading}</div>}
                              {showExampleVi && exVi && (
                                <div className="small text-muted fst-italic mt-1">{exVi}</div>
                              )}
                            </div>
                          )}

                          {currentCard.note && (
                            <div className="p-2.5 rounded-3 bg-light border small text-secondary">
                              <strong>Ghi chú:</strong> {currentCard.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-center pt-2">
                      {!isFlipped ? (
                        <button
                          type="button"
                          className="btn btn-primary rounded-pill px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFlip();
                          }}
                        >
                          <RotateCw size={17} />
                          <span>Lật thẻ xem đáp án (Phím Space)</span>
                        </button>
                      ) : (
                        <span className="small text-muted">
                          Chọn trực tiếp cấp độ ghi nhớ Level 1–5 bên dưới (hoặc nhấn phím 1, 2, 3, 4, 5)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 5-LEVEL RATING BUTTONS (LEVEL 1 -> LEVEL 5) */}
                  {isFlipped && (
                    <div className="card pq-card p-3.5 border">
                      <div className="small fw-bold text-secondary text-center mb-3">
                        Đánh giá mức độ ghi nhớ (có thể chọn thẳng bất kỳ cấp độ nào từ Level 1 đến Level 5):
                      </div>
                      <div className="row g-2">
                        {LEVEL_BUTTONS.map((btn) => {
                          const isCurrent = Number(currentCard.srsLevel) === btn.level;
                          return (
                            <div key={btn.level} className="col-6 col-md">
                              <button
                                type="button"
                                className="btn w-100 p-2.5 rounded-3 text-center d-flex flex-column align-items-center justify-content-center h-100"
                                style={{
                                  backgroundColor: btn.bg,
                                  border: isCurrent ? `2.5px solid ${btn.color}` : `1.5px solid ${btn.border}`,
                                  color: btn.color,
                                }}
                                disabled={submitting}
                                onClick={() => handleRate(btn.level)}
                              >
                                <div className="fw-bold" style={{ fontSize: '0.92rem' }}>
                                  {btn.level} · {btn.title}
                                </div>
                                <div className="small opacity-85 my-0.5" style={{ fontSize: '0.73rem' }}>
                                  {btn.subtitle}
                                </div>
                                <span className={`badge mt-1 ${btn.badgeClass}`}>
                                  <Clock size={11} className="me-1" />
                                  {btn.interval}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </>
      )}

      <SrsOverviewModal
        show={showOverviewModal}
        onClose={() => setShowOverviewModal(false)}
        onStatsChanged={() => {
          fetchStats();
          if (activeView === 'history') fetchReviewHistory();
        }}
      />
    </div>
  );
};

export default StudySrs;
