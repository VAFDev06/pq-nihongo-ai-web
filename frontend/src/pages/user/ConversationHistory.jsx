import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { ArrowLeft, MessageSquare, Eye, Trash2 } from 'lucide-react';

export const ConversationHistory = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/conversations/my?size=30');
      if (res.success && res.data) {
        const items = Array.isArray(res.data) ? res.data : (res.data.content || []);
        setConversations(items);
      }
    } catch (err) {
      console.error('Fetch conversation history failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa lịch sử cuộc hội thoại này?')) return;
    try {
      const res = await axiosClient.delete(`/conversations/${id}`);
      if (res.success) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      alert('Xóa cuộc hội thoại thất bại.');
    }
  };

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="d-flex align-items-center gap-2">
        <Link to="/app/conversation" className="btn btn-light btn-sm p-2 text-muted">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h3 className="fw-bold mb-0">Lịch sử hội thoại AI</h3>
          <p className="text-muted small mb-0">Xem lại nội dung tin nhắn, sửa lỗi ngữ pháp hoặc tiếp tục các phiên hội thoại</p>
        </div>
      </div>

      <div className="card pq-card p-3">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted small mt-2">Đang tải lịch sử...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <MessageSquare size={40} className="opacity-50 mb-2 mx-auto" />
            <div>Chưa có phiên hội thoại nào.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Chủ đề hội thoại</th>
                  <th>Trình độ</th>
                  <th>Trạng thái</th>
                  <th>Thời gian bắt đầu</th>
                  <th className="text-end">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="text-muted small">{idx + 1}</td>
                    <td>
                      <div className="fw-semibold text-dark">{item.topicNameVi || item.title || 'Hội thoại AI'}</div>
                      {item.summary && (
                        <div className="small text-muted text-truncate" style={{ maxWidth: '320px' }}>
                          {item.summary}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-jlpt-${(item.jlptLevel || 'n5').toLowerCase()}`}>
                        {item.jlptLevel || 'N5'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${item.status === 'ENDED' ? 'bg-secondary' : 'bg-success'}`}>
                        {item.status === 'ENDED' ? 'Đã kết thúc' : 'Đang mở'}
                      </span>
                    </td>
                    <td className="small text-muted">
                      {(item.startedAt || item.createdAt)
                        ? new Date(item.startedAt || item.createdAt).toLocaleString('vi-VN')
                        : '-'}
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <Link
                          to={`/app/conversation?id=${item.id}`}
                          className="btn btn-light btn-sm text-primary d-inline-flex align-items-center gap-1"
                        >
                          <Eye size={14} />
                          <span>{item.status === 'ENDED' ? 'Xem lại' : 'Tiếp tục'}</span>
                        </Link>
                        <button
                          type="button"
                          className="btn btn-light btn-sm text-danger"
                          onClick={() => handleDelete(item.id)}
                          title="Xóa"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationHistory;
