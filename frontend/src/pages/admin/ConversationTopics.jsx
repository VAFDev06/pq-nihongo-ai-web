import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import {
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';

export const AdminConversationTopics = () => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [formData, setFormData] = useState({
    nameVi: '',
    nameJa: '',
    description: '',
    systemPrompt: '',
    jlptLevel: 'N5',
    isActive: true,
  });

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/conversations/topics');
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data.content || []);
        setTopics(list);
      }
    } catch (err) {
      console.error('Fetch admin conversation topics failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleOpenAddModal = () => {
    setEditingTopic(null);
    setFormData({
      nameVi: '',
      nameJa: '',
      description: '',
      systemPrompt: '',
      jlptLevel: 'N5',
      isActive: true,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (topic) => {
    setEditingTopic(topic);
    setFormData({
      nameVi: topic.nameVi || topic.title || '',
      nameJa: topic.nameJa || '',
      description: topic.description || '',
      systemPrompt: topic.systemPrompt || '',
      jlptLevel: topic.jlptLevel || 'N5',
      isActive: topic.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const payload = {
      nameVi: formData.nameVi.trim(),
      title: formData.nameVi.trim(),
      nameJa: formData.nameJa.trim() || null,
      description: formData.description.trim(),
      systemPrompt: formData.systemPrompt.trim(),
      jlptLevel: formData.jlptLevel,
      isActive: formData.isActive,
    };
    try {
      if (editingTopic) {
        const res = await axiosClient.put(`/admin/conversations/topics/${editingTopic.id}`, payload);
        if (res.success) {
          setShowModal(false);
          fetchTopics();
        }
      } else {
        const res = await axiosClient.post('/admin/conversations/topics', payload);
        if (res.success) {
          setShowModal(false);
          fetchTopics();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu chủ đề thất bại.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chủ đề hội thoại này?')) return;
    try {
      const res = await axiosClient.delete(`/admin/conversations/topics/${id}`);
      if (res.success) {
        setTopics((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      alert('Xóa chủ đề thất bại.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h3 className="fw-bold mb-1 text-dark">Quản lý Chủ đề hội thoại AI</h3>
          <p className="text-muted small mb-0">Thiết lập các tình huống giao tiếp và tinh chỉnh System Prompt cho Gemini AI</p>
        </div>

        <button className="btn btn-primary d-flex align-items-center gap-1" onClick={handleOpenAddModal}>
          <Plus size={18} />
          <span>Thêm chủ đề mới</span>
        </button>
      </div>

      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Tên chủ đề</th>
                <th>Mô tả ngữ cảnh</th>
                <th>Cấp độ</th>
                <th>Trạng thái</th>
                <th className="text-end" style={{ width: '120px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Đang tải danh sách chủ đề...
                  </td>
                </tr>
              ) : topics.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted">
                    Chưa có chủ đề nào.
                  </td>
                </tr>
              ) : (
                topics.map((t, idx) => (
                  <tr key={t.id}>
                    <td className="text-muted small">{idx + 1}</td>
                    <td>
                      <div className="fw-semibold text-dark">{t.nameVi || t.title}</div>
                      {t.nameJa && <div className="small text-primary font-jp">{t.nameJa}</div>}
                    </td>
                    <td className="text-muted small">{t.description || '-'}</td>
                    <td>
                      <span className={`badge badge-jlpt-${(t.jlptLevel || 'n5').toLowerCase()}`}>
                        {t.jlptLevel || 'N5'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.isActive ? 'bg-success' : 'bg-secondary'}`}>
                        {t.isActive ? 'Hoạt động' : 'Ẩn'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <button
                          className="btn btn-light btn-sm text-primary"
                          onClick={() => handleOpenEditModal(t)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="btn btn-light btn-sm text-danger"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 size={16} />
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  {editingTopic ? 'Chỉnh sửa chủ đề hội thoại' : 'Thêm chủ đề hội thoại mới'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveModal}>
                <div className="modal-body">
                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Tên chủ đề (Tiếng Việt) *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Gọi món tại quán Ramen"
                        value={formData.nameVi}
                        onChange={(e) => setFormData({ ...formData, nameVi: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Tên chủ đề (Tiếng Nhật)</label>
                      <input
                        type="text"
                        className="form-control font-jp"
                        placeholder="VD: レストランで注文する"
                        value={formData.nameJa}
                        onChange={(e) => setFormData({ ...formData, nameJa: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-8">
                      <label className="form-label small fw-semibold text-secondary">Mô tả ngắn</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Đóng vai khách hàng và nhân viên phục vụ quán mì"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small fw-semibold text-secondary">Trình độ JLPT</label>
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
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">System Prompt cho Gemini AI *</label>
                    <textarea
                      className="form-control font-monospace small"
                      rows="5"
                      placeholder="Nhập hướng dẫn vai trò và quy tắc trả lời cho AI..."
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                      required
                    ></textarea>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="topicActiveCheck"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <label className="form-check-label small" htmlFor="topicActiveCheck">
                      Kích hoạt chủ đề hội thoại này
                    </label>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Lưu chủ đề
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

export default AdminConversationTopics;
