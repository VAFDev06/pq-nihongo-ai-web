import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  FileEdit,
  Archive,
  ArrowUp,
  ArrowDown,
  Layers,
  RefreshCw,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';

const STATUS_META = {
  PUBLISHED: {
    label: 'Đã xuất bản',
    badgeClass: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25',
  },
  DRAFT: {
    label: 'Bản nháp',
    badgeClass: 'bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25',
  },
  ARCHIVED: {
    label: 'Đã lưu trữ',
    badgeClass: 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25',
  },
};

export const AdminDecks = () => {
  const [decks, setDecks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  // Add / Edit Deck Modal
  const [showModal, setShowModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    jlptLevel: 'N5',
    topicId: '',
    coverImageUrl: '',
    status: 'DRAFT',
  });

  // View / Manage Cards inside System Deck Modal
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [deckCards, setDeckCards] = useState([]);
  const [editingCardId, setEditingCardId] = useState(null);
  const [cardForm, setCardForm] = useState({
    front: '',
    reading: '',
    back: '',
    hanViet: '',
    partOfSpeech: '',
    exampleJa: '',
    exampleVi: '',
  });

  // Excel / CSV Import State (Admin System Deck Import)
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importingPreview, setImportingPreview] = useState(false);
  const [committingImport, setCommittingImport] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState('SKIP');
  const [importError, setImportError] = useState('');

  const fetchDecks = async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'ALL' ? '/admin/decks' : `/admin/decks?status=${statusFilter}`;
      const res = await axiosClient.get(url);
      if (res.success && Array.isArray(res.data)) {
        setDecks(res.data);
      }
    } catch (err) {
      setBanner({ type: 'danger', text: err.response?.data?.message || 'Không thể tải danh sách bộ thẻ mẫu hệ thống.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, [statusFilter]);

  useEffect(() => {
    axiosClient
      .get('/admin/topics')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setTopics(res.data.filter((t) => t.status !== 'INACTIVE' && t.isActive !== false));
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenAddModal = () => {
    setEditingDeck(null);
    setFormData({
      name: '',
      description: '',
      jlptLevel: 'N5',
      topicId: '',
      coverImageUrl: '',
      status: 'DRAFT',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (deck) => {
    setEditingDeck(deck);
    setFormData({
      name: deck.name || deck.title || '',
      description: deck.description || '',
      jlptLevel: deck.jlptLevel || 'N5',
      topicId: deck.topicId || '',
      coverImageUrl: deck.coverImageUrl || '',
      status: deck.status || (deck.isPublic ? 'PUBLISHED' : 'DRAFT'),
    });
    setShowModal(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name.trim(),
      title: formData.name.trim(),
      description: formData.description.trim(),
      jlptLevel: formData.jlptLevel,
      topicId: formData.topicId ? Number(formData.topicId) : null,
      coverImageUrl: formData.coverImageUrl.trim() || null,
      status: formData.status,
      isPublic: formData.status === 'PUBLISHED',
    };
    try {
      if (editingDeck) {
        const res = await axiosClient.put(`/admin/decks/${editingDeck.id}`, payload);
        if (res.success) {
          setShowModal(false);
          setBanner({ type: 'success', text: res.message || 'Cập nhật bộ thẻ mẫu thành công.' });
          fetchDecks();
        }
      } else {
        const res = await axiosClient.post('/admin/decks', payload);
        if (res.success) {
          setShowModal(false);
          setBanner({ type: 'success', text: res.message || 'Đã tạo bộ thẻ mẫu mới.' });
          fetchDecks();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu bộ thẻ thất bại.');
    }
  };

  const handleChangeStatus = async (deck, nextStatus) => {
    try {
      const res = await axiosClient.patch(`/admin/decks/${deck.id}/status`, { status: nextStatus });
      if (res.success) {
        setBanner({ type: 'success', text: res.message || 'Đã cập nhật trạng thái bộ thẻ.' });
        fetchDecks();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Thay đổi trạng thái thất bại.');
    }
  };

  const handleDelete = async (deck) => {
    if (!window.confirm(`Bạn có chắc muốn xóa/lưu trữ bộ thẻ "${deck.name}"? Dữ liệu học SRS của học viên sẽ được bảo toàn.`)) {
      return;
    }
    try {
      const res = await axiosClient.delete(`/admin/decks/${deck.id}`);
      if (res.success) {
        setBanner({ type: 'info', text: res.message || 'Đã xóa bộ thẻ mẫu.' });
        fetchDecks();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Xóa bộ thẻ thất bại.');
    }
  };

  const handleOpenCardsModal = async (deck, openImport = false) => {
    setSelectedDeck(deck);
    setEditingCardId(null);
    setCardForm({ front: '', reading: '', back: '', hanViet: '', partOfSpeech: '', exampleJa: '', exampleVi: '' });
    setShowImportPanel(openImport);
    setImportPreview(null);
    setImportError('');
    try {
      const res = await axiosClient.get(`/admin/decks/${deck.id}/cards`);
      if (res.success) setDeckCards(res.data || []);
    } catch (err) {
      setDeckCards([]);
    }
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!selectedDeck) return;
    try {
      if (editingCardId) {
        const res = await axiosClient.put(`/admin/decks/${selectedDeck.id}/cards/${editingCardId}`, cardForm);
        if (res.success && res.data) {
          setDeckCards((prev) => prev.map((c) => (c.id === editingCardId ? res.data : c)));
          setEditingCardId(null);
          setCardForm({ front: '', reading: '', back: '', hanViet: '', partOfSpeech: '', exampleJa: '', exampleVi: '' });
          fetchDecks();
        }
      } else {
        const res = await axiosClient.post(`/admin/decks/${selectedDeck.id}/cards`, cardForm);
        if (res.success && res.data) {
          setDeckCards((prev) => [...prev, res.data]);
          setCardForm({ front: '', reading: '', back: '', hanViet: '', partOfSpeech: '', exampleJa: '', exampleVi: '' });
          fetchDecks();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu thẻ thất bại.');
    }
  };

  const handleStartEditCard = (card) => {
    setShowImportPanel(false);
    setEditingCardId(card.id);
    setCardForm({
      front: card.front || '',
      reading: card.reading || '',
      back: card.back || '',
      hanViet: card.hanViet || '',
      partOfSpeech: card.partOfSpeech || '',
      exampleJa: card.exampleJa || '',
      exampleVi: card.exampleVi || '',
    });
  };

  const handleMoveCard = async (index, direction) => {
    if (!selectedDeck) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= deckCards.length) return;
    const nextList = [...deckCards];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIdx, 0, moved);
    setDeckCards(nextList);

    try {
      await axiosClient.patch(`/admin/decks/${selectedDeck.id}/cards/reorder`, {
        cardIds: nextList.map((c) => c.id),
      });
    } catch (err) {
      alert('Sắp xếp lại thứ tự thẻ thất bại.');
    }
  };

  const handleDeleteCardFromSystemDeck = async (cardId) => {
    if (!selectedDeck || !window.confirm('Xóa thẻ này khỏi bộ mẫu hệ thống?')) return;
    try {
      const res = await axiosClient.delete(`/admin/decks/${selectedDeck.id}/cards/${cardId}`);
      if (res.success) {
        setDeckCards((prev) => prev.filter((c) => c.id !== cardId));
        fetchDecks();
      }
    } catch (err) {
      alert('Xóa thẻ thất bại.');
    }
  };

  // Excel / CSV Import Handlers for System Deck
  const handleDownloadTemplate = (type) => {
    const baseUrl = axiosClient.defaults.baseURL || 'http://localhost:8080/api/v1';
    window.open(`${baseUrl}/templates/flashcard.${type}`, '_blank');
  };

  const handleUploadPreviewFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDeck) return;
    setImportingPreview(true);
    setImportError('');
    setImportPreview(null);

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axiosClient.post(`/admin/decks/${selectedDeck.id}/import/preview`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success && res.data) {
        setImportPreview(res.data);
      }
    } catch (err) {
      setImportError(err.response?.data?.message || 'Không thể đọc tệp Excel/CSV. Vui lòng kiểm tra định dạng theo file mẫu.');
    } finally {
      setImportingPreview(false);
      e.target.value = '';
    }
  };

  const handleCommitImport = async () => {
    if (!selectedDeck || !importPreview?.jobId) return;
    setCommittingImport(true);
    setImportError('');
    try {
      const res = await axiosClient.post(`/admin/decks/${selectedDeck.id}/import/commit`, {
        jobId: importPreview.jobId,
        onDuplicate: duplicateStrategy,
      });
      if (res.success) {
        const cardsRes = await axiosClient.get(`/admin/decks/${selectedDeck.id}/cards`);
        if (cardsRes.success) setDeckCards(cardsRes.data || []);
        setBanner({ type: 'success', text: res.message || 'Đã import thẻ vào bộ mẫu thành công!' });
        setImportPreview(null);
        setShowImportPanel(false);
        fetchDecks();
      }
    } catch (err) {
      setImportError(err.response?.data?.message || 'Lưu dữ liệu import thất bại.');
    } finally {
      setCommittingImport(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h3 className="fw-bold mb-1 text-dark">Quản lý Bộ thẻ mẫu hệ thống</h3>
          <p className="text-muted small mb-0">
            Tạo bộ thẻ mẫu theo Chủ đề, import hàng loạt thẻ từ Excel/CSV và kiểm soát trạng thái xuất bản (Draft / Published / Archived).
          </p>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={fetchDecks}>
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
          <button className="btn btn-primary d-flex align-items-center gap-2 fw-semibold" onClick={handleOpenAddModal}>
            <Plus size={18} />
            <span>Tạo bộ thẻ mẫu</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className={`alert alert-${banner.type} d-flex justify-content-between align-items-center py-2 px-3 small rounded-3 mb-0`}>
          <span>{banner.text}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setBanner(null)}></button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="d-flex flex-wrap gap-2">
        {[
          { key: 'ALL', label: 'Tất cả bộ mẫu' },
          { key: 'PUBLISHED', label: 'Đã xuất bản (Published)' },
          { key: 'DRAFT', label: 'Bản nháp (Draft)' },
          { key: 'ARCHIVED', label: 'Đã lưu trữ (Archived)' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold ${
              statusFilter === tab.key ? 'btn-primary shadow-xs' : 'btn-light border text-secondary'
            }`}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* System Decks Table */}
      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>Tên bộ thẻ & Mô tả</th>
                <th>Chủ đề</th>
                <th>Cấp độ</th>
                <th>Số thẻ</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th className="text-end" style={{ width: '270px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Đang tải danh sách bộ thẻ mẫu...
                  </td>
                </tr>
              ) : decks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <Layers size={40} className="opacity-50 mb-2 mx-auto" />
                    <div className="fw-semibold text-dark">Chưa có bộ thẻ mẫu nào ở trạng thái này.</div>
                  </td>
                </tr>
              ) : (
                decks.map((deck, idx) => {
                  const st = deck.status || (deck.isPublic ? 'PUBLISHED' : 'DRAFT');
                  const stMeta = STATUS_META[st] || STATUS_META.DRAFT;
                  return (
                    <tr key={deck.id}>
                      <td className="text-muted small">{idx + 1}</td>
                      <td>
                        <div className="fw-bold text-dark">{deck.name || deck.title}</div>
                        <div className="text-muted small">{deck.description || 'Không có mô tả'}</div>
                      </td>
                      <td className="small text-secondary">{deck.topicNameVi || 'Chưa gắn chủ đề'}</td>
                      <td>
                        <span className={`badge badge-jlpt-${(deck.jlptLevel || 'n5').toLowerCase()} px-2 py-1`}>
                          {deck.jlptLevel || 'N5'}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border px-2 py-1">
                          {deck.totalCards ?? deck.cardCount ?? 0} thẻ
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill px-2 py-1 ${stMeta.badgeClass}`}>
                          {stMeta.label}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {deck.updatedAt ? new Date(deck.updatedAt).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end flex-wrap gap-1">
                          <button
                            type="button"
                            className="btn btn-outline-success btn-sm"
                            onClick={() => handleOpenCardsModal(deck, true)}
                            title="Import Excel / CSV vào bộ thẻ"
                          >
                            <FileSpreadsheet size={15} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-light btn-sm border text-primary"
                            onClick={() => handleOpenCardsModal(deck, false)}
                            title="Quản lý thẻ & sắp xếp thứ tự"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-light btn-sm border text-dark"
                            onClick={() => handleOpenEditModal(deck)}
                            title="Chỉnh sửa thông tin bộ thẻ"
                          >
                            <Edit size={15} />
                          </button>

                          {st !== 'PUBLISHED' && (
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm"
                              onClick={() => handleChangeStatus(deck, 'PUBLISHED')}
                              title="Xuất bản (hiển thị cho USER)"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}

                          {st === 'PUBLISHED' && (
                            <button
                              type="button"
                              className="btn btn-outline-warning btn-sm"
                              onClick={() => handleChangeStatus(deck, 'DRAFT')}
                              title="Chuyển về Bản nháp"
                            >
                              <FileEdit size={15} />
                            </button>
                          )}

                          {st !== 'ARCHIVED' && (
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => handleChangeStatus(deck, 'ARCHIVED')}
                              title="Lưu trữ (Archived)"
                            >
                              <Archive size={15} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-light btn-sm border text-danger"
                            onClick={() => handleDelete(deck)}
                            title="Xóa / Lưu trữ an toàn"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit System Deck Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  {editingDeck ? 'Chỉnh sửa bộ thẻ mẫu hệ thống' : 'Tạo bộ thẻ mẫu hệ thống mới'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveModal}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Tên bộ thẻ *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: Từ vựng JLPT N4 — Giao tiếp văn phòng"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Mô tả chi tiết</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Mô tả mục tiêu và nội dung của bộ thẻ..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Cấp độ JLPT</label>
                      <select
                        className="form-select"
                        value={formData.jlptLevel}
                        onChange={(e) => setFormData({ ...formData, jlptLevel: e.target.value })}
                      >
                        <option value="N5">JLPT N5</option>
                        <option value="N4">JLPT N4</option>
                        <option value="N3">JLPT N3</option>
                        <option value="N2">JLPT N2</option>
                        <option value="N1">JLPT N1</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Chủ đề (từ Quản lý Chủ đề)</label>
                      <select
                        className="form-select"
                        value={formData.topicId}
                        onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
                      >
                        <option value="">-- Không chọn chủ đề --</option>
                        {topics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nameVi} {t.nameJa ? `(${t.nameJa})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Trạng thái xuất bản</label>
                      <select
                        className="form-select fw-semibold"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="DRAFT">Bản nháp (Chỉ Admin thấy)</option>
                        <option value="PUBLISHED">Đã xuất bản (USER nhìn thấy)</option>
                        <option value="ARCHIVED">Đã lưu trữ (Ẩn khỏi USER)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold text-secondary">Ảnh đại diện bộ thẻ (URL tùy chọn)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="https://... hoặc /uploads/..."
                      value={formData.coverImageUrl}
                      onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary px-4 fw-semibold">
                    {editingDeck ? 'Lưu cập nhật' : 'Tạo bộ thẻ mẫu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage Cards & Excel/CSV Import Modal */}
      {selectedDeck && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom">
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    Quản lý thẻ trong bộ: {selectedDeck.name} ({deckCards.length} thẻ)
                  </h5>
                  <span className="small text-muted">
                    Thêm thủ công hoặc Import hàng loạt từ file Excel (.xlsx) / CSV — chỉ ghi vào bộ thẻ mẫu, không ảnh hưởng SRS cá nhân
                  </span>
                </div>
                <button type="button" className="btn-close" onClick={() => setSelectedDeck(null)}></button>
              </div>

              <div className="modal-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div className="fw-bold small text-secondary">
                    {showImportPanel
                      ? '📥 Import thẻ từ file Excel / CSV:'
                      : editingCardId
                      ? '✏️ Đang chỉnh sửa thẻ đã chọn:'
                      : '➕ Thêm thẻ thủ công vào bộ mẫu:'}
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm d-flex align-items-center gap-1.5 fw-semibold ${
                      showImportPanel ? 'btn-secondary' : 'btn-success text-white'
                    }`}
                    onClick={() => {
                      setShowImportPanel(!showImportPanel);
                      setImportError('');
                    }}
                  >
                    <FileSpreadsheet size={15} />
                    <span>{showImportPanel ? 'Quay lại nhập thủ công' : 'Import Excel / CSV'}</span>
                  </button>
                </div>

                {showImportPanel ? (
                  <div className="p-3.5 bg-light rounded-4 border mb-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                      <div className="small text-muted">
                        Cột hỗ trợ: <strong>Kanji, Từ loại, Nghĩa tiếng Việt, Hiragana, Hán Việt, Ví dụ tiếng Nhật, Hiragana ví dụ, Dịch ví dụ</strong>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                          onClick={() => handleDownloadTemplate('xlsx')}
                        >
                          <Download size={14} />
                          <span>Tải mẫu Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                          onClick={() => handleDownloadTemplate('csv')}
                        >
                          <Download size={14} />
                          <span>Tải mẫu CSV</span>
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2 fw-semibold" style={{ cursor: 'pointer' }}>
                        <Upload size={15} />
                        <span>{importingPreview ? 'Đang phân tích file...' : 'Chọn file .xlsx / .xls / .csv để xem trước'}</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="d-none"
                          onChange={handleUploadPreviewFile}
                          disabled={importingPreview}
                        />
                      </label>
                    </div>

                    {importError && (
                      <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                        <AlertCircle size={16} />
                        <span>{importError}</span>
                      </div>
                    )}

                    {importPreview && (
                      <div className="bg-white rounded-3 border p-3">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                          <div className="d-flex flex-wrap gap-2 small">
                            <span className="badge bg-light text-dark border px-2 py-1">
                              File: <strong>{importPreview.fileName}</strong>
                            </span>
                            <span className="badge bg-light text-dark border px-2 py-1">
                              Tổng: <strong>{importPreview.totalRows}</strong>
                            </span>
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                              Hợp lệ: <strong>{importPreview.validRows}</strong>
                            </span>
                            <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 px-2 py-1">
                              Trùng: <strong>{importPreview.duplicateRows}</strong>
                            </span>
                            <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1">
                              Lỗi: <strong>{importPreview.errorRows}</strong>
                            </span>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select form-select-sm"
                              style={{ width: 'auto' }}
                              value={duplicateStrategy}
                              onChange={(e) => setDuplicateStrategy(e.target.value)}
                            >
                              <option value="SKIP">Nếu trùng: Bỏ qua</option>
                              <option value="UPDATE">Nếu trùng: Cập nhật thẻ cũ</option>
                            </select>

                            <button
                              type="button"
                              className="btn btn-success btn-sm fw-bold px-3"
                              disabled={committingImport || importPreview.validRows === 0}
                              onClick={handleCommitImport}
                            >
                              {committingImport ? 'Đang lưu...' : `Xác nhận Import (${importPreview.validRows} thẻ)`}
                            </button>
                          </div>
                        </div>

                        <div className="table-responsive" style={{ maxHeight: '220px' }}>
                          <table className="table table-sm table-bordered mb-0 small">
                            <thead className="table-light">
                              <tr>
                                <th>Dòng</th>
                                <th>Kanji</th>
                                <th>Hiragana</th>
                                <th>Nghĩa tiếng Việt</th>
                                <th>Hán Việt</th>
                                <th>Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(importPreview.previewRows || []).map((r, i) => (
                                <tr key={i} className={!r.valid ? 'table-danger' : r.duplicate ? 'table-warning' : ''}>
                                  <td>{r.rowNumber}</td>
                                  <td className="font-jp fw-bold">{r.word}</td>
                                  <td className="font-jp">{r.reading}</td>
                                  <td>{r.meaningVi}</td>
                                  <td>{r.hanViet}</td>
                                  <td>
                                    {!r.valid ? (
                                      <span className="text-danger fw-semibold">{r.errorMessage}</span>
                                    ) : r.duplicate ? (
                                      <span className="text-warning-emphasis fw-semibold">Đã tồn tại</span>
                                    ) : (
                                      <span className="text-success fw-semibold">Hợp lệ</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSaveCard} className="p-3 bg-light rounded-3 border mb-4">
                    <div className="row g-2 mb-2">
                      <div className="col-12 col-md-3">
                        <input
                          type="text"
                          className="form-control form-control-sm font-jp"
                          placeholder="Từ tiếng Nhật (Kanji) *"
                          value={cardForm.front}
                          onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12 col-md-3">
                        <input
                          type="text"
                          className="form-control form-control-sm font-jp"
                          placeholder="Hiragana"
                          value={cardForm.reading}
                          onChange={(e) => setCardForm({ ...cardForm, reading: e.target.value })}
                        />
                      </div>
                      <div className="col-12 col-md-3">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Nghĩa tiếng Việt *"
                          value={cardForm.back}
                          onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6 col-md-2">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Hán Việt"
                          value={cardForm.hanViet}
                          onChange={(e) => setCardForm({ ...cardForm, hanViet: e.target.value })}
                        />
                      </div>
                      <div className="col-6 col-md-1">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Loại"
                          value={cardForm.partOfSpeech}
                          onChange={(e) => setCardForm({ ...cardForm, partOfSpeech: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="row g-2 align-items-center">
                      <div className="col-12 col-md-5">
                        <input
                          type="text"
                          className="form-control form-control-sm font-jp"
                          placeholder="Câu ví dụ tiếng Nhật (tùy chọn)"
                          value={cardForm.exampleJa}
                          onChange={(e) => setCardForm({ ...cardForm, exampleJa: e.target.value })}
                        />
                      </div>
                      <div className="col-12 col-md-5">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Dịch câu ví dụ (tùy chọn)"
                          value={cardForm.exampleVi}
                          onChange={(e) => setCardForm({ ...cardForm, exampleVi: e.target.value })}
                        />
                      </div>
                      <div className="col-12 col-md-2 d-flex gap-1">
                        <button type="submit" className="btn btn-primary btn-sm flex-grow-1 fw-semibold">
                          {editingCardId ? 'Cập nhật' : 'Thêm thẻ'}
                        </button>
                        {editingCardId && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => {
                              setEditingCardId(null);
                              setCardForm({ front: '', reading: '', back: '', hanViet: '', partOfSpeech: '', exampleJa: '', exampleVi: '' });
                            }}
                          >
                            Hủy
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                )}

                {/* Cards Ordered Table */}
                <div className="table-responsive" style={{ maxHeight: '340px' }}>
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '56px' }}>STT</th>
                        <th>Mặt trước (Kanji)</th>
                        <th>Hiragana / Hán Việt</th>
                        <th>Mặt sau & Ví dụ</th>
                        <th className="text-end" style={{ width: '170px' }}>Thứ tự & Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deckCards.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4 text-muted">
                            Chưa có thẻ nào trong bộ này. Hãy thêm thủ công hoặc Import Excel/CSV ở trên.
                          </td>
                        </tr>
                      ) : (
                        deckCards.map((c, i) => (
                          <tr key={c.id}>
                            <td className="text-muted small">{i + 1}</td>
                            <td>
                              <div className="d-flex align-items-center gap-1.5">
                                <span className="font-jp fw-bold text-dark fs-6">{c.front}</span>
                                <AudioButton text={c.front} size="sm" />
                              </div>
                            </td>
                            <td>
                              <div className="font-jp small text-primary">{c.reading || '-'}</div>
                              {c.hanViet && (
                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                  {c.hanViet.toUpperCase()}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="fw-semibold text-dark">{c.back}</div>
                              {c.exampleJa && <div className="small font-jp text-muted">{c.exampleJa}</div>}
                              {c.exampleVi && <div className="small text-muted fst-italic">{c.exampleVi}</div>}
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex gap-1">
                                <button
                                  type="button"
                                  className="btn btn-light btn-sm border p-1"
                                  disabled={i === 0}
                                  onClick={() => handleMoveCard(i, -1)}
                                  title="Lên"
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-light btn-sm border p-1"
                                  disabled={i === deckCards.length - 1}
                                  onClick={() => handleMoveCard(i, 1)}
                                  title="Xuống"
                                >
                                  <ArrowDown size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-light btn-sm border p-1 text-primary"
                                  onClick={() => handleStartEditCard(c)}
                                  title="Sửa thẻ"
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-light btn-sm border p-1 text-danger"
                                  onClick={() => handleDeleteCardFromSystemDeck(c.id)}
                                  title="Xóa thẻ"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer border-top">
                <button type="button" className="btn btn-primary" onClick={() => setSelectedDeck(null)}>
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

export default AdminDecks;
