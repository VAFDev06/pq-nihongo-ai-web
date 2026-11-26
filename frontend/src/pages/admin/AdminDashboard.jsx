import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import {
  Users,
  Tags,
  Layers,
  Mic,
  Activity,
  ShieldAlert,
  ArrowRight,
  MessageSquare,
  Settings,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminStats = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Fetch admin stats failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
  }, []);

  // Đã xóa card "Kho từ vựng hệ thống" và cân đối lại lưới thống kê
  const metricCards = [
    {
      label: 'Tổng người dùng',
      value: stats?.totalUsers ?? 0,
      unit: 'tài khoản',
      valueColor: '#0f172a',
      iconBg: 'rgba(37, 99, 235, 0.12)',
      iconColor: '#2563eb',
      icon: Users,
      meta: (
        <>
          Đang hoạt động: <strong className="text-dark">{stats?.activeUsers ?? 0}</strong> tài khoản
        </>
      ),
    },
    {
      label: 'Bộ thẻ & Flashcard',
      value: stats?.totalDecks ?? 0,
      unit: 'bộ thẻ',
      valueColor: '#0284c7',
      iconBg: 'rgba(2, 132, 199, 0.12)',
      iconColor: '#0284c7',
      icon: Layers,
      meta: (
        <>
          Bộ mẫu xuất bản: <strong className="text-dark">{stats?.publishedSystemDecks ?? 0}</strong> · Tổng thẻ:{' '}
          <strong className="text-dark">{stats?.totalFlashcards ?? 0}</strong>
        </>
      ),
    },
    {
      label: 'Shadowing & Hội thoại',
      value: stats?.totalShadowingLessons ?? 0,
      unit: 'bài học',
      valueColor: '#d97706',
      iconBg: 'rgba(245, 158, 11, 0.14)',
      iconColor: '#d97706',
      icon: Mic,
      meta: (
        <>
          Lượt luyện nói: <strong className="text-dark">{stats?.totalShadowingAttempts ?? 0}</strong> · YouTube:{' '}
          <strong className="text-dark">{stats?.totalYoutubeVideos ?? 0}</strong>
        </>
      ),
    },
    {
      label: 'Hội thoại & Quét ảnh AI',
      value: stats?.totalConversations ?? 0,
      unit: 'hội thoại',
      valueColor: '#2563eb',
      iconBg: 'rgba(37, 99, 235, 0.12)',
      iconColor: '#2563eb',
      icon: MessageSquare,
      meta: (
        <>
          Quét ảnh AI: <strong className="text-dark">{stats?.totalRecognitions ?? 0}</strong> · AI hôm nay:{' '}
          <strong className="text-danger">{stats?.aiCallsToday ?? 0}</strong> lượt
        </>
      ),
    },
  ];

  const navModules = [
    {
      to: '/admin/users',
      title: 'Quản lý Người dùng',
      desc: 'Tra cứu, khóa/mở khóa tài khoản, phân quyền, đặt lại mật khẩu và cấp hạn mức AI.',
      icon: Users,
      iconBg: 'rgba(37, 99, 235, 0.1)',
      iconColor: '#2563eb',
    },
    {
      to: '/admin/topics',
      title: 'Quản lý Chủ đề',
      desc: 'Tạo, chỉnh sửa, bật/tắt trạng thái và quản lý danh mục chủ đề dùng chung cho Bộ thẻ mẫu & Shadowing.',
      icon: Tags,
      iconBg: 'rgba(16, 185, 129, 0.1)',
      iconColor: '#059669',
    },
    {
      to: '/admin/decks',
      title: 'Bộ thẻ Flashcard mẫu',
      desc: 'Tạo, chỉnh sửa, xuất bản (Draft / Published / Archived) và import thẻ bằng Excel/CSV đồng bộ với USER.',
      icon: Layers,
      iconBg: 'rgba(2, 132, 199, 0.1)',
      iconColor: '#0284c7',
    },
    {
      to: '/admin/shadowing',
      title: 'Shadowing Hội thoại A/B',
      desc: 'Quản lý bài luyện nói theo chủ đề dạng hội thoại 2 người A/B và import trực tiếp từ Excel/CSV.',
      icon: Mic,
      iconBg: 'rgba(245, 158, 11, 0.12)',
      iconColor: '#d97706',
    },
    {
      to: '/admin/conversation-topics',
      title: 'Chủ đề Hội thoại AI',
      desc: 'Thiết lập tình huống hội thoại và cấu hình System Prompt cho Gia sư Gemini AI.',
      icon: MessageSquare,
      iconBg: 'rgba(124, 58, 237, 0.1)',
      iconColor: '#7c3aed',
    },
    {
      to: '/admin/ai-logs',
      title: 'Giám sát & Nhật ký AI',
      desc: 'Theo dõi lịch sử gọi Gemini API, độ trễ (ms), tokens tiêu thụ và thông báo lỗi.',
      icon: Activity,
      iconBg: 'rgba(239, 68, 68, 0.1)',
      iconColor: '#dc2626',
    },
    {
      to: '/admin/settings',
      title: 'Cấu hình tham số hệ thống',
      desc: 'Tùy chỉnh phiên bản model Gemini AI, hạn mức gọi AI/ngày và thông số hệ thống.',
      icon: Settings,
      iconBg: 'rgba(71, 85, 105, 0.1)',
      iconColor: '#475569',
    },
    {
      to: '/admin/audit-logs',
      title: 'Nhật ký kiểm toán (Audit Logs)',
      desc: 'Truy vết mọi thao tác quản trị hệ thống (khóa user, xuất bản bộ thẻ, import dữ liệu).',
      icon: ShieldAlert,
      iconBg: 'rgba(225, 29, 72, 0.1)',
      iconColor: '#e11d48',
    },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      <div
        className="card border-0 p-4 rounded-4 text-white shadow-sm"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
        }}
      >
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
          <div>
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 small fw-bold mb-2">
              <span>HỆ THỐNG QUẢN TRỊ ĐỘC LẬP</span>
            </div>
            <h3 className="fw-bold mb-1 text-white">Bảng điều khiển Quản trị viên (Admin Console)</h3>
            <p className="text-white text-opacity-75 small mb-0">
              Giám sát toàn bộ dữ liệu thực tế từ PostgreSQL: người dùng, chủ đề, bộ thẻ mẫu, bài học Shadowing hội thoại A/B và giám sát Gemini AI.
            </p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-3 bg-success bg-opacity-25 border border-success border-opacity-25 text-white small">
              <CheckCircle2 size={16} className="text-success" />
              <span>
                Trạng thái AI: <strong>{stats?.aiStatus || 'OPERATIONAL'}</strong>
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 px-3 py-2"
              onClick={fetchAdminStats}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spinner-border spinner-border-sm' : ''} />
              <span>Làm mới số liệu</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Balanced Metric Cards (No empty gap after removing System Vocab) */}
      <div className="row g-4">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-label">{card.label}</span>
                  <div
                    className="stat-card-icon"
                    style={{ backgroundColor: card.iconBg, color: card.iconColor }}
                  >
                    <Icon size={20} />
                  </div>
                </div>

                <div className="d-flex align-items-baseline gap-2 flex-wrap">
                  <span className="stat-card-value" style={{ color: card.valueColor }}>
                    {loading ? '—' : Number(card.value).toLocaleString('vi-VN')}
                  </span>
                  <span className="small fw-semibold text-muted">{card.unit}</span>
                </div>

                <div className="stat-card-meta">{card.meta}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Navigation Grid */}
      <div className="card pq-card p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4 pb-2 border-bottom">
          <div>
            <h5 className="fw-bold text-dark mb-1">Phân hệ quản trị chức năng</h5>
            <p className="text-muted small mb-0">
              Chọn khu vực quản lý nội dung, người dùng và giám sát hệ thống
            </p>
          </div>
        </div>

        <div className="row g-3">
          {navModules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} className="col-12 col-md-6 col-xl-3">
                <Link
                  to={mod.to}
                  className="card pq-card-interactive p-4 text-decoration-none text-dark h-100 d-flex flex-column justify-content-between gap-3"
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                      <div
                        className="stat-card-icon"
                        style={{ backgroundColor: mod.iconBg, color: mod.iconColor }}
                      >
                        <Icon size={20} />
                      </div>
                      <ArrowRight size={16} className="text-muted" />
                    </div>
                    <h6 className="fw-bold text-dark mb-2">{mod.title}</h6>
                    <p className="small text-muted mb-0" style={{ lineHeight: 1.5 }}>
                      {mod.desc}
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
