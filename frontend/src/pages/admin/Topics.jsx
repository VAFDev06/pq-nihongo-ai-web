import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import {
  Tags,
  Plus,
  Edit,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';

export const AdminTopics = () => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [banner, setBanner] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [formData, setFormData] = useState({
    nameVi: '',
    nameJa: '',
    description: '',
    jlptLevel: '',
    status: 'ACTIVE',
  });

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/topics');
      if (res.success && Array.isArray(res.data)) {
        setTopics(res.data);
      }
    } catch (err) {
      setBanner({ type: 'danger', text: err.response?.data?.message || 'Không thể tải danh sách chủ đề.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleOpenAdd = () => {
    setEditingTopic(null);
    setFormData({
      nameVi: '',
      nameJa: '',
      description: '',
      jlptLevel: '',
      status: 'ACTIVE',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (topic) => {
    setEditingTopic(topic);
    setFormData({
      nameVi: topic.nameVi || '',
      nameJa: topic.nameJa || '',
      description: topic.description || '',
      jlptLevel: topic.jlptLevel || '',
      status: topic.status || (topic.isActive ? 'ACTIVE' : 'INACTIVE'),
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      nameVi: formData.nameVi.trim(),
      nameJa: formData.nameJa.trim() || null,
      description: formData.description.trim() || null,
      jlptLevel: formData.jlptLevel || null,
      status: formData.status,
      isActive: formData.status === 'ACTIVE',
    };
    try {
      if (editingTopic) {
        const res = await axiosClient.put(`/admin/topics/${editingTopic.id}`, payload);
        if (res.success) {
          setShowModal(false);
          setBanner({ type: 'success', text: res.message || 'Cập nhật chủ đề thành công.' });
          fetchTopics();
        }
      } else {
        const res = await axiosClient.post('/admin/topics', payload);
        if (res.success) {
          setShowModal(false);
          setBanner({ type: 'success', text: res.message || 'Tạo chủ đề mới thành công.' });
          fetchTopics();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu chủ đề thất bại.');
    }
  };

  const handleToggleStatus = async (topic) => {
    const currentStatus = topic.status || (topic.isActive ? 'ACTIVE' : 'INACTIVE');
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await axiosClient.patch(`/admin/topics/${topic.id}/status`, { status: nextStatus });
      if (res.success) {
        setBanner({ type: 'success', text: `Đã chuyển chủ đề "${topic.nameVi}" sang trạng thái ${nextStatus}.` });
        fetchTopics();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đổi trạng thái thất bại.');
    }
  };

  const handleDelete = async (topic) => {
    if (!window.confirm(`Bạn có chắc muốn xóa chủ đề "${topic.nameVi}"?`)) return;
    try {
      const res = await axiosClient.delete(`/admin/topics/${topic.id}`);
      if (res.success) {
        setBanner({ type: 'info', text: res.message || 'Đã xóa chủ đề thành công.' });
        fetchTopics();
      }
    } catch (err) {
      setBanner({
        type: 'warning',
        text: err.response?.data?.message || 'Không thể xóa chủ đề này vì đang có dữ liệu liên kết.',
      });
    }
  };

  const filtered = topics.filter((t) => {
    const st = t.status || (t.isActive ? 'ACTIVE' : 'INACTIVE');
    if (statusFilter !== 'ALL' && st !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (t.nameVi || '').toLowerCase().includes(q) ||
      (t.nameJa || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h3 className="fw-bold mb-1 text-dark">Quản lý Chủ đề học tập</h3>
          <p className="text-muted small mb-0">
            Danh mục chủ đề độc lập dùng chung cho <strong>Bộ thẻ Flashcard mẫu</strong> và <strong>Shadowing theo chủ đề</strong>.
          </p>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={fetchTopics}>
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
          <button type="button" className="btn btn-primary d-flex align-items-center gap-2 fw-semibold" onClick={handleOpenAdd}>
            <Plus size={18} />
            <span>Tạo chủ đề mới</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className={`alert alert-${banner.type} d-flex justify-content-between align-items-center py-2 px-3 small rounded-3 mb-0`}>
          <span>{banner.text}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setBanner(null)}></button>
        </div>
      )}

      {/* Filter bar */}
      <div className="card pq-card p-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-8">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Search size={17} />
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0 ps-1"
                placeholder="Tìm theo tên chủ đề tiếng Việt, tiếng Nhật hoặc mô tả..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-4">
            <select
              className="form-select bg-light"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái ({topics.length})</option>
              <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
              <option value="INACTIVE">Đang ẩn (INACTIVE)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Topics Table */}
      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>Tên chủ đề (Việt / Nhật)</th>
                <th>Mô tả</th>
                <th>JLPT</th>
                <th>Đang gắn với</th>
                <th>Trạng thái</th>
                <th className="text-end" style={{ width: '170px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" />
                    Đang tải danh mục chủ đề...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <Tags size={38} className="opacity-50 mb-2 mx-auto" />
                    <div>Không tìm thấy chủ đề nào.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((t, idx) => {
                  const st = t.status || (t.isActive ? 'ACTIVE' : 'INACTIVE');
                  const isActive = st === 'ACTIVE';
                  return (
                    <tr key={t.id}>
                      <td className="text-muted small">{idx + 1}</td>
                      <td>
                        <div className="fw-bold text-dark">{t.nameVi}</div>
                        {t.nameJa && <div className="font-jp small text-primary">{t.nameJa}</div>}
                      </td>
                      <td className="small text-muted" style={{ maxWidth: '280px' }}>
                        {t.description || '-'}
                      </td>
                      <td>
                        {t.jlptLevel ? (
                          <span className={`badge badge-jlpt-${t.jlptLevel.toLowerCase()} px-2 py-1`}>
                            {t.jlptLevel}
                          </span>
                        ) : (
                          <span className="text-muted small">Chung</span>
                        )}
                      </td>
                      <td className="small">
                        <span className="badge bg-light text-dark border me-1">
                          {t.deckCount ?? 0} bộ thẻ
                        </span>
                        <span className="badge bg-light text-dark border">
                          {t.shadowingCount ?? 0} Shadowing
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill px-2.5 py-1 ${
                            isActive
                              ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                              : 'bg-secondary bg-opacity-10 text-secondary border'
                          }`}
                        >
                          {isActive ? 'Hoạt động' : 'Đang ẩn'}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button
                            type="button"
                            className="btn btn-light btn-sm border text-primary"
                            onClick={() => handleOpenEdit(t)}
                            title="Sửa chủ đề"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${isActive ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            onClick={() => handleToggleStatus(t)}
                            title={isActive ? 'Ẩn chủ đề (INACTIVE)' : 'Kích hoạt chủ đề (ACTIVE)'}
                          >
                            {isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-light btn-sm border text-danger"
                            onClick={() => handleDelete(t)}
                            title="Xóa an toàn"
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

      {/* Add / Edit Topic Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  {editingTopic ? 'Chỉnh sửa chủ đề' : 'Tạo chủ đề mới'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Tên chủ đề (Tiếng Việt) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: Chào hỏi & Giới thiệu bản thân"
                      value={formData.nameVi}
                      onChange={(e) => setFormData({ ...formData, nameVi: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Tên tiếng Nhật (tùy chọn)</label>
                    <input
                      type="text"
                      className="form-control font-jp"
                      placeholder="VD: 挨拶・自己紹介"
                      value={formData.nameJa}
                      onChange={(e) => setFormData({ ...formData, nameJa: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary">Cấp độ JLPT (tùy chọn)</label>
                      <select
                        className="form-select"
                        value={formData.jlptLevel}
                        onChange={(e) => setFormData({ ...formData, jlptLevel: e.target.value })}
                      >
                        <option value="">Dùng chung mọi cấp độ</option>
                        <option value="N5">JLPT N5</option>
                        <option value="N4">JLPT N4</option>
                        <option value="N3">JLPT N3</option>
                        <option value="N2">JLPT N2</option>
                        <option value="N1">JLPT N1</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-secondary">Trạng thái</label>
                      <select
                        className="form-select"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                        <option value="INACTIVE">Đang ẩn (INACTIVE)</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold text-secondary">Mô tả ngắn</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Mô tả phạm vi nội dung của chủ đề..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary px-4 fw-semibold">
                    {editingTopic ? 'Lưu cập nhật' : 'Tạo chủ đề'}
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

export default AdminTopics;
