import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Lock, ArrowRight, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'danger', message: 'Mật khẩu xác nhận không khớp' });
      return;
    }

    if (newPassword.length < 6) {
      setStatus({ type: 'danger', message: 'Mật khẩu mới phải từ 6 ký tự trở lên' });
      return;
    }

    setLoading(true);

    try {
      const res = await axiosClient.post('/auth/reset-password', {
        token,
        newPassword,
      });

      if (res.success) {
        setStatus({
          type: 'success',
          message: 'Đặt lại mật khẩu thành công! Đang chuyển hướng đăng nhập...',
        });
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err) {
      setStatus({
        type: 'danger',
        message: err.response?.data?.message || err.message || 'Đặt lại mật khẩu thất bại.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card border-0 shadow-lg p-4 p-md-5 rounded-4 bg-white">
      <div className="text-center mb-4">
        <h2 className="fw-bold text-dark mb-1">Mật khẩu mới</h2>
        <p className="text-muted small">Nhập mã xác nhận và đặt mật khẩu mới của bạn</p>
      </div>

      {status.message && (
        <div className={`alert alert-${status.type} d-flex align-items-center gap-2 py-2 px-3 small rounded-3`} role="alert">
          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <div>{status.message}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Mã Token đặt lại mật khẩu</label>
          <input
            type="text"
            className="form-control bg-light"
            placeholder="Nhập mã token..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Mật khẩu mới</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0 text-muted">
              <Lock size={18} />
            </span>
            <input
              type="password"
              className="form-control bg-light border-start-0 ps-1"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label small fw-semibold text-secondary">Xác nhận mật khẩu mới</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0 text-muted">
              <Lock size={18} />
            </span>
            <input
              type="password"
              className="form-control bg-light border-start-0 ps-1"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-sky w-100 py-2 d-flex align-items-center justify-content-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spinner-border spinner-border-sm" />
              <span>Đang lưu mật khẩu...</span>
            </>
          ) : (
            <>
              <span>Xác nhận mật khẩu mới</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-4 pt-2 border-top">
        <Link to="/login" className="d-inline-flex align-items-center gap-1 small text-muted text-decoration-none">
          <ArrowLeft size={16} /> Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
