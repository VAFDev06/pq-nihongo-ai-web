import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  BookMarked,
  Layers,
  Mic,
  MessageSquare,
  User,
} from 'lucide-react';

export const Sidebar = ({ onCloseMobile }) => {
  const mainNav = [
    { to: '/app/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/app/recognize', label: 'Nhận diện ảnh AI', icon: Camera, badge: 'AI' },
    { to: '/app/my-vocab', label: 'Sổ từ vựng', icon: BookMarked },
    { to: '/app/decks', label: 'Bộ thẻ & Ôn tập SRS', icon: Layers },
    { to: '/app/shadowing', label: 'Luyện Shadowing', icon: Mic },
    { to: '/app/conversation', label: 'Hội thoại AI 1-1', icon: MessageSquare, badge: 'AI' },
    { to: '/app/profile', label: 'Hồ sơ cá nhân', icon: User },
  ];

  return (
    <aside className="d-flex flex-column flex-shrink-0 p-3 bg-white border-end" style={{ width: '260px', height: '100%', minHeight: 'calc(100vh - 57px)' }}>
      <div className="small text-uppercase fw-bold text-muted px-3 mb-2" style={{ letterSpacing: '0.06em', fontSize: '0.72rem' }}>
        Không gian học tập
      </div>
      <ul className="nav nav-pills flex-column mb-auto gap-1">
        {mainNav.map((item) => {
          const Icon = item.icon;
          return (
            <li className="nav-item" key={item.to}>
              <NavLink
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `nav-link d-flex align-items-center justify-content-between px-3 py-2 fw-medium rounded-3 ${
                    isActive
                      ? 'active bg-primary text-white shadow-xs'
                      : 'text-secondary hover-bg-subtle'
                  }`
                }
                style={({ isActive }) => ({
                  transition: 'all 0.15s ease',
                  fontSize: '0.9rem',
                })}
              >
                <div className="d-flex align-items-center gap-3">
                  <Icon size={18} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className="badge rounded-pill fw-bold"
                    style={{
                      background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                      fontSize: '0.62rem',
                      padding: '2px 6px',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default Sidebar;
