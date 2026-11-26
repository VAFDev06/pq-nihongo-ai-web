import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/audit-logs', {
        params: { page, size: 15 },
      });
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data.content || []);
        setLogs(list);
        setTotalPages(res.meta?.totalPages || res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Fetch audit logs failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page]);

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h3 className="fw-bold mb-1 text-dark">Nhật ký kiểm toán (Audit Logs)</h3>
        <p className="text-muted small mb-0">Theo dõi toàn bộ thao tác thay đổi dữ liệu hệ thống của Quản trị viên</p>
      </div>

      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Hành động (Action)</th>
                <th>Loại đối tượng</th>
                <th>ID Đối tượng</th>
                <th>Người thực hiện</th>
                <th>Chi tiết thao tác</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Đang tải nhật ký kiểm toán...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    Chưa có nhật ký kiểm toán nào.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={log.id}>
                    <td className="text-muted small">{page * 15 + idx + 1}</td>
                    <td>
                      <span className="badge bg-danger bg-opacity-10 text-danger font-monospace">
                        {log.action}
                      </span>
                    </td>
                    <td className="fw-semibold text-dark small">{log.entityType || log.entityName}</td>
                    <td className="small text-muted">{log.entityId ?? '-'}</td>
                    <td className="text-primary small fw-semibold">{log.performedBy || `Admin #${log.adminId || 1}`}</td>
                    <td className="text-muted small font-monospace text-truncate" style={{ maxWidth: '280px' }} title={log.detail}>
                      {log.detail || '-'}
                    </td>
                    <td className="small text-muted">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
    </div>
  );
};

export default AdminAuditLogs;
