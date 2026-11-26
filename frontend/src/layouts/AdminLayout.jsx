import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/common/AdminSidebar';
import { Menu, Shield } from 'lucide-react';

export const AdminLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-vh-100 d-flex flex-column flex-lg-row" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Mobile Header for Admin */}
      <div className="d-flex d-lg-none align-items-center justify-content-between px-3 py-2 bg-dark text-white border-bottom border-secondary">
        <div className="d-flex align-items-center gap-2">
          <Shield size={18} className="text-danger" />
          <span className="fw-bold">PQ Nihongo Admin</span>
        </div>
        <button className="btn btn-sm btn-outline-light" onClick={() => setMobileOpen(!mobileOpen)}>
          <Menu size={18} />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-lg-none"
          style={{ zIndex: 1040 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`position-fixed top-0 start-0 h-100 d-lg-none ${mobileOpen ? 'd-block' : 'd-none'}`}
        style={{ zIndex: 1050 }}
      >
        <AdminSidebar onCloseMobile={() => setMobileOpen(false)} />
      </div>

      <div className="d-none d-lg-block">
        <AdminSidebar />
      </div>

      <main className="flex-grow-1 p-3 p-md-4 overflow-auto" style={{ maxHeight: '100vh' }}>
        <div className="container-fluid px-0" style={{ maxWidth: '1400px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
