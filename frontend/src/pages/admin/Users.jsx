import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import {
  Search,
  Lock,
  Unlock,
  Shield,
  Key,
  Sliders,
} from 'lucide-react';

export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // AI Limit modal
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [aiLimitValue, setAiLimitValue] = useState(30);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/users', {
        params: {
          page,
          size: 12,
          q: search || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      if (res.success && res.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.content || []);
        setUsers(items);
        setTotalPages(res.meta?.totalPages || res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Fetch users failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    if (!window.confirm(`Bạn có chắc muốn ${newStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản ${user.email}?`)) return;

    try {
      const res = await axiosClient.patch(`/admin/users/${user.id}/status`, {
        status: newStatus,
      });
      if (res.success) {
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Thay đổi trạng thái thất bại.');
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!window.confirm(`Bạn có chắc muốn chuyển vai trò của ${user.email} sang ${newRole}?`)) return;

    try {
      const res = await axiosClient.patch(`/admin/users/${user.id}/role`, {
        role: newRole,
      });
      if (res.success) {
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Thay đổi quyền thất bại.');
    }
  };

  const handleOpenResetModal = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowResetModal(true);
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser || newPassword.length < 8) {
      alert('Mật khẩu mới tối thiểu phải từ 8 ký tự.');
      return;
    }

    try {
      const res = await axiosClient.post(`/admin/users/${selectedUser.id}/reset-password`, {
        newPassword,
      });
      if (res.success) {
        alert('Đặt lại mật khẩu thành công!');
        setShowResetModal(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đặt lại mật khẩu thất bại.');
    }
  };

  const handleOpenLimitModal = (user) => {
    setSelectedUser(user);
    setAiLimitValue(user.aiDailyLimit ?? 30);
    setShowLimitModal(true);
  };

  const handleConfirmAiLimit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await axiosClient.patch(`/admin/users/${selectedUser.id}/ai-limit`, {
        aiDailyLimit: parseInt(aiLimitValue, 10),
      });
      if (res.success) {
        setShowLimitModal(false);
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật hạn mức AI thất bại.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h3 className="fw-bold mb-1 text-dark">Quản lý người dùng</h3>
        <p className="text-muted small mb-0">Theo dõi thông tin, phân quyền ADMIN/USER, cấp hạn mức AI và khóa tài khoản vi phạm</p>
      </div>

      {/* Search & Filters Bar */}
      <div className="card pq-card p-3">
        <form onSubmit={handleSearch} className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Search size={18} />
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0 ps-1"
                placeholder="Tìm theo email, họ tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-6 col-md-2">
            <select
              className="form-select bg-light"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả vai trò</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select
              className="form-select bg-light"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </div>
          <div className="col-12 col-md-2">
            <button type="submit" className="btn btn-primary w-100">Tìm kiếm</button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>JLPT</th>
                <th>Hạn mức AI/ngày</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th className="text-end" style={{ width: '180px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-5 text-muted">
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              ) : (
                users.map((u, idx) => (
                  <tr key={u.id}>
                    <td className="text-muted small">{page * 12 + idx + 1}</td>
                    <td className="fw-semibold text-dark">{u.fullName}</td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'bg-danger' : 'bg-primary'} px-2 py-1`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-jlpt-${(u.jlptLevel || u.targetJlptLevel || 'n5').toLowerCase()}`}>
                        {u.jlptLevel || u.targetJlptLevel || 'N5'}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {u.aiDailyLimit != null ? `${u.aiDailyLimit} lượt` : 'Mặc định (30)'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'ACTIVE' ? 'bg-success' : 'bg-secondary'} px-2 py-1`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="small text-muted">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <button
                          className={`btn btn-sm ${u.status === 'ACTIVE' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          onClick={() => handleToggleStatus(u)}
                          title={u.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
                        >
                          {u.status === 'ACTIVE' ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        <button
                          className="btn btn-sm btn-outline-warning"
                          onClick={() => handleToggleRole(u)}
                          title="Đổi vai trò USER / ADMIN"
                        >
                          <Shield size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-info"
                          onClick={() => handleOpenLimitModal(u)}
                          title="Cấp hạn mức gọi AI/ngày"
                        >
                          <Sliders size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleOpenResetModal(u)}
                          title="Đặt lại mật khẩu"
                        >
                          <Key size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-top d-flex justify-content-between align-items-center">
            <span className="small text-muted">Trang {page + 1} / {totalPages}</span>
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-outline-secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Đặt lại mật khẩu người dùng</h5>
                <button type="button" className="btn-close" onClick={() => setShowResetModal(false)}></button>
              </div>
              <form onSubmit={handleConfirmResetPassword}>
                <div className="modal-body">
                  <p className="small text-muted mb-3">
                    Người dùng: <strong>{selectedUser.fullName}</strong> ({selectedUser.email})
                  </p>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Mật khẩu mới (tối thiểu 8 ký tự)</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Nhập tối thiểu 8 ký tự..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowResetModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-danger">
                    Lưu mật khẩu mới
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* AI Quota Limit Modal */}
      {showLimitModal && selectedUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Cấp hạn mức gọi Gemini AI</h5>
                <button type="button" className="btn-close" onClick={() => setShowLimitModal(false)}></button>
              </div>
              <form onSubmit={handleConfirmAiLimit}>
                <div className="modal-body">
                  <p className="small text-muted mb-3">
                    Người dùng: <strong>{selectedUser.fullName}</strong> ({selectedUser.email})
                  </p>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary">Số lượt gọi AI tối đa / ngày</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      className="form-control"
                      value={aiLimitValue}
                      onChange={(e) => setAiLimitValue(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setShowLimitModal(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Lưu hạn mức
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

export default AdminUsers;
