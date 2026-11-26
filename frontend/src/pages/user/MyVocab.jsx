import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import FuriganaText from '../../components/common/FuriganaText';
import {
  BookMarked,
  Plus,
  Search,
  Trash2,
  Edit,
  Layers,
  CheckSquare,
  Square,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';

const PAGE_SIZE = 15;

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFC')
    .trim();
}

export const MyVocab = () => {
  // Toàn bộ danh sách từ vựng cá nhân tải từ PostgreSQL (lọc tức thì ở Frontend)
  const [allVocabs, setAllVocabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(0);

  // Selection for Bulk Add to SRS
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [myDecks, setMyDecks] = useState([]);
  const [targetDeckId, setTargetDeckId] = useState('');
  const [addingToSrs, setAddingToSrs] = useState(false);
  const [srsBanner, setSrsBanner] = useState(null);

  // Add/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    japaneseText: '',
    reading: '',
    romaji: '',
    partOfSpeech: '',
    hanViet: '',
    jlptLevel: 'N5',
    vietnameseMeaning: '',
    exampleSentence: '',
    exampleMeaning: '',
    exampleReading: '',
    note: '',
  });

  const fetchAllMyVocab = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/vocab/my', {
        params: { page: 0, size: 1000 },
      });
      if (res.success && res.data) {
        const items = Array.isArray(res.data) ? res.data : res.data.content || [];
        setAllVocabs(items);
      }
    } catch (err) {
      console.error('Fetch personal vocab failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMyVocab();

    axiosClient
      .get('/decks?scope=mine')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setMyDecks(res.data);
        }
      })
      .catch(() => {});
  }, []);

  /**
   * Tìm kiếm tức thì ở Frontend:
   * - CHỈ khớp theo: Từ tiếng Nhật (Kanji/Kana: word), Hiragana (reading), Nghĩa tiếng Việt (meaningVi).
   * - TUYỆT ĐỐI KHÔNG tìm theo Hán Việt (hanViet).
   * - Không spam API backend khi đang gõ.
   */
  const filteredVocabs = useMemo(() => {
    const q = normalizeText(search);
    return allVocabs.filter((item) => {
      if (sourceFilter && item.source !== sourceFilter) return false;
      if (!q) return true;
      const kanji = normalizeText(item.word || item.japaneseText);
      const reading = normalizeText(item.reading);
      const meaning = normalizeText(item.meaningVi || item.vietnameseMeaning);
      return kanji.includes(q) || reading.includes(q) || meaning.includes(q);
    });
  }, [allVocabs, search, sourceFilter]);

  const totalElements = filteredVocabs.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedVocabs = filteredVocabs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, sourceFilter]);

  // Selection handlers for SRS
  const toggleRowSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCurrentPageAllSelected =
    paginatedVocabs.length > 0 && paginatedVocabs.every((v) => selectedIds.has(v.id));

  const isAllFilteredSelected =
    filteredVocabs.length > 0 && filteredVocabs.every((v) => selectedIds.has(v.id));

  const toggleSelectCurrentPage = () => {
    if (isCurrentPageAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedVocabs.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedVocabs.forEach((v) => next.add(v.id));
        return next;
      });
    }
  };

  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVocabs.map((v) => v.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;

  const handleBulkAddToSrs = async () => {
    if (selectedCount === 0) return;
    setAddingToSrs(true);
    setSrsBanner(null);

    try {
      const payload = {
        selectAll: false,
        vocabIds: Array.from(selectedIds),
        deckId: targetDeckId ? Number(targetDeckId) : null,
      };
      const res = await axiosClient.post('/vocab/my/add-to-srs', payload);
      if (res.success && res.data) {
        const { addedCount, existingCount, deckId, deckName } = res.data;
        setSrsBanner({
          type: 'success',
          deckId,
          deckName,
          message:
            existingCount > 0
              ? `Đã thêm ${addedCount} từ mới vào bộ thẻ SRS "${deckName}" (${existingCount} từ đã tồn tại trong SRS, được giữ nguyên tiến độ).`
              : `Đã thêm thành công ${addedCount} từ vào bộ thẻ SRS "${deckName}"!`,
        });
        handleClearSelection();
      }
    } catch (err) {
      setSrsBanner({
        type: 'danger',
        message: err.response?.data?.message || 'Thêm từ vựng vào SRS thất bại.',
      });
    } finally {
      setAddingToSrs(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa từ này khỏi sổ từ vựng cá nhân?')) return;
    try {
      const res = await axiosClient.delete(`/vocab/my/${id}`);
      if (res.success) {
        setAllVocabs((prev) => prev.filter((v) => v.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch (err) {
      alert('Xóa từ vựng thất bại.');
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      japaneseText: '',
      reading: '',
      romaji: '',
      partOfSpeech: '',
      hanViet: '',
      jlptLevel: 'N5',
      vietnameseMeaning: '',
      exampleSentence: '',
      exampleMeaning: '',
      exampleReading: '',
      note: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      japaneseText: item.word || item.japaneseText || '',
      reading: item.reading || '',
      romaji: item.romaji || '',
      partOfSpeech: item.partOfSpeech || '',
      hanViet: item.hanViet || '',
      jlptLevel: item.jlptLevel || 'N5',
      vietnameseMeaning: item.meaningVi || item.vietnameseMeaning || '',
      exampleSentence: item.exampleJa || item.exampleSentence || '',
      exampleMeaning: item.exampleVi || item.exampleMeaning || '',
      exampleReading: item.exampleReading || '',
      note: item.note || '',
    });
    setShowModal(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const payload = {
      word: formData.japaneseText.trim(),
      japaneseText: formData.japaneseText.trim(),
      reading: formData.reading.trim() || null,
      romaji: formData.romaji.trim() || null,
      partOfSpeech: formData.partOfSpeech.trim() || null,
      hanViet: formData.hanViet.trim() || null,
      jlptLevel: formData.jlptLevel || 'N5',
      meaningVi: formData.vietnameseMeaning.trim(),
      vietnameseMeaning: formData.vietnameseMeaning.trim(),
      exampleJa: formData.exampleSentence.trim() || null,
      exampleSentence: formData.exampleSentence.trim() || null,
      exampleVi: formData.exampleMeaning.trim() || null,
      exampleMeaning: formData.exampleMeaning.trim() || null,
      exampleReading: formData.exampleReading.trim() || null,
      note: formData.note.trim() || null,
      source: 'MANUAL',
    };

    try {
      if (editingItem) {
        const res = await axiosClient.put(`/vocab/my/${editingItem.id}`, payload);
        if (res.success) {
          setShowModal(false);
          fetchAllMyVocab();
        }
      } else {
        const res = await axiosClient.post('/vocab/my', payload);
        if (res.success) {
          setShowModal(false);
          fetchAllMyVocab();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu từ vựng thất bại.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Title & Action */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h3 className="fw-bold mb-1">Sổ từ vựng cá nhân ({allVocabs.length} từ)</h3>
          <p className="text-muted small mb-0">
            Quản lý toàn bộ từ vựng cá nhân, tìm kiếm tức thì theo Kanji, Hiragana hoặc nghĩa tiếng Việt và thêm hàng loạt vào SRS 6 cấp độ.
          </p>
        </div>

        <button className="btn btn-sky d-flex align-items-center gap-2" onClick={handleOpenAddModal}>
          <Plus size={18} />
          <span>Thêm từ vựng cá nhân</span>
        </button>
      </div>

      {/* SRS Notification Banner */}
      {srsBanner && (
        <div className={`alert alert-${srsBanner.type} d-flex flex-wrap justify-content-between align-items-center gap-2 py-2.5 px-3 small rounded-3 mb-0`}>
          <div className="d-flex align-items-center gap-2">
            <Sparkles size={18} />
            <span>{srsBanner.message}</span>
          </div>
          {srsBanner.deckId && (
            <div className="d-flex gap-2">
              <Link to={`/app/decks/${srsBanner.deckId}`} className="btn btn-sm btn-outline-primary">
                Xem bộ thẻ
              </Link>
              <Link to={`/app/decks/${srsBanner.deckId}/study?mode=due&includeNew=true`} className="btn btn-sm btn-primary fw-semibold">
                Ôn tập SRS ngay →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Instant Client-Side Search & Source Filter (KHÔNG tìm theo Hán Việt, KHÔNG lọc Đang học/Đã thuộc) */}
      <div className="card pq-card p-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-8">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Search size={18} />
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0 ps-1"
                placeholder="Tìm nhanh theo Kanji, Hiragana hoặc nghĩa tiếng Việt..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="btn btn-light border border-start-0 text-muted"
                  onClick={() => setSearch('')}
                  title="Xóa từ khóa"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="col-12 col-md-4">
            <select
              className="form-select bg-light"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                handleClearSelection();
              }}
            >
              <option value="">Tất cả nguồn từ vựng</option>
              <option value="MANUAL">Tự nhập</option>
              <option value="AI_IMAGE">Nhận diện ảnh AI</option>
              <option value="CONVERSATION">Hội thoại AI</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Add to SRS Toolbar */}
      {totalElements > 0 && (
        <div className="card pq-card p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-1.5 fw-semibold ${
                  isAllFilteredSelected ? 'btn-primary' : 'btn-white bg-white border text-dark'
                }`}
                onClick={handleToggleSelectAllFiltered}
              >
                {isAllFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                <span>Chọn tất cả ({totalElements} từ)</span>
              </button>

              {selectedCount > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary bg-white"
                  onClick={handleClearSelection}
                >
                  Bỏ chọn tất cả
                </button>
              )}

              <span className="badge bg-primary px-2.5 py-1.5 fs-6">
                Đã chọn: {selectedCount} từ
              </span>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <select
                className="form-select form-select-sm bg-white"
                style={{ width: 'auto', minWidth: '210px' }}
                value={targetDeckId}
                onChange={(e) => setTargetDeckId(e.target.value)}
              >
                <option value="">Bộ thẻ: Sổ từ vựng SRS của tôi (Mặc định)</option>
                {myDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    Bộ thẻ: {d.name || d.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-primary btn-sm px-3 py-1.5 fw-bold d-flex align-items-center gap-1.5 shadow-xs"
                disabled={addingToSrs || selectedCount === 0}
                onClick={handleBulkAddToSrs}
              >
                {addingToSrs ? (
                  <>
                    <Loader2 size={16} className="spinner-border spinner-border-sm" />
                    <span>Đang thêm vào SRS...</span>
                  </>
                ) : (
                  <>
                    <Layers size={16} />
                    <span>Thêm {selectedCount} từ vào SRS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Vocab Table (ĐÃ BỎ CỘT TRẠNG THÁI ĐANG HỌC / ĐÃ THUỘC) */}
      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '42px' }} className="text-center">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={isCurrentPageAllSelected}
                    onChange={toggleSelectCurrentPage}
                    title="Chọn/Bỏ chọn các từ trên trang hiện tại"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ width: '40px' }}>#</th>
                <th>Từ tiếng Nhật (Kanji)</th>
                <th>Hiragana / Từ loại</th>
                <th>Hán Việt</th>
                <th>Nghĩa tiếng Việt & Ví dụ</th>
                <th className="text-end" style={{ width: '110px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Đang tải sổ từ vựng...
                  </td>
                </tr>
              ) : paginatedVocabs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <BookMarked size={36} className="opacity-50 mb-2" />
                    <div className="fw-semibold text-dark">
                      {search ? `Không tìm thấy từ nào khớp với "${search}"` : 'Chưa có từ vựng nào trong sổ cá nhân.'}
                    </div>
                    <p className="small mb-3">
                      {search
                        ? 'Lưu ý: Tìm kiếm chỉ lọc theo Kanji, Hiragana và Nghĩa tiếng Việt.'
                        : 'Bạn có thể thêm từ mới trực tiếp hoặc quét từ vựng từ hình ảnh AI.'}
                    </p>
                    {!search && (
                      <div className="d-flex justify-content-center gap-2">
                        <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
                          + Thêm từ vựng cá nhân
                        </button>
                        <Link to="/app/recognize" className="btn btn-outline-primary btn-sm">
                          Nhận diện ảnh AI
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedVocabs.map((item, idx) => {
                  const isRowSelected = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className={isRowSelected ? 'table-primary bg-opacity-10' : ''}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isRowSelected}
                          onChange={() => toggleRowSelection(item.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td className="text-muted small">{safePage * PAGE_SIZE + idx + 1}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fs-5 fw-bold font-jp text-dark">
                            <FuriganaText text={`${item.word || item.japaneseText}[${item.reading || ''}]`} />
                          </span>
                          <AudioButton text={item.word || item.japaneseText} />
                        </div>
                      </td>
                      <td>
                        <div className="font-jp small text-dark">{item.reading || '-'}</div>
                        {item.partOfSpeech && (
                          <span className="badge bg-light text-secondary border small mt-0.5">
                            {item.partOfSpeech}
                          </span>
                        )}
                      </td>
                      <td>
                        {item.hanViet ? (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-bold">
                            {item.hanViet.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{item.meaningVi || item.vietnameseMeaning}</div>
                        {(item.exampleJa || item.exampleSentence) && (
                          <div className="small text-muted font-jp mt-1 d-flex align-items-center gap-1">
                            <span>VD: {item.exampleJa || item.exampleSentence}</span>
                            <AudioButton text={item.exampleJa || item.exampleSentence} size="sm" />
                          </div>
                        )}
                        {item.exampleReading && (
                          <div className="small text-muted font-jp">{item.exampleReading}</div>
                        )}
                        {(item.exampleVi || item.exampleMeaning) && (
                          <div className="small text-muted fst-italic">{item.exampleVi || item.exampleMeaning}</div>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button
                            className="btn btn-light btn-sm text-primary"
                            onClick={() => handleOpenEditModal(item)}
                            title="Chỉnh sửa"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn btn-light btn-sm text-danger"
                            onClick={() => handleDelete(item.id)}
                            title="Xóa"
                          >
                            <Trash2 size={16} />
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

        {totalPages > 1 && (
          <div className="p-3 border-top d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Trang {safePage + 1} / {totalPages} (Hiển thị {totalElements} từ)
            </span>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Trước
              </button>
              <button className="btn btn-outline-secondary" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  {editingItem ? 'Chỉnh sửa từ vựng' : 'Thêm từ vựng cá nhân mới'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveModal}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Từ tiếng Nhật (Kanji) *</label>
                      <input
                        type="text"
                        className="form-control font-jp"
                        placeholder="VD: 男性"
                        value={formData.japaneseText}
                        onChange={(e) => setFormData({ ...formData, japaneseText: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Hiragana</label>
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
                        placeholder="VD: NAM TÍNH"
                        value={formData.hanViet}
                        onChange={(e) => setFormData({ ...formData, hanViet: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Nghĩa tiếng Việt *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Nam giới, đàn ông"
                        value={formData.vietnameseMeaning}
                        onChange={(e) => setFormData({ ...formData, vietnameseMeaning: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold text-secondary">Từ loại</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Danh từ, Động từ..."
                        value={formData.partOfSpeech}
                        onChange={(e) => setFormData({ ...formData, partOfSpeech: e.target.value })}
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold text-secondary">JLPT</label>
                      <select
                        className="form-select"
                        value={formData.jlptLevel}
                        onChange={(e) => setFormData({ ...formData, jlptLevel: e.target.value })}
                      >
                        <option value="N5">N5</option>
                        <option value="N4">N4</option>
                        <option value="N3">N3</option>
                        <option value="N2">N2</option>
                        <option value="N1">N1</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold text-secondary">Câu ví dụ tiếng Nhật</label>
                      <input
                        type="text"
                        className="form-control font-jp"
                        placeholder="VD: 理想の男性と結婚する。"
                        value={formData.exampleSentence}
                        onChange={(e) => setFormData({ ...formData, exampleSentence: e.target.value })}
                      />
                    </div>
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
                      <label className="form-label small fw-semibold text-secondary">Dịch nghĩa câu ví dụ</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Kết hôn với người đàn ông lý tưởng."
                        value={formData.exampleMeaning}
                        onChange={(e) => setFormData({ ...formData, exampleMeaning: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold text-secondary">Ghi chú thêm</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ghi chú cách dùng hoặc mẹo nhớ..."
                        value={formData.note}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-sky px-4">
                    {editingItem ? 'Cập nhật từ vựng' : 'Lưu vào sổ'}
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

export default MyVocab;
