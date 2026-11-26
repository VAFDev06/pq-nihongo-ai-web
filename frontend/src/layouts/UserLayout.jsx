import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';

export const UserLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--bg-app)' }}>
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-lg-none"
          style={{ zIndex: 1040 }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Offcanvas */}
      <div
        className={`position-fixed top-0 start-0 h-100 bg-white shadow-lg d-lg-none ${mobileSidebarOpen ? 'd-block' : 'd-none'}`}
        style={{ width: '280px', zIndex: 1050, transition: 'transform 0.3s ease' }}
      >
        <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
      </div>

      <div className="d-flex flex-grow-1">
        {/* Desktop Sidebar */}
        <div className="d-none d-lg-block">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        <main className="flex-grow-1 p-3 p-md-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 57px)' }}>
          <div className="container-fluid px-0" style={{ maxWidth: '1280px' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserLayout;
