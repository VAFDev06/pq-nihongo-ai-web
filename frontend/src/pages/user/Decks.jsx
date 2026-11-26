import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import SrsOverviewModal from '../../components/srs/SrsOverviewModal';
import {
  Layers,
  Plus,
  Copy,
  Play,
  HelpCircle,
  Edit,
  Trash2,
  RotateCcw,
} from 'lucide-react';

export const Decks = () => {
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'system'
  const [myDecks, setMyDecks] = useState([]);
  const [systemDecks, setSystemDecks] = useState([]);
  const [srsStats, setSrsStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSrsOverview, setShowSrsOverview] = useState(false);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    jlptLevel: 'N5',
    isPublic: false,
  });

  const navigate = useNavigate();

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    try {
      const [resMy, resSys, resStats] = await Promise.all([
        axiosClient.get('/decks?scope=mine'),
        axiosClient.get('/decks/system'),
        axiosClient.get('/srs/stats'),
      ]);
      if (resMy.success && resMy.data) {
        const list = Array.isArray(resMy.data) ? resMy.data : (resMy.data.content || []);
        setMyDecks(list);
      }
      if (resSys.success && resSys.data) {
        const sysList = Array.isArray(resSys.data) ? resSys.data : (resSys.data.content || []);
        setSystemDecks(sysList);
      }
      if (resStats?.success && resStats.data) {
        setSrsStats(resStats.data);
      }
    } catch (err) {
      console.error('Fetch decks failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecks();
    const handleFocus = () => fetchDecks();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchDecks]);

  const handleOpenCreate = () => {
    setEditingDeck(null);
    setFormData({
      name: '',
      description: '',
      jlptLevel: 'N5',
      isPublic: false,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (deck) => {
    setEditingDeck(deck);
    setFormData({
      name: deck.name || deck.title || '',
      description: deck.description || '',
      jlptLevel: deck.jlptLevel || 'N5',
      isPublic: !!deck.isPublic,
    });
    setShowModal(true);
  };

  const handleSaveDeck = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name.trim(),
      title: formData.name.trim(),
      description: formData.description.trim(),
      jlptLevel: formData.jlptLevel,
      isPublic: formData.isPublic,
    };
    try {
      if (editingDeck) {
        const res = await axiosClient.put(`/decks/${editingDeck.id}`, payload);
        if (res.success) {
          setShowModal(false);
          fetchDecks();
        }
      } else {
        const res = await axiosClient.post('/decks', payload);
        if (res.success && res.data) {
          setShowModal(false);
          fetchDecks();
          navigate(`/app/decks/${res.data.id}`);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu bộ thẻ thất bại.');
    }
  };

  const handleDeleteDeck = async (deckId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bộ thẻ này không?')) return;
    try {
      const res = await axiosClient.delete(`/decks/${deckId}`);
      if (res.success) {
        fetchDecks();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Xóa bộ thẻ thất bại.');
    }
  };

  const handleCloneDeck = async (deckId) => {
    try {
      const res = await axiosClient.post(`/decks/${deckId}/clone`);
      if (res.success && res.data) {
        await fetchDecks();
        setActiveTab('my');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Sao chép bộ thẻ thất bại.');
    }
  };

  const currentList = activeTab === 'my' ? myDecks : systemDecks;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h3 className="fw-bold mb-1">Bộ thẻ ghi nhớ Flashcard & SRS</h3>
          <p className="text-muted small mb-0">
            Hệ thống lặp lại ngắt quãng SRS 6 cấp độ (Level 0 → Level 5) đồng bộ 100% với PostgreSQL và Trang Tổng quan.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary d-flex align-items-center gap-2 fw-semibold"
            onClick={() => setShowSrsOverview(true)}
          >
            <Play size={16} />
            <span>Ôn tập tất cả thẻ đến hạn ({srsStats?.dueTodayCards ?? 0})</span>
          </button>
          <button className="btn btn-sky d-flex align-items-center gap-2" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Tạo bộ thẻ mới</span>
          </button>
        </div>
      </div>

      {/* Synchronized 3-Metric SRS Summary Bar */}
      {srsStats && (
        <div className="row g-3 text-center">
          <div className="col-12 col-md-4">
            <div className="card pq-card p-3.5 border h-100">
              <div className="small text-muted fw-semibold mb-1">Tổng số thẻ</div>
              <div className="fs-3 fw-bold text-dark">{srsStats.totalSrsCards ?? 0}</div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card pq-card p-3.5 border border-success border-opacity-25 bg-success bg-opacity-10 h-100">
              <div className="small text-success fw-semibold mb-1">Đã nhớ (Level 5)</div>
              <div className="fs-3 fw-bold text-success">{srsStats.rememberedCards ?? 0}</div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="card pq-card p-3.5 border border-primary border-opacity-25 bg-primary bg-opacity-10 h-100">
              <div className="small text-primary fw-semibold mb-1">Đến hạn hôm nay</div>
              <div className="fs-3 fw-bold text-primary">{srsStats.dueTodayCards ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs border-bottom">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 py-2 border-0 ${
              activeTab === 'my' ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'
            }`}
            onClick={() => setActiveTab('my')}
          >
            Bộ thẻ của tôi ({myDecks.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 py-2 border-0 ${
              activeTab === 'system' ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'
            }`}
            onClick={() => setActiveTab('system')}
          >
            Bộ thẻ mẫu hệ thống ({systemDecks.length})
          </button>
        </li>
      </ul>

      {/* Deck Grid */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted small mt-2">Đang tải danh sách bộ thẻ...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="card pq-card text-center py-5 text-muted">
          <Layers size={48} className="opacity-50 mb-2 mx-auto" />
          <h6 className="fw-bold text-dark">Chưa có bộ thẻ nào trong mục này</h6>
          <p className="small mb-3">
            {activeTab === 'my'
              ? 'Hãy tạo bộ thẻ mới hoặc sao chép từ kho Bộ thẻ mẫu hệ thống để bắt đầu học ngay!'
              : 'Hiện chưa có bộ thẻ mẫu nào.'}
          </p>
          {activeTab === 'my' && (
            <div className="d-flex justify-content-center gap-2">
              <button className="btn btn-sky btn-sm" onClick={handleOpenCreate}>
                Tạo bộ thẻ mới
              </button>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setActiveTab('system')}>
                Xem {systemDecks.length} bộ thẻ mẫu
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="row g-4">
          {currentList.map((deck) => {
            const deckName = deck.name || deck.title;
            const totalCards = deck.totalCards ?? deck.cardCount ?? 0;
            const dueCards = deck.dueCards ?? deck.dueCount ?? 0;
            const level0Count = deck.level0Count ?? 0;
            const learningCount = deck.learningCount ?? 0;
            const masteredCount = deck.masteredCount ?? 0;
            const progressPct = deck.progressPercentage ?? (totalCards > 0 ? Math.round((masteredCount * 100) / totalCards) : 0);
            const isCompleted = totalCards > 0 && masteredCount === totalCards;

            return (
              <div key={deck.id} className="col-12 col-md-6 col-lg-4">
                <div className="card pq-card p-4 h-100 d-flex flex-column justify-content-between gap-3">
                  <div>
                    {deck.coverImageUrl && (
                      <div className="mb-3 rounded-3 overflow-hidden border" style={{ height: '130px' }}>
                        <img
                          src={deck.coverImageUrl}
                          alt={deckName}
                          className="w-100 h-100"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    )}
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className={`badge badge-jlpt-${(deck.jlptLevel || 'n5').toLowerCase()} px-2 py-1`}>
                          {deck.jlptLevel || 'N5'}
                        </span>
                        {deck.topicNameVi && (
                          <span className="badge bg-light text-secondary border px-2 py-1">
                            {deck.topicNameVi}
                          </span>
                        )}
                        {isCompleted && (
                          <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                            ✓ Đã thuộc hết
                          </span>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-1 flex-shrink-0">
                        {deck.isSystem && (
                          <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1">Mẫu chuẩn</span>
                        )}
                        {activeTab === 'my' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-light btn-sm p-1 text-secondary border"
                              onClick={() => handleOpenEdit(deck)}
                              title="Sửa thông tin bộ thẻ"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-light btn-sm p-1 text-danger border"
                              onClick={() => handleDeleteDeck(deck.id)}
                              title="Xóa bộ thẻ"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <h5 className="fw-bold mb-2 text-dark">
                      <Link to={`/app/decks/${deck.id}`} className="text-dark text-decoration-none">
                        {deckName}
                      </Link>
                    </h5>
                    <p className="text-muted small mb-3" style={{ minHeight: '36px', lineHeight: 1.5 }}>
                      {deck.description || 'Không có mô tả chi tiết.'}
                    </p>

                    {/* Real SRS Breakdown Pills */}
                    <div className="d-flex flex-wrap gap-1.5 text-muted small mb-3">
                      <span className="badge bg-light text-dark border px-2 py-1">
                        <strong>{totalCards}</strong> thẻ
                      </span>
                      {activeTab === 'my' && (
                        <>
                          <span className="badge bg-light text-secondary border px-2 py-1">
                            Mới: <strong>{level0Count}</strong>
                          </span>
                          <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 px-2 py-1">
                            Đang học: <strong>{learningCount}</strong>
                          </span>
                          <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                            Đã thuộc: <strong>{masteredCount}</strong>
                          </span>
                          {dueCards > 0 && (
                            <span className="badge bg-danger text-white px-2 py-1">
                              Đến hạn: <strong>{dueCards}</strong>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {activeTab === 'my' && totalCards > 0 && (
                      <div>
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>Tiến độ ghi nhớ (Level 5)</span>
                          <span className="fw-bold text-success">{progressPct}%</span>
                        </div>
                        <div className="progress" style={{ height: '6px', borderRadius: '999px' }}>
                          <div
                            className="progress-bar bg-success"
                            style={{ width: `${progressPct}%`, transition: 'width 0.3s ease' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="d-flex flex-wrap gap-2 border-top pt-3">
                    <Link
                      to={`/app/decks/${deck.id}/study?mode=due&includeNew=${dueCards === 0 && level0Count > 0 ? 'true' : 'false'}`}
                      className="btn btn-sky btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                    >
                      <Play size={14} />
                      <span>{dueCards > 0 ? `Ôn đến hạn (${dueCards})` : level0Count > 0 ? `Học mới (${level0Count})` : 'Học SRS'}</span>
                    </Link>

                    {totalCards > 0 && (
                      <Link
                        to={`/app/decks/${deck.id}/study?mode=relearn`}
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                        title="Học lại toàn bộ bộ thẻ (kể cả thẻ Level 5) và cho phép ghi đè cấp độ"
                      >
                        <RotateCcw size={14} />
                        <span>Học lại bộ thẻ</span>
                      </Link>
                    )}

                    <Link
                      to={`/app/decks/${deck.id}/quiz`}
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      title="Làm Quiz kiểm tra"
                    >
                      <HelpCircle size={14} />
                      <span>Quiz</span>
                    </Link>

                    {activeTab === 'system' && (
                      <button
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center gap-1"
                        onClick={() => handleCloneDeck(deck.id)}
                        title="Sao chép về bộ thẻ của tôi để tùy chỉnh"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SRS Overview Modal */}
      <SrsOverviewModal
        show={showSrsOverview}
        onClose={() => setShowSrsOverview(false)}
        onStatsChanged={fetchDecks}
      />

      {/* Create / Edit Deck Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  {editingDeck ? 'Chỉnh sửa bộ thẻ' : 'Tạo bộ thẻ mới'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveDeck}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Tên bộ thẻ *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: Từ vựng Minna no Nihongo Bài 1-5"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Mô tả</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="Ghi chú thêm về bộ thẻ..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Cấp độ JLPT</label>
                    <select
                      className="form-select"
                      value={formData.jlptLevel}
                      onChange={(e) => setFormData({ ...formData, jlptLevel: e.target.value })}
                    >
                      <option value="N5">N5 - Nhập môn & Cơ bản</option>
                      <option value="N4">N4 - Sơ cấp</option>
                      <option value="N3">N3 - Trung cấp</option>
                      <option value="N2">N2 - Trung cao</option>
                      <option value="N1">N1 - Cao cấp</option>
                    </select>
                  </div>

                  <div className="form-check form-switch mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="isPublicSwitch"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    />
                    <label className="form-check-label small" htmlFor="isPublicSwitch">
                      Chia sẻ công khai cho học viên khác
                    </label>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-sky">
                    {editingDeck ? 'Lưu thay đổi' : 'Tạo bộ thẻ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Decks;
