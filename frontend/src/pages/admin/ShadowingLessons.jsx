import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import AudioButton from '../../components/common/AudioButton';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  FileEdit,
  Archive,
  FileSpreadsheet,
  Upload,
  Download,
  RefreshCw,
  AlertCircle,
  MessagesSquare,
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

export const AdminShadowingLessons = () => {
  const [lessons, setLessons] = useState([]);
  const [topics, setTopics] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  // Add / Edit Dialogue Lesson Modal
  const [showModal, setShowModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    topicId: '',
    jlptLevel: 'N5',
    status: 'PUBLISHED',
    lines: [
      { lineOrder: 1, speaker: 'A', japaneseText: '', hiraganaText: '', vietnameseTranslation: '' },
      { lineOrder: 2, speaker: 'B', japaneseText: '', hiraganaText: '', vietnameseTranslation: '' },
    ],
  });

  // Excel / CSV Dialogue Import Modal
  const [importLesson, setImportLesson] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMode, setImportMode] = useState('REPLACE');
  const [uploadingImport, setUploadingImport] = useState(false);
  const [committingImport, setCommittingImport] = useState(false);
  const [importError, setImportError] = useState('');

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const params = { size: 100 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await axiosClient.get('/admin/shadowing/lessons', { params });
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data.content || []);
        setLessons(list);
      }
    } catch (err) {
      setBanner({ type: 'danger', text: 'Không thể tải danh sách bài học Shadowing.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
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
    setEditingLesson(null);
    setFormData({
      title: '',
      description: '',
      topicId: topics[0]?.id || '',
      jlptLevel: 'N5',
      status: 'PUBLISHED',
      lines: [
        { lineOrder: 1, speaker: 'A', japaneseText: '', hiraganaText: '', vietnameseTranslation: '' },
        { lineOrder: 2, speaker: 'B', japaneseText: '', hiraganaText: '', vietnameseTranslation: '' },
      ],
    });
    setShowModal(true);
  };

  const handleOpenEditModal = async (lesson) => {
    setEditingLesson(lesson);
    try {
      const res = await axiosClient.get(`/admin/shadowing/lessons/${lesson.id}`);
      const detail = res.success && res.data ? res.data : lesson;
      const loadedLines =
        Array.isArray(detail.lines) && detail.lines.length > 0
          ? detail.lines.map((l, idx) => ({
              lineOrder: l.lineOrder || idx + 1,
              speaker: l.speaker || (idx % 2 === 0 ? 'A' : 'B'),
              japaneseText: l.japaneseText || '',
              hiraganaText: l.hiraganaText || '',
              vietnameseTranslation: l.vietnameseTranslation || '',
            }))
          : [
              {
                lineOrder: 1,
                speaker: 'A',
                japaneseText: detail.textJa || '',
                hiraganaText: '',
                vietnameseTranslation: detail.textVi || '',
              },
            ];

      setFormData({
        title: detail.title || '',
        description: detail.description || '',
        topicId: detail.topicId || '',
        jlptLevel: detail.jlptLevel || 'N5',
        status: detail.status || 'PUBLISHED',
        lines: loadedLines,
      });
      setShowModal(true);
    } catch (err) {
      alert('Không thể tải chi tiết bài Shadowing.');
    }
  };

  const handleAddLineRow = () => {
    setFormData((prev) => {
      const nextOrder = prev.lines.length + 1;
      const lastSpeaker = prev.lines[prev.lines.length - 1]?.speaker || 'B';
      const nextSpeaker = lastSpeaker === 'A' ? 'B' : 'A';
      return {
        ...prev,
        lines: [
          ...prev.lines,
          { lineOrder: nextOrder, speaker: nextSpeaker, japaneseText: '', hiraganaText: '', vietnameseTranslation: '' },
        ],
      };
    });
  };

  const handleUpdateLineRow = (idx, field, val) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    }));
  };

  const handleRemoveLineRow = (idx) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines
        .filter((_, i) => i !== idx)
        .map((l, i) => ({ ...l, lineOrder: i + 1 })),
    }));
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const validLines = formData.lines
      .filter((l) => l.japaneseText && l.japaneseText.trim())
      .map((l, idx) => ({
        lineOrder: idx + 1,
        speaker: (l.speaker || (idx % 2 === 0 ? 'A' : 'B')).trim(),
        japaneseText: l.japaneseText.trim(),
        hiraganaText: l.hiraganaText ? l.hiraganaText.trim() : '',
        vietnameseTranslation: l.vietnameseTranslation ? l.vietnameseTranslation.trim() : '',
      }));

    if (validLines.length === 0) {
      alert('Vui lòng nhập ít nhất 1 câu tiếng Nhật cho bài hội thoại.');
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      topicId: formData.topicId ? Number(formData.topicId) : null,
      jlptLevel: formData.jlptLevel,
      status: formData.status,
      isDialogue: validLines.length > 1,
      textJa: validLines[0].japaneseText,
      textVi: validLines[0].vietnameseTranslation,
      lines: validLines,
    };

    try {
      if (editingLesson) {
        const res = await axiosClient.put(`/admin/shadowing/lessons/${editingLesson.id}`, payload);
        if (res.success) {
          setShowModal(false);
          setBanner({ type: 'success', text: res.message || 'Cập nhật bài Shadowing thành công.' });
          fetchLessons();
        }
      } else {
        const res = await axiosClient.post('/admin/shadowing/lessons', payload);
        if (res.success) {
          setShowModal(false);
          setBanner({ type: 'success', text: res.message || 'Tạo bài Shadowing hội thoại mới thành công.' });
          fetchLessons();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu bài học thất bại.');
    }
  };

  const handleChangeStatus = async (lesson, nextStatus) => {
    try {
      const res = await axiosClient.patch(`/admin/shadowing/lessons/${lesson.id}/status`, { status: nextStatus });
      if (res.success) {
        setBanner({ type: 'success', text: `Đã chuyển "${lesson.title}" sang ${STATUS_META[nextStatus]?.label || nextStatus}.` });
        fetchLessons();
      }
    } catch (err) {
      alert('Đổi trạng thái thất bại.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài học Shadowing này?')) return;
    try {
      const res = await axiosClient.delete(`/admin/shadowing/lessons/${id}`);
      if (res.success) {
        setBanner({ type: 'info', text: 'Đã xóa bài học Shadowing.' });
        fetchLessons();
      }
    } catch (err) {
      alert('Xóa bài học thất bại.');
    }
  };

  // Dialogue Excel / CSV Import Handlers
  const handleDownloadDialogueTemplate = (type) => {
    const baseUrl = axiosClient.defaults.baseURL || 'http://localhost:8080/api/v1';
    window.open(`${baseUrl}/templates/dialogue.${type}`, '_blank');
  };

  const handleUploadDialogueFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !importLesson) return;
    setUploadingImport(true);
    setImportError('');
    setImportPreview(null);

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axiosClient.post(`/admin/shadowing/lessons/${importLesson.id}/import/preview`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success && res.data) {
        setImportPreview(res.data);
      }
    } catch (err) {
      setImportError(err.response?.data?.message || 'Không thể đọc tệp Excel/CSV hội thoại.');
    } finally {
      setUploadingImport(false);
      e.target.value = '';
    }
  };

  const handleCommitDialogueImport = async () => {
    if (!importLesson || !importPreview?.rows) return;
    setCommittingImport(true);
    setImportError('');
    try {
      const res = await axiosClient.post(`/admin/shadowing/lessons/${importLesson.id}/import/commit`, {
        mode: importMode,
        rows: importPreview.rows,
      });
      if (res.success) {
        setBanner({ type: 'success', text: res.message || 'Import hội thoại A/B thành công!' });
        setImportLesson(null);
        setImportPreview(null);
        fetchLessons();
      }
    } catch (err) {
      setImportError(err.response?.data?.message || 'Lưu hội thoại import thất bại.');
    } finally {
      setCommittingImport(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h3 className="fw-bold mb-1 text-dark">Quản lý Shadowing theo chủ đề (Hội thoại A/B)</h3>
          <p className="text-muted small mb-0">
            Tạo bài luyện nói hội thoại 2 người A/B theo chủ đề, import hàng loạt từ Excel/CSV và kiểm soát xuất bản cho học viên.
          </p>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={fetchLessons}>
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
          <button className="btn btn-primary d-flex align-items-center gap-1.5 fw-semibold" onClick={handleOpenAddModal}>
            <Plus size={18} />
            <span>Tạo bài Hội thoại A/B</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className={`alert alert-${banner.type} d-flex justify-content-between align-items-center py-2 px-3 small rounded-3 mb-0`}>
          <span>{banner.text}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setBanner(null)}></button>
        </div>
      )}

      {/* Status Filter Pills */}
      <div className="d-flex flex-wrap gap-2">
        {[
          { key: 'ALL', label: 'Tất cả bài học' },
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

      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>Tiêu đề & Câu mở đầu</th>
                <th>Chủ đề</th>
                <th>Số câu</th>
                <th>JLPT</th>
                <th>Trạng thái</th>
                <th className="text-end" style={{ width: '260px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Đang tải danh sách bài Shadowing...
                  </td>
                </tr>
              ) : lessons.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    Chưa có bài học Shadowing nào.
                  </td>
                </tr>
              ) : (
                lessons.map((lesson, idx) => {
                  const st = lesson.status || (lesson.isActive ? 'PUBLISHED' : 'ARCHIVED');
                  const stMeta = STATUS_META[st] || STATUS_META.PUBLISHED;
                  const lineCnt = lesson.lineCount || 1;
                  return (
                    <tr key={lesson.id}>
                      <td className="text-muted small">{idx + 1}</td>
                      <td>
                        <div className="fw-bold text-dark d-flex align-items-center gap-2">
                          <span>{lesson.title}</span>
                          {lineCnt > 1 && (
                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
                              A/B
                            </span>
                          )}
                        </div>
                        <div className="font-jp small text-secondary d-flex align-items-center gap-1.5 mt-1">
                          <span>{lesson.textJa}</span>
                          <AudioButton text={lesson.textJa} size="sm" />
                        </div>
                      </td>
                      <td className="small text-secondary">{lesson.topicNameVi || 'Chưa gắn chủ đề'}</td>
                      <td>
                        <span className="badge bg-light text-dark border px-2 py-1">{lineCnt} câu</span>
                      </td>
                      <td>
                        <span className={`badge badge-jlpt-${(lesson.jlptLevel || 'n5').toLowerCase()}`}>
                          {lesson.jlptLevel || 'N5'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill px-2 py-1 ${stMeta.badgeClass}`}>
                          {stMeta.label}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end flex-wrap gap-1">
                          <button
                            type="button"
                            className="btn btn-outline-success btn-sm"
                            onClick={() => {
                              setImportLesson(lesson);
                              setImportPreview(null);
                              setImportError('');
                            }}
                            title="Import Excel / CSV hội thoại A/B"
                          >
                            <FileSpreadsheet size={15} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-light btn-sm border text-primary"
                            onClick={() => handleOpenEditModal(lesson)}
                            title="Chỉnh sửa bài & danh sách câu A/B"
                          >
                            <Edit size={15} />
                          </button>

                          {st !== 'PUBLISHED' && (
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm"
                              onClick={() => handleChangeStatus(lesson, 'PUBLISHED')}
                              title="Xuất bản (USER nhìn thấy)"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}

                          {st === 'PUBLISHED' && (
                            <button
                              type="button"
                              className="btn btn-outline-warning btn-sm"
                              onClick={() => handleChangeStatus(lesson, 'DRAFT')}
                              title="Chuyển về Bản nháp"
                            >
                              <FileEdit size={15} />
                            </button>
                          )}

                          {st !== 'ARCHIVED' && (
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => handleChangeStatus(lesson, 'ARCHIVED')}
                              title="Lưu trữ"
                            >
                              <Archive size={15} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-light btn-sm border text-danger"
                            onClick={() => handleDelete(lesson.id)}
                            title="Xóa bài Shadowing"
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

      {/* Add / Edit Dialogue Lesson Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <MessagesSquare size={20} className="text-primary" />
                  <span>{editingLesson ? 'Chỉnh sửa bài Shadowing hội thoại A/B' : 'Tạo bài Shadowing hội thoại A/B mới'}</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveModal}>
                <div className="modal-body">
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Tên bài học *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Bài 1: Chào hỏi và giới thiệu bản thân"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Mô tả ngắn</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Mục tiêu luyện tập của đoạn hội thoại..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Chủ đề</label>
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
                    <div className="col-6 col-md-4">
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
                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Trạng thái xuất bản</label>
                      <select
                        className="form-select fw-semibold"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="PUBLISHED">Đã xuất bản (USER thấy)</option>
                        <option value="DRAFT">Bản nháp (Chỉ Admin thấy)</option>
                        <option value="ARCHIVED">Đã lưu trữ (Ẩn)</option>
                      </select>
                    </div>
                  </div>

                  {/* Dialogue Lines Editor */}
                  <div className="d-flex justify-content-between align-items-center mb-2 pt-2 border-top">
                    <div className="fw-bold small text-dark">
                      Danh sách lượt hội thoại A / B ({formData.lines.length} câu) — Hiragana để trống sẽ tự sinh bằng Kuromoji:
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 fw-semibold"
                      onClick={handleAddLineRow}
                    >
                      <Plus size={14} />
                      <span>Thêm lượt nói</span>
                    </button>
                  </div>

                  <div className="d-flex flex-column gap-2" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                    {formData.lines.map((line, idx) => (
                      <div key={idx} className="p-2.5 bg-light rounded-3 border">
                        <div className="row g-2 align-items-center">
                          <div className="col-3 col-md-1">
                            <select
                              className="form-select form-select-sm fw-bold"
                              value={line.speaker}
                              onChange={(e) => handleUpdateLineRow(idx, 'speaker', e.target.value)}
                            >
                              <option value="A">A</option>
                              <option value="B">B</option>
                            </select>
                          </div>
                          <div className="col-9 col-md-4">
                            <input
                              type="text"
                              className="form-control form-control-sm font-jp"
                              placeholder={`Câu ${idx + 1} tiếng Nhật *`}
                              value={line.japaneseText}
                              onChange={(e) => handleUpdateLineRow(idx, 'japaneseText', e.target.value)}
                              required
                            />
                          </div>
                          <div className="col-6 col-md-3">
                            <input
                              type="text"
                              className="form-control form-control-sm font-jp"
                              placeholder="Hiragana (tự sinh nếu trống)"
                              value={line.hiraganaText}
                              onChange={(e) => handleUpdateLineRow(idx, 'hiraganaText', e.target.value)}
                            />
                          </div>
                          <div className="col-5 col-md-3">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Dịch tiếng Việt"
                              value={line.vietnameseTranslation}
                              onChange={(e) => handleUpdateLineRow(idx, 'vietnameseTranslation', e.target.value)}
                            />
                          </div>
                          <div className="col-1 text-end">
                            <button
                              type="button"
                              className="btn btn-light btn-sm text-danger border p-1"
                              disabled={formData.lines.length <= 1}
                              onClick={() => handleRemoveLineRow(idx)}
                              title="Xóa câu"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary px-4 fw-semibold">
                    Lưu bài Shadowing
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Excel / CSV Import Modal for Dialogue Shadowing */}
      {importLesson && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    Import Excel / CSV Hội thoại A/B — {importLesson.title}
                  </h5>
                  <span className="small text-muted">
                    Cột hỗ trợ: <strong>Order, Speaker, Japanese, Hiragana, Vietnamese</strong> (Hiragana để trống tự động sinh bằng Kuromoji)
                  </span>
                </div>
                <button type="button" className="btn-close" onClick={() => setImportLesson(null)}></button>
              </div>

              <div className="modal-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <label className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2 fw-semibold" style={{ cursor: 'pointer' }}>
                    <Upload size={15} />
                    <span>{uploadingImport ? 'Đang phân tích file...' : 'Chọn file .xlsx / .xls / .csv'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="d-none"
                      onChange={handleUploadDialogueFile}
                      disabled={uploadingImport}
                    />
                  </label>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                      onClick={() => handleDownloadDialogueTemplate('xlsx')}
                    >
                      <Download size={14} />
                      <span>Tải mẫu Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      onClick={() => handleDownloadDialogueTemplate('csv')}
                    >
                      <Download size={14} />
                      <span>Tải mẫu CSV</span>
                    </button>
                  </div>
                </div>

                {importError && (
                  <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                    <AlertCircle size={16} />
                    <span>{importError}</span>
                  </div>
                )}

                {importPreview && (
                  <div className="border rounded-3 p-3 bg-light">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                      <div className="d-flex flex-wrap gap-2 small">
                        <span className="badge bg-white text-dark border px-2 py-1">
                          File: <strong>{importPreview.fileName}</strong>
                        </span>
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                          Hợp lệ: <strong>{importPreview.validRows}</strong> câu
                        </span>
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1">
                          Lỗi: <strong>{importPreview.errorRows}</strong> dòng
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <select
                          className="form-select form-select-sm"
                          style={{ width: 'auto' }}
                          value={importMode}
                          onChange={(e) => setImportMode(e.target.value)}
                        >
                          <option value="REPLACE">Thay thế toàn bộ câu hiện tại</option>
                          <option value="APPEND">Thêm tiếp vào cuối bài</option>
                        </select>

                        <button
                          type="button"
                          className="btn btn-success btn-sm fw-bold px-3"
                          disabled={committingImport || importPreview.validRows === 0}
                          onClick={handleCommitDialogueImport}
                        >
                          {committingImport ? 'Đang lưu...' : `Lưu ${importPreview.validRows} câu hội thoại`}
                        </button>
                      </div>
                    </div>

                    <div className="table-responsive bg-white rounded-3 border" style={{ maxHeight: '300px' }}>
                      <table className="table table-sm table-hover align-middle mb-0 small">
                        <thead className="table-light">
                          <tr>
                            <th>Order</th>
                            <th>Speaker</th>
                            <th>Japanese</th>
                            <th>Hiragana</th>
                            <th>Vietnamese</th>
                            <th>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(importPreview.rows || []).map((r, i) => (
                            <tr key={i} className={!r.valid ? 'table-danger' : ''}>
                              <td>{r.lineOrder}</td>
                              <td>
                                <span className={`badge ${r.speaker === 'A' ? 'bg-primary' : 'bg-success'}`}>
                                  {r.speaker}
                                </span>
                              </td>
                              <td className="font-jp fw-bold">{r.japaneseText}</td>
                              <td className="font-jp text-primary">{r.hiraganaText}</td>
                              <td>{r.vietnameseTranslation}</td>
                              <td>
                                {r.valid ? (
                                  <span className="text-success fw-semibold">Hợp lệ</span>
                                ) : (
                                  <span className="text-danger fw-semibold">{r.errorMessage}</span>
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

              <div className="modal-footer border-top">
                <button type="button" className="btn btn-light" onClick={() => setImportLesson(null)}>
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

export default AdminShadowingLessons;
