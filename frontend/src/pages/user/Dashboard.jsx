import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../auth/AuthContext';
import SrsOverviewModal from '../../components/srs/SrsOverviewModal';
import {
  Layers,
  BookMarked,
  Mic,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [showSrsOverview, setShowSrsOverview] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, chartRes] = await Promise.allSettled([
        axiosClient.get('/progress/dashboard'),
        axiosClient.get(`/progress/chart?range=${range}`),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value?.data) {
        setStats(dashRes.value.data);
      }

      if (chartRes.status === 'fulfilled' && Array.isArray(chartRes.value?.data)) {
        const formatted = chartRes.value.data.map((item) => ({
          date: item.dayOfWeek ? `${item.dayOfWeek} (${String(item.date || '').slice(5)})` : item.date,
          cardsReviewed: item.cardsReviewed || 0,
          wordsAdded: item.wordsAdded || 0,
          shadowingCount: item.shadowingCount || 0,
        }));
        setChartData(formatted);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error('Fetch dashboard failed:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const dailyTarget = stats?.dailyGoalCards || user?.dailyGoalCards || user?.dailyTargetCards || 20;
  const currentLevel = user?.jlptLevel || user?.targetJlptLevel || 'N5';
  const cardsReviewedToday = stats?.completedCardsToday ?? 0;
  const progressPercent = Math.min(100, Math.round((cardsReviewedToday / Math.max(1, dailyTarget)) * 100));

  return (
    <div className="d-flex flex-column gap-4">
      {/* Welcome & Goal Banner */}
      <div
        className="card border-0 p-4 p-md-5 rounded-4 text-white shadow-md position-relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #0284c7 100%)',
        }}
      >
        <div className="row align-items-center position-relative" style={{ zIndex: 1 }}>
          <div className="col-12 col-lg-8">
            <div
              className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill small mb-3 fw-medium"
              style={{
                background: 'rgba(255, 255, 255, 0.18)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
              }}
            >
              <Sparkles size={14} className="text-warning" />
              <span>Mục tiêu trình độ JLPT: <strong className="text-white fw-bold">{currentLevel}</strong></span>
            </div>
            <h2 className="fw-bold mb-2 text-white" style={{ letterSpacing: '-0.02em' }}>
              こんにちは, {user?.fullName || 'Học viên'}! 👋
            </h2>
            <p className="text-white text-opacity-90 mb-3 mb-lg-0" style={{ maxWidth: '560px', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Hệ thống học tiếng Nhật thông minh kết hợp ôn tập ngắt quãng SRS 6 cấp độ, luyện phát âm Shadowing hội thoại và Gia sư AI bằng giọng nói.
            </p>
          </div>

          <div className="col-12 col-lg-4">
            <div
              className="p-3.5 rounded-4 shadow-sm"
              style={{
                background: 'rgba(15, 23, 42, 0.35)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.28)',
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-semibold text-white">Tiến độ mục tiêu hôm nay</span>
                <span className="badge bg-warning text-dark fw-bold px-2.5 py-1">
                  {cardsReviewedToday} / {dailyTarget} thẻ
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                <div
                  className="bg-warning h-100"
                  role="progressbar"
                  style={{ width: `${progressPercent}%`, borderRadius: '4px', transition: 'width 0.4s ease' }}
                  aria-valuenow={progressPercent}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <div className="d-flex justify-content-between align-items-center small text-white text-opacity-90 mt-2">
                <span>{progressPercent}% hoàn thành</span>
                {progressPercent >= 100 ? (
                  <span className="d-flex align-items-center gap-1 text-warning fw-semibold">
                    <CheckCircle2 size={14} /> Đạt mục tiêu ngày!
                  </span>
                ) : (
                  <span>Còn {Math.max(0, dailyTarget - cardsReviewedToday)} thẻ</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Key Metric Cards (Real Database Numbers) */}
      <div className="row g-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Đến hạn hôm nay (SRS)</span>
              <div className="stat-card-icon bg-primary bg-opacity-10 text-primary">
                <Layers size={20} />
              </div>
            </div>
            <h3 className="stat-card-value text-primary">{stats?.dueCardsToday ?? 0}</h3>
            <div className="stat-card-meta">
              Tổng số thẻ: <strong className="text-dark">{stats?.totalSrsCards ?? 0}</strong> · Đã nhớ:{' '}
              <strong className="text-success">{stats?.rememberedSrsCards ?? 0}</strong>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Sổ từ cá nhân</span>
              <div className="stat-card-icon bg-success bg-opacity-10 text-success">
                <BookMarked size={20} />
              </div>
            </div>
            <h3 className="stat-card-value text-success">{stats?.totalSavedWords ?? 0}</h3>
            <div className="stat-card-meta">Từ vựng cá nhân đã lưu trong PostgreSQL</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Luyện Shadowing</span>
              <div className="stat-card-icon bg-warning bg-opacity-10 text-warning">
                <Mic size={20} />
              </div>
            </div>
            <h3 className="stat-card-value text-warning">{stats?.averageShadowingAccuracy ?? 0}%</h3>
            <div className="stat-card-meta">Độ chính xác phát âm trung bình</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Hoạt động AI</span>
              <div className="stat-card-icon bg-info bg-opacity-10 text-info">
                <MessageSquare size={20} />
              </div>
            </div>
            <h3 className="stat-card-value text-info">
              {(stats?.totalConversations ?? 0) + (stats?.totalRecognitions ?? 0)}
            </h3>
            <div className="stat-card-meta">
              <strong className="text-dark">{stats?.totalConversations ?? 0}</strong> hội thoại ·{' '}
              <strong className="text-dark">{stats?.totalRecognitions ?? 0}</strong> quét ảnh
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized 3-Metric SRS Status Bar (100% matched with SRS Overview & PostgreSQL) */}
      <div className="card saas-card p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div className="d-flex align-items-center gap-2">
            <Layers size={18} className="text-primary" />
            <h6 className="fw-bold text-dark mb-0">Trạng thái Ôn tập ngắt quãng (SRS 6 cấp độ)</h6>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm px-3 py-2 fw-semibold"
              onClick={() => setShowSrsOverview(true)}
            >
              Ôn tập tất cả thẻ đến hạn ({stats?.dueCardsToday ?? 0}) →
            </button>
          </div>
        </div>

        <div className="row g-3 text-center">
          <div className="col-12 col-md-4">
            <div className="p-3.5 rounded-3 bg-light border h-100">
              <div className="small text-muted fw-semibold mb-1">Tổng số thẻ</div>
              <div className="fs-3 fw-bold text-dark">{stats?.totalSrsCards ?? 0}</div>
              <div className="small text-muted">Toàn bộ thẻ đang học trong hệ thống SRS</div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="p-3.5 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25 h-100">
              <div className="small text-success fw-semibold mb-1">Đã nhớ</div>
              <div className="fs-3 fw-bold text-success">{stats?.rememberedSrsCards ?? 0}</div>
              <div className="small text-muted">Thẻ đạt Level 5 (Đã thuộc vĩnh viễn)</div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="p-3.5 rounded-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 h-100">
              <div className="small text-primary fw-semibold mb-1">Đến hạn hôm nay</div>
              <div className="fs-3 fw-bold text-primary">{stats?.dueCardsToday ?? 0}</div>
              <div className="small text-muted">Thẻ Level 1–4 đã tới thời điểm cần ôn</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Activity Chart & Quick Learning Actions */}
      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <div className="card saas-card p-4 h-100">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
              <div>
                <h5 className="fw-bold mb-0 text-dark">Biểu đồ tiến độ học tập thực tế</h5>
                <p className="text-muted small mb-0">Thống kê trực tiếp từ dữ liệu ôn tập của bạn trong PostgreSQL</p>
              </div>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={`btn ${range === '7d' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setRange('7d')}
                >
                  7 ngày
                </button>
                <button
                  type="button"
                  className={`btn ${range === '30d' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setRange('30d')}
                >
                  30 ngày
                </button>
              </div>
            </div>

            <div style={{ width: '100%', height: 270 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                  <Bar dataKey="cardsReviewed" name="Thẻ SRS đã ôn" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="wordsAdded" name="Từ vựng mới lưu" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="shadowingCount" name="Lượt luyện nói" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card saas-card p-4 h-100 d-flex flex-column">
            <h5 className="fw-bold mb-3 text-dark">Chức năng học nhanh</h5>

            <div className="d-flex flex-column gap-2.5 flex-grow-1">
              <Link
                to="/app/decks"
                className="p-3 rounded-3 text-decoration-none d-flex align-items-center justify-content-between border"
                style={{
                  backgroundColor: 'var(--primary-light)',
                  borderColor: 'var(--primary-border)',
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-white text-primary rounded-3 shadow-xs">
                    <Layers size={20} />
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.925rem' }}>Bộ thẻ & Ôn tập SRS</div>
                    <div className="small text-muted">{stats?.dueCardsToday ?? 0} thẻ đến hạn ôn hôm nay</div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-primary" />
              </Link>

              <Link
                to="/app/my-vocab"
                className="p-3 rounded-3 text-decoration-none d-flex align-items-center justify-content-between border bg-light"
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-white text-success rounded-3 shadow-xs">
                    <BookMarked size={20} />
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.925rem' }}>Sổ từ vựng cá nhân</div>
                    <div className="small text-muted">Tìm nhanh & thêm hàng loạt vào SRS</div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-success" />
              </Link>

              <Link
                to="/app/shadowing"
                className="p-3 rounded-3 text-decoration-none d-flex align-items-center justify-content-between border bg-light"
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-white text-warning rounded-3 shadow-xs">
                    <Mic size={20} />
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.925rem' }}>Luyện nói Shadowing</div>
                    <div className="small text-muted">Hội thoại A/B, YouTube & Tự nhập</div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-warning" />
              </Link>

              <Link
                to="/app/conversation"
                className="p-3 rounded-3 text-decoration-none d-flex align-items-center justify-content-between border bg-light"
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-white text-info rounded-3 shadow-xs">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.925rem' }}>Hội thoại AI 1-1</div>
                    <div className="small text-muted">Luyện nói Voice Mode & sửa ngữ pháp</div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-info" />
              </Link>

              <Link
                to="/app/recognize"
                className="p-3 rounded-3 text-decoration-none d-flex align-items-center justify-content-between border bg-light"
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-white text-danger rounded-3 shadow-xs">
                    <Camera size={20} />
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '0.925rem' }}>Nhận diện ảnh AI</div>
                    <div className="small text-muted">Trích xuất từ vựng tiếng Nhật từ ảnh</div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-danger" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* SRS Overview Modal (6-level chart + vocabulary list + review launcher) */}
      <SrsOverviewModal
        show={showSrsOverview}
        onClose={() => setShowSrsOverview(false)}
        onStatsChanged={fetchDashboard}
      />
    </div>
  );
};

export default Dashboard;
