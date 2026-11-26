import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export const PublicLayout = () => {
  return (
    <div
      className="min-vh-100 d-flex flex-column justify-content-between"
      style={{
        background: 'linear-gradient(135deg, #f1f8fd 0%, #e0f2fe 100%)',
      }}
    >
      <header className="py-3 px-4">
        <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
          <img
            src="/logo.png"
            alt="PQ Nihongo AI"
            className="flex-shrink-0"
            style={{
              height: '46px',
              width: 'auto',
              objectFit: 'contain',
              borderRadius: '10px',
            }}
          />
          <div>
            <span className="fs-4 fw-bold" style={{ color: 'var(--ink)' }}>PQ </span>
            <span className="fs-4 fw-bold" style={{ color: 'var(--sky-d)' }}>Nihongo</span>
            <span className="badge bg-danger ms-1 fw-bold">AI</span>
          </div>
        </Link>
      </header>

      <main className="container my-auto py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-5">
            <Outlet />
          </div>
        </div>
      </main>

      <footer className="py-3 text-center text-muted small">
        &copy; {new Date().getFullYear()} PQ Nihongo AI - Đồ án 4 VKU.
      </footer>
    </div>
  );
};

export default PublicLayout;
