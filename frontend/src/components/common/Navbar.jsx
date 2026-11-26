import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { TTS_SPEED_OPTIONS } from '../../utils/tts';
import { LogOut, User, Flame, Menu, Sun, Moon, Volume2 } from 'lucide-react';

export const Navbar = ({ onToggleMobileSidebar }) => {
  const { user, logout, theme, toggleTheme, ttsSpeed, updateTtsSpeed } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentLevel = user?.targetJlptLevel || user?.jlptLevel || 'N5';
  const dailyTarget = user?.dailyTargetCards || user?.dailyGoalCards || 20;

  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top py-2 px-3 shadow-xs">
      <div className="container-fluid px-0">
        <div className="d-flex align-items-center gap-2">
          {onToggleMobileSidebar && (
            <button
              className="btn btn-light d-lg-none p-1 border rounded-3 text-secondary me-1"
              type="button"
              onClick={onToggleMobileSidebar}
              aria-label="Toggle Navigation"
            >
              <Menu size={20} />
            </button>
          )}

          <Link to="/app/dashboard" className="navbar-brand d-flex align-items-center gap-2 text-decoration-none py-0">
            <img
              src="/logo.png"
              alt="PQ Nihongo AI"
              className="flex-shrink-0"
              style={{
                height: '40px',
                width: 'auto',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            <div className="d-flex align-items-baseline gap-1">
              <span className="fs-5 fw-bold text-dark" style={{ letterSpacing: '-0.02em' }}>PQ</span>
              <span className="fs-5 fw-bold text-primary" style={{ letterSpacing: '-0.02em' }}>Nihongo</span>
              <span
                className="badge rounded-pill text-white fw-bold ms-1"
                style={{
                  background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                  fontSize: '0.62rem',
                  padding: '2px 7px',
                }}
              >
                AI
              </span>
            </div>
          </Link>
        </div>

        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* Global TTS Reading Speed Selector */}
          <div
            className="d-flex align-items-center gap-1.5 px-2.5 py-1 bg-light rounded-pill border small"
            title="Tốc độ đọc tiếng Nhật dùng chung trên toàn hệ thống (lưu theo tài khoản)"
          >
            <Volume2 size={15} className="text-primary flex-shrink-0" />
            <span className="d-none d-xl-inline text-secondary small">Tốc độ đọc:</span>
            <select
              className="form-select form-select-sm border-0 bg-transparent py-0 ps-1 pe-4 fw-bold text-primary shadow-none"
              style={{ width: 'auto', fontSize: '0.82rem', cursor: 'pointer' }}
              value={ttsSpeed}
              onChange={(e) => updateTtsSpeed(parseFloat(e.target.value))}
            >
              {TTS_SPEED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Daily target indicator */}
          <div className="d-none d-md-flex align-items-center gap-2 px-3 py-1 bg-light rounded-pill border text-secondary small">
            <Flame size={16} className="text-warning" />
            <span className="fw-semibold text-dark">Mục tiêu: {dailyTarget} thẻ/ngày</span>
          </div>

          {/* Theme toggle button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-light btn-sm rounded-circle p-2 border d-flex align-items-center justify-content-center"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
          >
            {theme === 'dark' ? <Sun size={16} className="text-warning" /> : <Moon size={16} className="text-secondary" />}
          </button>

          {/* User profile dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 border rounded-pill px-2.5 py-1 shadow-none"
              type="button"
              id="userMenuButton"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="rounded-circle border"
                  style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white small fw-bold"
                  style={{ width: '28px', height: '28px' }}
                >
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
              )}
              <span className="fw-semibold small d-none d-sm-inline text-dark">{user?.fullName || 'Học viên'}</span>
              <span className={`badge badge-${currentLevel.toLowerCase()} px-2 py-0.5`}>
                {currentLevel}
              </span>
            </button>

            <ul className="dropdown-menu dropdown-menu-end shadow-md border mt-2 rounded-3 py-2" aria-labelledby="userMenuButton" style={{ minWidth: '220px' }}>
              <li className="px-3 py-2 border-bottom">
                <div className="fw-bold text-dark">{user?.fullName}</div>
                <div className="text-muted small text-truncate" style={{ maxWidth: '190px' }}>{user?.email}</div>
                <div className="mt-1 d-flex align-items-center gap-1">
                  <span className={`badge badge-${currentLevel.toLowerCase()}`}>{currentLevel}</span>
                  <span className="small text-muted">Tài khoản Học viên</span>
                </div>
              </li>
              <li>
                <Link to="/app/profile" className="dropdown-item d-flex align-items-center gap-2 py-2 text-secondary">
                  <User size={16} /> Hồ sơ học tập
                </Link>
              </li>
              <li><hr className="dropdown-divider my-1" /></li>
              <li>
                <button onClick={handleLogout} className="dropdown-item d-flex align-items-center gap-2 py-2 text-danger fw-semibold">
                  <LogOut size={16} /> Đăng xuất
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
