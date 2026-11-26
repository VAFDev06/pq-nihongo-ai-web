import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  LayoutDashboard,
  Users,
  Tags,
  Layers,
  Mic,
  MessageSquare,
  Activity,
  Settings,
  ShieldAlert,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';

export const AdminSidebar = ({ onCloseMobile }) => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminItems = [
    { to: '/admin', label: 'Tổng quan hệ thống', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Quản lý người dùng', icon: Users },
    { to: '/admin/topics', label: 'Quản lý Chủ đề', icon: Tags },
    { to: '/admin/decks', label: 'Bộ thẻ mẫu hệ thống', icon: Layers },
    { to: '/admin/shadowing', label: 'Shadowing Hội thoại', icon: Mic },
    { to: '/admin/conversation-topics', label: 'Chủ đề hội thoại AI', icon: MessageSquare },
    { to: '/admin/ai-logs', label: 'Giám sát Gemini AI', icon: Activity },
    { to: '/admin/settings', label: 'Cấu hình hệ thống', icon: Settings },
    { to: '/admin/audit-logs', label: 'Nhật ký kiểm toán', icon: ShieldAlert },
  ];

  return (
    <aside
      className="d-flex flex-column flex-shrink-0 p-3 text-white"
      style={{
        width: '270px',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="d-flex align-items-center justify-content-between px-2 mb-4 border-bottom border-secondary border-opacity-50 pb-3">
        <div className="d-flex align-items-center gap-3">
          <img
            src="/logo.png"
            alt="PQ Nihongo AI"
            className="rounded-3 shadow-sm flex-shrink-0 bg-white"
            style={{
              width: '44px',
              height: '38px',
              padding: '2px',
              objectFit: 'contain',
            }}
          />
          <div>
            <div className="fs-6 fw-bold text-white lh-1">PQ Nihongo</div>
            <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 mt-1" style={{ fontSize: '0.65rem' }}>
              ADMIN CONSOLE
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="btn btn-sm btn-outline-light rounded-circle p-2 border-secondary d-flex align-items-center justify-content-center"
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={15} className="text-warning" /> : <Moon size={15} />}
        </button>
      </div>

      <div className="small text-uppercase fw-bold text-secondary px-3 mb-2" style={{ letterSpacing: '0.06em', fontSize: '0.72rem' }}>
        Điều hành & Quản trị
      </div>

      <ul className="nav nav-pills flex-column mb-auto gap-1">
        {adminItems.map((item) => {
          const Icon = item.icon;
          return (
            <li className="nav-item" key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `nav-link admin-nav-link d-flex align-items-center gap-3 px-3 py-2 fw-medium rounded-3 ${
                    isActive
                      ? 'active bg-danger text-white shadow-sm'
                      : 'text-light text-opacity-75'
                  }`
                }
                style={{ fontSize: '0.9rem', transition: 'all 0.15s ease' }}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      {/* Admin Info & Logout Footer */}
      <div className="p-3 mt-4 rounded-3 border border-secondary border-opacity-50" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <div
            className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center fw-bold small flex-shrink-0"
            style={{ width: '34px', height: '34px' }}
          >
            {user?.fullName?.charAt(0) || 'A'}
          </div>
          <div className="overflow-hidden">
            <div className="fw-bold text-white small text-truncate">{user?.fullName || 'Quản trị viên'}</div>
            <div className="text-secondary text-truncate" style={{ fontSize: '0.75rem' }}>{user?.email}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2 mt-2 py-2"
        >
          <LogOut size={15} />
          <span>Đăng xuất Quản trị</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
