import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../common/AudioButton';
import { X, Play, Layers, RefreshCw } from 'lucide-react';

const LEVEL_META = [
  { level: 0, shortLabel: 'Lvl 0', name: 'Từ mới', color: '#64748b', bg: '#f1f5f9', text: '#475569' },
  { level: 1, shortLabel: 'Lvl 1', name: 'Đang học (4 giờ)', color: '#ea580c', bg: '#fff7ed', text: '#c2410c' },
  { level: 2, shortLabel: 'Lvl 2', name: 'Đang ghi nhớ (3 ngày)', color: '#d97706', bg: '#fffbeb', text: '#b45309' },
  { level: 3, shortLabel: 'Lvl 3', name: 'Ghi nhớ tốt (7 ngày)', color: '#0284c7', bg: '#f0f9ff', text: '#0369a1' },
  { level: 4, shortLabel: 'Lvl 4', name: 'Ghi nhớ rất tốt (14 ngày)', color: '#7c3aed', bg: '#f5f3ff', text: '#6d28d9' },
  { level: 5, shortLabel: 'Lvl 5', name: 'Đã thuộc (Vĩnh viễn)', color: '#16a34a', bg: '#f0fdf4', text: '#15803d' },
];

function formatReviewCountdown(card) {
  const lvl = card.srsLevel ?? 0;
  if (lvl === 0) {
    return { label: 'TỪ MỚI', className: 'bg-light text-secondary border' };
  }
  if (lvl === 5) {
    return { label: 'ĐÃ THUỘC', className: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' };
  }
  if (!card.dueAt) {
    return { label: 'ĐẾN HẠN', className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' };
  }
  const diffMs = new Date(card.dueAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return { label: 'ĐẾN HẠN', className: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 fw-bold' };
  }
  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) {
    return { label: `${totalMinutes} phút`, className: 'bg-light text-secondary border' };
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remMins = totalMinutes % 60;
  if (totalHours < 24) {
    return {
      label: remMins > 0 ? `${totalHours} giờ ${remMins} phút` : `${totalHours} giờ`,
      className: 'bg-light text-secondary border',
    };
  }
  const days = Math.ceil(totalHours / 24);
  return { label: `${days} ngày`, className: 'bg-light text-secondary border' };
}

export const SrsOverviewModal = ({ show, onClose, onStatsChanged }) => {
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deckFilter, setDeckFilter] = useState(''); // '' = all decks
  const [levelFilter, setLevelFilter] = useState('ALL'); // ALL | DUE | 0..5
  const [studyDeckId, setStudyDeckId] = useState('');
  const [studyLimit, setStudyLimit] = useState(20);
  const [updatingCardId, setUpdatingCardId] = useState(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        deckId: deckFilter ? Number(deckFilter) : undefined,
        filter: levelFilter || 'ALL',
      };
      const res = await axiosClient.get('/srs/overview', { params });
      if (res.success && res.data) {
        setOverview(res.data);
      }
    } catch (err) {
      console.error('Fetch SRS overview failed:', err);
    } finally {
      setLoading(false);
    }
  }, [deckFilter, levelFilter]);

  useEffect(() => {
    if (show) {
      fetchOverview();
    }
  }, [show, fetchOverview]);

  if (!show) return null;

  const stats = overview?.stats || {
    totalSrsCards: 0,
    rememberedCards: 0,
    dueTodayCards: 0,
    level0Count: 0,
    level1Count: 0,
    level2Count: 0,
    level3Count: 0,
    level4Count: 0,
    level5Count: 0,
  };
  const decks = overview?.decks || [];
  const cards = overview?.cards || [];

  const levelCounts = [
    stats.level0Count ?? 0,
    stats.level1Count ?? 0,
    stats.level2Count ?? 0,
    stats.level3Count ?? 0,
    stats.level4Count ?? 0,
    stats.level5Count ?? 0,
  ];
  const maxCount = Math.max(1, ...levelCounts);

  // Tính số thẻ sẵn sàng ôn cho nút CTA footer theo bộ thẻ được chọn ở footer
  const selectedFooterDeck = studyDeckId ? decks.find((d) => String(d.id) === String(studyDeckId)) : null;
  const footerDueCount = selectedFooterDeck ? selectedFooterDeck.dueCards : (stats.dueTodayCards ?? 0);
  const footerLvl0Count = selectedFooterDeck ? selectedFooterDeck.level0Count : (stats.level0Count ?? 0);
  const availableToStudy = footerDueCount > 0 ? footerDueCount : footerLvl0Count;
  const effectiveStudyCount = Math.min(Number(studyLimit) || 20, availableToStudy);

  const handleChangeCardLevel = async (flashcardId, newLevel) => {
    setUpdatingCardId(flashcardId);
    try {
      const res = await axiosClient.patch(`/srs/cards/${flashcardId}/level`, {
        srsLevel: Number(newLevel),
      });
      if (res.success) {
        await fetchOverview();
        if (onStatsChanged) onStatsChanged();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật cấp độ thẻ thất bại.');
    } finally {
      setUpdatingCardId(null);
    }
  };

  const handleStartStudy = () => {
    const targetDeck = studyDeckId || 'all';
    const limitVal = Math.max(1, Math.min(200, Number(studyLimit) || 20));
    const includeNew = footerDueCount === 0 && footerLvl0Count > 0 ? 'true' : 'false';
    const filterParam = footerDueCount === 0 && footerLvl0Count > 0 ? 'NEW' : 'DUE';
    onClose();
    navigate(`/app/decks/${targetDeck}/study?mode=due&limit=${limitVal}&includeNew=${includeNew}&filter=${filterParam}`);
  };

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="modal-header border-bottom px-4 py-3 bg-white">
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                <Layers size={20} />
              </div>
              <div>
                <h5 className="modal-title fw-bold text-dark mb-0">Tổng quan SRS (6 Cấp độ)</h5>
                <div className="small text-muted">
                  Tổng: <strong>{stats.totalSrsCards}</strong> thẻ · Đã nhớ (Level 5):{' '}
                  <strong className="text-success">{stats.rememberedCards}</strong> · Đến hạn hôm nay:{' '}
                  <strong className="text-primary">{stats.dueTodayCards}</strong>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-light btn-sm border text-secondary"
                onClick={fetchOverview}
                title="Làm mới dữ liệu"
              >
                <RefreshCw size={15} className={loading ? 'spinner-border spinner-border-sm' : ''} />
              </button>
              <button type="button" className="btn btn-light btn-sm border" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body px-4 py-3 bg-light bg-opacity-50 d-flex flex-column gap-4">
            {/* Section 1: PHÂN BỐ TỪ VỰNG THEO CẤP ĐỘ (Bar Chart Lvl 0 -> Lvl 5) */}
            <div className="card border rounded-4 p-4 bg-white shadow-xs">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="small fw-bold text-uppercase text-secondary" style={{ letterSpacing: '0.06em' }}>
                  Phân bố từ vựng theo cấp độ
                </span>
                <span className="small text-muted">Bấm vào từng cột để lọc nhanh</span>
              </div>

              <div
                className="d-flex align-items-end justify-content-around gap-3 pt-3 pb-2 px-2"
                style={{ minHeight: '155px' }}
              >
                {LEVEL_META.map((m, idx) => {
                  const count = levelCounts[idx];
                  const barHeightPct = count === 0 ? 6 : Math.max(14, Math.round((count / maxCount) * 100));
                  const isSelected = String(levelFilter) === String(m.level);
                  return (
                    <button
                      key={m.level}
                      type="button"
                      className="btn border-0 p-1 d-flex flex-column align-items-center flex-grow-1"
                      style={{
                        maxWidth: '96px',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? m.bg : 'transparent',
                        outline: isSelected ? `2px solid ${m.color}` : 'none',
                      }}
                      onClick={() => setLevelFilter(isSelected ? 'ALL' : String(m.level))}
                      title={`${m.shortLabel}: ${m.name} (${count} từ)`}
                    >
                      <span className="fw-bold mb-1" style={{ color: count > 0 ? m.color : '#94a3b8', fontSize: '0.95rem' }}>
                        {count}
                      </span>
                      <div
                        className="w-100 d-flex align-items-end justify-content-center"
                        style={{ height: '84px' }}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: `${barHeightPct}%`,
                            backgroundColor: count > 0 ? m.color : '#e2e8f0',
                            borderRadius: '8px 8px 4px 4px',
                            transition: 'height 0.3s ease',
                          }}
                        />
                      </div>
                      <span className="small fw-semibold text-secondary mt-2">{m.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Danh sách từ đang học (N) + Filters + Table */}
            <div className="card border rounded-4 bg-white overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h6 className="fw-bold text-dark mb-0">
                  Danh sách từ đang học ({cards.length})
                </h6>

                <div className="d-flex flex-wrap align-items-center gap-2">
                  <select
                    className="form-select form-select-sm bg-light"
                    style={{ width: 'auto', minWidth: '170px' }}
                    value={deckFilter}
                    onChange={(e) => {
                      setDeckFilter(e.target.value);
                      setStudyDeckId(e.target.value);
                    }}
                  >
                    <option value="">Tất cả bộ từ</option>
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.totalCards})
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select form-select-sm bg-light"
                    style={{ width: 'auto', minWidth: '150px' }}
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                  >
                    <option value="ALL">Level (Tất cả)</option>
                    <option value="DUE">Đến hạn hôm nay ({stats.dueTodayCards})</option>
                    <option value="0">Lvl 0 · Từ mới ({stats.level0Count})</option>
                    <option value="1">Lvl 1 · 4 giờ ({stats.level1Count})</option>
                    <option value="2">Lvl 2 · 3 ngày ({stats.level2Count})</option>
                    <option value="3">Lvl 3 · 7 ngày ({stats.level3Count})</option>
                    <option value="4">Lvl 4 · 14 ngày ({stats.level4Count})</option>
                    <option value="5">Lvl 5 · Đã thuộc ({stats.level5Count})</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: '320px' }}>
                <table className="table table-hover align-middle mb-0 small">
                  <thead className="table-light sticky-top">
                    <tr className="text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                      <th className="ps-4">Từ vựng</th>
                      <th>Nghĩa</th>
                      <th style={{ width: '140px' }}>Mức độ</th>
                      <th className="text-end pe-4" style={{ width: '160px' }}>Ôn tập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          <div className="spinner-border spinner-border-sm text-primary me-2" />
                          Đang tải dữ liệu SRS từ PostgreSQL...
                        </td>
                      </tr>
                    ) : cards.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-5 text-muted">
                          Không có từ vựng nào khớp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      cards.map((card) => {
                        const lvl = card.srsLevel ?? 0;
                        const meta = LEVEL_META[lvl] || LEVEL_META[0];
                        const dueMeta = formatReviewCountdown(card);
                        return (
                          <tr key={card.flashcardId}>
                            <td className="ps-4">
                              <div className="d-flex align-items-center gap-2">
                                <div>
                                  <div className="font-jp fw-bold text-dark fs-6">{card.front}</div>
                                  {card.reading && (
                                    <div className="font-jp text-muted" style={{ fontSize: '0.78rem' }}>
                                      {card.reading}
                                    </div>
                                  )}
                                </div>
                                <AudioButton text={card.front} size="sm" />
                              </div>
                            </td>
                            <td>
                              <div className="fw-semibold text-dark">{card.back}</div>
                              {card.deckName && (
                                <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                                  {card.deckName}
                                </div>
                              )}
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm fw-bold rounded-pill"
                                style={{
                                  width: '96px',
                                  backgroundColor: meta.bg,
                                  color: meta.text,
                                  borderColor: meta.color,
                                  fontSize: '0.78rem',
                                }}
                                value={lvl}
                                disabled={updatingCardId === card.flashcardId}
                                onChange={(e) => handleChangeCardLevel(card.flashcardId, e.target.value)}
                              >
                                <option value={0}>Lv0</option>
                                <option value={1}>Lv1</option>
                                <option value={2}>Lv2</option>
                                <option value={3}>Lv3</option>
                                <option value={4}>Lv4</option>
                                <option value={5}>Lv5</option>
                              </select>
                            </td>
                            <td className="text-end pe-4">
                              <span className={`badge rounded-pill px-2.5 py-1 ${dueMeta.className}`}>
                                {dueMeta.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer matching reference layout */}
          <div className="modal-footer border-top bg-white px-4 py-3 d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              {footerDueCount > 0 ? (
                <span className="badge rounded-pill px-3 py-2 bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 fw-bold">
                  ĐẾN HẠN: {footerDueCount} TỪ
                </span>
              ) : (
                <span className="badge rounded-pill px-3 py-2 bg-light text-secondary border fw-bold">
                  HẾT TỪ ĐẾN HẠN
                </span>
              )}
              <span className="badge rounded-pill px-3 py-2 bg-light text-dark border fw-semibold">
                LEVEL 0: {footerLvl0Count} TỪ
              </span>
              <span className="small text-muted ms-1">
                Tổng: <strong>{stats.totalSrsCards}</strong> thẻ · Đã nhớ: <strong className="text-success">{stats.rememberedCards}</strong>
              </span>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="d-flex align-items-center gap-1.5 small text-secondary">
                <span>Ôn theo:</span>
                <select
                  className="form-select form-select-sm bg-light"
                  style={{ width: 'auto', minWidth: '150px' }}
                  value={studyDeckId}
                  onChange={(e) => setStudyDeckId(e.target.value)}
                >
                  <option value="">Tất cả bộ từ</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex align-items-center gap-1.5 small text-secondary">
                <span>Số từ:</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="form-control form-control-sm text-center fw-bold"
                  style={{ width: '68px' }}
                  value={studyLimit}
                  onChange={(e) => setStudyLimit(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary fw-bold px-4 py-2 rounded-3 d-flex align-items-center gap-2 shadow-xs"
                disabled={effectiveStudyCount === 0}
                onClick={handleStartStudy}
              >
                <Play size={16} />
                <span>
                  {footerDueCount > 0
                    ? `Ôn tập (${effectiveStudyCount} từ)`
                    : footerLvl0Count > 0
                    ? `Học từ mới (${effectiveStudyCount} từ)`
                    : 'Ôn tập (0 từ)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SrsOverviewModal;
