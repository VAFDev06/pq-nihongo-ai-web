import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { ArrowLeft, History, Eye } from 'lucide-react';

export const ShadowingHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await axiosClient.get('/shadowing/attempts?size=30');
        if (res.success && res.data) {
          const items = Array.isArray(res.data) ? res.data : (res.data.content || []);
          setHistory(items);
        }
      } catch (err) {
        console.error('Fetch shadowing history failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="d-flex align-items-center gap-2">
        <Link to="/app/shadowing" className="btn btn-light btn-sm p-2 text-muted">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h3 className="fw-bold mb-0">Lịch sử luyện tập Shadowing</h3>
          <p className="text-muted small mb-0">Xem lại các lần ghi âm, điểm số và chi tiết so khớp từng từ</p>
        </div>
      </div>

      <div className="card pq-card p-3">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Đang tải lịch sử...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <History size={40} className="opacity-50 mb-2 mx-auto" />
            <div>Chưa có bài luyện tập nào được ghi nhận.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Bài học</th>
                  <th>Câu bạn đã đọc</th>
                  <th>Điểm số</th>
                  <th>Thời gian</th>
                  <th className="text-end">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => {
                  const acc = Number(item.accuracy ?? item.accuracyScore ?? 0);
                  return (
                    <tr key={item.id}>
                      <td className="text-muted small">{idx + 1}</td>
                      <td className="fw-semibold text-dark">
                        {item.lessonTitle || `Bài học #${item.lessonId}`}
                      </td>
                      <td className="font-jp small text-dark">{item.recognizedText}</td>
                      <td>
                        <span
                          className={`badge ${
                            acc >= 80
                              ? 'bg-success'
                              : acc >= 60
                              ? 'bg-warning text-dark'
                              : 'bg-danger'
                          } px-2.5 py-1`}
                        >
                          {Math.round(acc)}%
                        </span>
                      </td>
                      <td className="small text-muted">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-light btn-sm text-primary d-inline-flex align-items-center gap-1"
                          onClick={() => setSelectedAttempt(item)}
                        >
                          <Eye size={14} /> <span>Xem từ</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Xem chi tiết Word Diff */}
      {selectedAttempt && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  Chi tiết phát âm: {selectedAttempt.lessonTitle} ({Math.round(selectedAttempt.accuracy ?? 0)}%)
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedAttempt(null)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="small text-muted fw-semibold">Câu nhận diện từ bạn:</div>
                  <div className="fs-5 font-jp fw-bold text-dark">{selectedAttempt.recognizedText}</div>
                </div>
                <div className="small text-muted fw-semibold mb-2">Phân tích từng từ (Token Breakdown):</div>
                <div className="p-4 rounded-4 font-jp" style={{ background: '#1a1d24', color: '#fff' }}>
                  <div className="d-flex flex-wrap gap-2">
                    {(selectedAttempt.wordDiff || []).map((tok, i) => {
                      const colorMap = {
                        CORRECT: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', color: '#34d399', icon: '✓' },
                        WRONG: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', color: '#f87171', icon: '✗' },
                        MISSING: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', color: '#fbbf24', icon: '⚠' },
                        EXTRA: { bg: 'rgba(56,189,248,0.15)', border: '#38bdf8', color: '#7dd3fc', icon: '+' },
                      };
                      const st = colorMap[tok.status] || colorMap.CORRECT;
                      return (
                        <div
                          key={i}
                          className="px-3 py-1.5 rounded-3 fw-bold d-inline-flex flex-column align-items-center"
                          style={{ background: st.bg, border: `1.5px solid ${st.border}`, color: st.color }}
                        >
                          <div>{tok.text} {st.icon}</div>
                          {tok.heard && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>nghe: {tok.heard}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedAttempt(null)}>
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

export default ShadowingHistory;
