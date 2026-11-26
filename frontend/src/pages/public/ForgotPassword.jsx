import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Mail, ArrowRight, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setLoading(true);

    try {
      const res = await axiosClient.post('/auth/forgot-password', { email });
      if (res.success) {
        setStatus({
          type: 'success',
          message: res.message || 'Yêu cầu đặt lại mật khẩu đã được xử lý thành công!',
        });
        if (res.data?.resetToken) {
          setResetToken(res.data.resetToken);
        }
      }
    } catch (err) {
      setStatus({
        type: 'danger',
        message: err.response?.data?.message || err.message || 'Không thể xử lý yêu cầu.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card border-0 shadow-lg p-4 p-md-5 rounded-4 bg-white">
      <div className="text-center mb-4">
        <h2 className="fw-bold text-dark mb-1">Quên mật khẩu</h2>
        <p className="text-muted small">Nhập email đăng ký để nhận mã đặt lại mật khẩu</p>
      </div>

      {status.message && (
        <div className={`alert alert-${status.type} d-flex align-items-center gap-2 py-2 px-3 small rounded-3`} role="alert">
          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <div>{status.message}</div>
        </div>
      )}

      {resetToken ? (
        <div className="p-3 bg-light rounded-3 text-center mb-3">
          <p className="small text-muted mb-2">Mã token đặt lại mật khẩu của bạn:</p>
          <code className="d-block p-2 bg-white border rounded text-primary fw-bold text-break mb-3">
            {resetToken}
          </code>
          <Link
            to={`/reset-password?token=${resetToken}`}
            className="btn btn-sky btn-sm w-100 py-2 d-inline-flex align-items-center justify-content-center gap-2"
          >
            <span>Tiếp tục đặt lại mật khẩu</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="form-label small fw-semibold text-secondary">Email của bạn</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Mail size={18} />
              </span>
              <input
                type="email"
                className="form-control bg-light border-start-0 ps-1"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                <span>Đang gửi yêu cầu...</span>
              </>
            ) : (
              <>
                <span>Gửi yêu cầu đặt lại mật khẩu</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}

      <div className="text-center mt-4 pt-2 border-top">
        <Link to="/login" className="d-inline-flex align-items-center gap-1 small text-muted text-decoration-none">
          <ArrowLeft size={16} /> Quay lại trang đăng nhập
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
