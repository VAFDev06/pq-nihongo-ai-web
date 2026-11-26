import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';

export const AdminAiLogs = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [featureFilter, setFeatureFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [resLogs, resSum] = await Promise.all([
        axiosClient.get('/admin/ai-logs', {
          params: {
            page,
            size: 15,
            feature: featureFilter || undefined,
            status: statusFilter || undefined,
          },
        }),
        axiosClient.get('/admin/ai-logs/summary'),
      ]);
      if (resLogs.success && resLogs.data) {
        const list = Array.isArray(resLogs.data) ? resLogs.data : (resLogs.data.content || []);
        setLogs(list);
        setTotalPages(resLogs.meta?.totalPages || resLogs.data.totalPages || 1);
      }
      if (resSum.success && resSum.data) {
        setSummary(resSum.data);
      }
    } catch (err) {
      console.error('Fetch AI logs failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, featureFilter, statusFilter]);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h3 className="fw-bold mb-1 text-dark">Giám sát Nhật ký gọi Gemini AI</h3>
          <p className="text-muted small mb-0">
            Tổng lượt gọi: <strong>{summary?.totalCalls ?? 0}</strong> · Độ trễ trung bình: <strong>{summary?.averageLatencyMs ?? 0} ms</strong>
          </p>
        </div>

        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: '190px' }}
            value={featureFilter}
            onChange={(e) => {
              setFeatureFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả tính năng</option>
            <option value="RECOGNITION">Nhận diện ảnh (RECOGNITION)</option>
            <option value="CONVERSATION">Hội thoại AI (CONVERSATION)</option>
          </select>

          <select
            className="form-select form-select-sm"
            style={{ width: '160px' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>

      <div className="card pq-card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Tính năng</th>
                <th>Model</th>
                <th>Tokens</th>
                <th>Độ trễ</th>
                <th>Trạng thái</th>
                <th>Chi tiết lỗi (nếu có)</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Đang tải nhật ký...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    Chưa có nhật ký gọi AI nào.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const totalTk = log.totalTokens ?? ((log.promptTokens || 0) + (log.completionTokens || 0));
                  return (
                    <tr key={log.id}>
                      <td className="text-muted small">{page * 15 + idx + 1}</td>
                      <td className="fw-semibold text-dark">{log.feature}</td>
                      <td className="text-muted small font-monospace">{log.model || log.modelName}</td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {totalTk > 0 ? `${totalTk} tk` : '-'}
                        </span>
                      </td>
                      <td className="text-muted small">{log.latencyMs != null ? `${log.latencyMs} ms` : '-'}</td>
                      <td>
                        <span
                          className={`badge ${
                            log.status === 'SUCCESS' ? 'bg-success' : 'bg-danger'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="small text-danger text-truncate" style={{ maxWidth: '240px' }} title={log.errorMessage}>
                        {log.errorMessage || '-'}
                      </td>
                      <td className="small text-muted">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '-'}
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

export default AdminAiLogs;
