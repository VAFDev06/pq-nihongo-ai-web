import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/app/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user?.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        const target = from && from.startsWith('/app') ? from : '/app/dashboard';
        navigate(target, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Email hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card saas-card border-0 p-4 p-md-5 rounded-4 bg-white shadow-lg">
      <div className="text-center mb-4">
        <h2 className="fw-bold text-dark mb-1" style={{ letterSpacing: '-0.02em' }}>Đăng nhập</h2>
        <p className="text-muted small">Chào mừng bạn quay trở lại với PQ Nihongo AI</p>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-4" role="alert">
          <AlertCircle size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Địa chỉ Email</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0 text-muted">
              <Mail size={18} />
            </span>
            <input
              type="email"
              className="form-control bg-light border-start-0 ps-1"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <label className="form-label small fw-semibold text-secondary">Mật khẩu</label>
            <Link to="/forgot-password" style={{ fontSize: '0.8rem' }} className="text-decoration-none text-primary fw-medium">
              Quên mật khẩu?
            </Link>
          </div>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0 text-muted">
              <Lock size={18} />
            </span>
            <input
              type="password"
              className="form-control bg-light border-start-0 ps-1"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-saas-primary w-100 py-2.5 d-flex align-items-center justify-content-center gap-2 mt-4"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spinner-border spinner-border-sm" />
              <span>Đang xác thực...</span>
            </>
          ) : (
            <>
              <span>Đăng nhập hệ thống</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-4 pt-2 border-top">
        <span className="text-muted small">Chưa có tài khoản? </span>
        <Link to="/register" className="fw-semibold text-decoration-none text-primary">
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
};

export default Login;
