import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import FuriganaText from '../../components/common/FuriganaText';
import {
  Layers,
  Plus,
  Play,
  HelpCircle,
  Upload,
  ArrowLeft,
  Trash2,
  Edit,
  BookMarked,
} from 'lucide-react';

export const DeckDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Card Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState({
    front: '',
    reading: '',
    back: '',
    partOfSpeech: '',
    hanViet: '',
    exampleJa: '',
    exampleVi: '',
    exampleReading: '',
    note: '',
  });

  // Add from personal vocab modal
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [myVocabs, setMyVocabs] = useState([]);
  const [selectedVocabIds, setSelectedVocabIds] = useState(new Set());

  const fetchDeckDetails = async () => {
    setLoading(true);
    try {
      const [resDeck, resCards] = await Promise.all([
        axiosClient.get(`/decks/${id}`),
        axiosClient.get(`/decks/${id}/cards`),
      ]);
      if (resDeck.success) setDeck(resDeck.data);
      if (resCards.success) setCards(resCards.data || []);
    } catch (err) {
      console.error('Fetch deck details failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeckDetails();
  }, [id]);

  const handleOpenAddModal = () => {
    setEditingCard(null);
    setFormData({
      front: '',
      reading: '',
      back: '',
      partOfSpeech: '',
      hanViet: '',
      exampleJa: '',
      exampleVi: '',
      exampleReading: '',
      note: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (card) => {
    setEditingCard(card);
    setFormData({
      front: card.front || card.japaneseText || '',
      reading: card.reading || '',
      back: card.back || card.vietnameseMeaning || '',
      partOfSpeech: card.partOfSpeech || '',
      hanViet: card.hanViet || '',
      exampleJa: card.exampleJa || card.exampleSentence || '',
      exampleVi: card.exampleVi || card.exampleMeaning || '',
      exampleReading: card.exampleReading || '',
      note: card.note || card.notes || '',
    });
    setShowModal(true);
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    const payload = {
      front: formData.front.trim(),
      japaneseText: formData.front.trim(),
      reading: formData.reading.trim() || null,
      back: formData.back.trim(),
      vietnameseMeaning: formData.back.trim(),
      partOfSpeech: formData.partOfSpeech.trim() || null,
      hanViet: formData.hanViet.trim() || null,
      exampleJa: formData.exampleJa.trim() || null,
      exampleVi: formData.exampleVi.trim() || null,
      exampleReading: formData.exampleReading.trim() || null,
      note: formData.note.trim() || null,
    };
    try {
      if (editingCard) {
        const res = await axiosClient.put(`/decks/${id}/cards/${editingCard.id}`, payload);
        if (res.success) {
          setShowModal(false);
          fetchDeckDetails();
        }
      } else {
        const res = await axiosClient.post(`/decks/${id}/cards`, payload);
        if (res.success) {
          setShowModal(false);
          fetchDeckDetails();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu thẻ thất bại.');
    }
  };

  const handleOpenVocabPicker = async () => {
    try {
      const res = await axiosClient.get('/vocab/my?size=100');
      if (res.success && res.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.content || []);
        setMyVocabs(items);
        setSelectedVocabIds(new Set());
        setShowVocabModal(true);
      }
    } catch (err) {
      alert('Không thể tải sổ từ vựng.');
    }
  };

  const handleAddSelectedVocabs = async () => {
    if (selectedVocabIds.size === 0) return;
    try {
      const res = await axiosClient.post(`/decks/${id}/cards/from-vocab`, {
        userVocabularyIds: Array.from(selectedVocabIds),
      });
      if (res.success) {
        setShowVocabModal(false);
        fetchDeckDetails();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Thêm thẻ từ sổ từ thất bại.');
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thẻ này?')) return;
    try {
      const res = await axiosClient.delete(`/decks/${id}/cards/${cardId}`);
      if (res.success) {
        fetchDeckDetails();
      }
    } catch (err) {
      alert('Xóa thẻ thất bại.');
    }
  };

  const handleDeleteDeck = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ bộ thẻ này không?')) return;
    try {
      const res = await axiosClient.delete(`/decks/${id}`);
      if (res.success) {
        navigate('/app/decks');
      }
    } catch (err) {
      alert('Xóa bộ thẻ thất bại.');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted small mt-2">Đang tải thông tin bộ thẻ...</p>
      </div>
    );
  }

  const isMine = deck?.isMine;
  const deckName = deck?.name || deck?.title;
  const dueCards = deck?.dueCards ?? deck?.dueCount ?? 0;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Top back & actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div className="d-flex align-items-center gap-2">
          <Link to="/app/decks" className="btn btn-light btn-sm p-2 text-muted">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h3 className="fw-bold mb-0">{deckName}</h3>
              <span className={`badge badge-jlpt-${(deck?.jlptLevel || 'n5').toLowerCase()} px-2 py-1`}>
                {deck?.jlptLevel || 'N5'}
              </span>
            </div>
            <p className="text-muted small mb-0">{deck?.description || 'Không có mô tả.'}</p>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <Link to={`/app/decks/${id}/study`} className="btn btn-sky d-flex align-items-center gap-1">
            <Play size={16} />
            <span>Lật thẻ & Học SRS ({dueCards > 0 ? `${dueCards} thẻ cần ôn` : `${cards.length} thẻ`})</span>
          </Link>
          <Link to={`/app/decks/${id}/quiz`} className="btn btn-outline-primary d-flex align-items-center gap-1">
            <HelpCircle size={16} />
            <span>Làm Quiz</span>
          </Link>
          {isMine && (
            <Link to={`/app/decks/${id}/import`} className="btn btn-outline-secondary d-flex align-items-center gap-1">
              <Upload size={16} />
              <span>Import Excel/CSV</span>
            </Link>
          )}
        </div>
      </div>

      {/* Cards list header & Add button */}
      <div className="card pq-card p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="fw-bold text-dark">
            Danh sách thẻ ghi nhớ ({cards.length} thẻ)
          </div>

          {isMine && (
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1" onClick={handleOpenVocabPicker}>
                <BookMarked size={15} />
                <span>Lấy từ Sổ từ vựng</span>
              </button>
              <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={handleOpenAddModal}>
                <Plus size={16} />
                <span>Thêm thẻ mới</span>
              </button>
              <button className="btn btn-outline-danger btn-sm" onClick={handleDeleteDeck} title="Xóa bộ thẻ">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <Layers size={40} className="opacity-50 mb-2 mx-auto" />
            <div>Chưa có thẻ nào trong bộ này.</div>
            <p className="small mb-2">Thêm thẻ thủ công, chọn từ sổ từ vựng hoặc nhập hàng loạt từ file Excel/CSV.</p>
            {isMine && (
              <button className="btn btn-sky btn-sm" onClick={handleOpenAddModal}>
                Thêm thẻ đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Kanji (Mặt trước)</th>
                  <th>Hiragana / Từ loại</th>
                  <th>Hán Việt</th>
                  <th>Nghĩa tiếng Việt & Ví dụ</th>
                  {isMine && <th className="text-end" style={{ width: '110px' }}>Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {cards.map((card, idx) => {
                  const frontText = card.front || card.japaneseText;
                  const backText = card.back || card.vietnameseMeaning;
                  const exJa = card.exampleJa || card.exampleSentence;
                  return (
                    <tr key={card.id}>
                      <td className="text-muted small">{idx + 1}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fs-5 fw-bold font-jp text-dark">
                            <FuriganaText text={`${frontText}[${card.reading || ''}]`} />
                          </span>
                          <AudioButton text={frontText} />
                        </div>
                      </td>
                      <td>
                        <div className="text-dark small font-jp">{card.reading || '-'}</div>
                        {card.partOfSpeech && (
                          <span className="badge bg-light text-secondary border small">{card.partOfSpeech}</span>
                        )}
                      </td>
                      <td>
                        {card.hanViet ? (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-bold">
                            {card.hanViet.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{backText}</div>
                        {exJa && (
                          <div className="small text-muted font-jp mt-1">
                            VD: {exJa} {card.exampleVi ? `(${card.exampleVi})` : ''}
                          </div>
                        )}
                        {card.exampleReading && (
                          <div className="small text-muted font-jp">{card.exampleReading}</div>
                        )}
                      </td>
                      {isMine && (
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1">
                            <button
                              className="btn btn-light btn-sm text-primary"
                              onClick={() => handleOpenEditModal(card)}
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="btn btn-light btn-sm text-danger"
                              onClick={() => handleDeleteCard(card.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Card Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  {editingCard ? 'Chỉnh sửa thẻ Flashcard' : 'Thêm thẻ Flashcard mới'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveCard}>
                <div className="modal-body">
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Kanji / Từ tiếng Nhật *</label>
                      <input
                        type="text"
                        className="form-control font-jp"
                        placeholder="VD: 男性"
                        value={formData.front}
                        onChange={(e) => setFormData({ ...formData, front: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Hiragana (Cách đọc)</label>
                      <input
                        type="text"
                        className="form-control font-jp"
                        placeholder="VD: だんせい"
                        value={formData.reading}
                        onChange={(e) => setFormData({ ...formData, reading: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Hán Việt</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Nam tính"
                        value={formData.hanViet}
                        onChange={(e) => setFormData({ ...formData, hanViet: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-semibold text-secondary">Nghĩa tiếng Việt *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Nam giới, đàn ông"
                        value={formData.back}
                        onChange={(e) => setFormData({ ...formData, back: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Từ loại</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Danh từ"
                        value={formData.partOfSpeech}
                        onChange={(e) => setFormData({ ...formData, partOfSpeech: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Câu ví dụ (tiếng Nhật)</label>
                    <input
                      type="text"
                      className="form-control font-jp"
                      placeholder="VD: 理想の男性と結婚する。"
                      value={formData.exampleJa}
                      onChange={(e) => setFormData({ ...formData, exampleJa: e.target.value })}
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Hiragana câu ví dụ</label>
                      <input
                        type="text"
                        className="form-control font-jp"
                        placeholder="VD: りそうのだんせいとけっこんする。"
                        value={formData.exampleReading}
                        onChange={(e) => setFormData({ ...formData, exampleReading: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Dịch câu ví dụ</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Kết hôn với người đàn ông lý tưởng."
                        value={formData.exampleVi}
                        onChange={(e) => setFormData({ ...formData, exampleVi: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold text-secondary">Ghi chú thêm</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: Từ vựng N4"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-sky">
                    Lưu thẻ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Pick from Personal Vocab Modal */}
      {showVocabModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Chọn từ từ Sổ từ vựng cá nhân</h5>
                <button type="button" className="btn-close" onClick={() => setShowVocabModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {myVocabs.length === 0 ? (
                  <div className="text-center py-4 text-muted">Sổ từ vựng cá nhân của bạn đang trống.</div>
                ) : (
                  <div className="list-group">
                    {myVocabs.map((uv) => {
                      const checked = selectedVocabIds.has(uv.id);
                      return (
                        <label
                          key={uv.id}
                          className="list-group-item d-flex align-items-center justify-content-between"
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <input
                              type="checkbox"
                              className="form-check-input mt-0"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedVocabIds);
                                if (e.target.checked) next.add(uv.id);
                                else next.delete(uv.id);
                                setSelectedVocabIds(next);
                              }}
                            />
                            <div>
                              <span className="fw-bold font-jp me-2">{uv.word}</span>
                              {uv.reading && <span className="small text-muted font-jp me-2">({uv.reading})</span>}
                              {uv.hanViet && (
                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle small">
                                  {uv.hanViet.toUpperCase()}
                                </span>
                              )}
                              <div className="small text-secondary">{uv.meaningVi}</div>
                            </div>
                          </div>
                          <span className="badge bg-light text-secondary border">{uv.source}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="modal-footer border-top">
                <button type="button" className="btn btn-light" onClick={() => setShowVocabModal(false)}>
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn btn-sky"
                  disabled={selectedVocabIds.size === 0}
                  onClick={handleAddSelectedVocabs}
                >
                  Thêm {selectedVocabIds.size} từ vào bộ thẻ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckDetail;
