import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Mail, Lock, User, Target, ArrowRight, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    targetJlptLevel: 'N5',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (formData.password.length < 8) {
      setError('Mật khẩu tối thiểu phải từ 8 ký tự trở lên');
      return;
    }

    setLoading(true);

    try {
      const res = await axiosClient.post('/auth/register', {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        targetJlptLevel: formData.targetJlptLevel,
      });

      if (res.success) {
        setSuccess('Đăng ký tài khoản thành công! Đang chuyển hướng sang trang đăng nhập...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card saas-card border-0 p-4 p-md-5 rounded-4 bg-white shadow-lg">
      <div className="text-center mb-4">
        <h2 className="fw-bold text-dark mb-1" style={{ letterSpacing: '-0.02em' }}>Tạo tài khoản mới</h2>
        <p className="text-muted small">Bắt đầu hành trình chinh phục tiếng Nhật cùng AI</p>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-3" role="alert">
          <AlertCircle size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-3" role="alert">
          <CheckCircle size={18} className="flex-shrink-0" />
          <div>{success}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Họ và tên</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0 text-muted">
              <User size={18} />
            </span>
            <input
              type="text"
              name="fullName"
              className="form-control bg-light border-start-0 ps-1"
              placeholder="Nguyễn Văn A"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Địa chỉ Email</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0 text-muted">
              <Mail size={18} />
            </span>
            <input
              type="email"
              name="email"
              className="form-control bg-light border-start-0 ps-1"
              placeholder="example@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold text-secondary">Mật khẩu (8+ ký tự)</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Lock size={18} />
              </span>
              <input
                type="password"
                name="password"
                className="form-control bg-light border-start-0 ps-1"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold text-secondary">Xác nhận mật khẩu</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Lock size={18} />
              </span>
              <input
                type="password"
                name="confirmPassword"
                className="form-control bg-light border-start-0 ps-1"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label small fw-semibold text-secondary">Mục tiêu trình độ JLPT</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0 text-muted">
              <Target size={18} />
            </span>
            <select
              name="targetJlptLevel"
              className="form-select bg-light border-start-0 ps-1"
              value={formData.targetJlptLevel}
              onChange={handleChange}
            >
              <option value="N5">N5 - Nhập môn (Sơ cấp)</option>
              <option value="N4">N4 - Cơ bản (Sơ trung cấp)</option>
              <option value="N3">N3 - Trung cấp</option>
              <option value="N2">N2 - Trung cao cấp</option>
              <option value="N1">N1 - Cao cấp</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-saas-primary w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spinner-border spinner-border-sm" />
              <span>Đang tạo tài khoản...</span>
            </>
          ) : (
            <>
              <span>Đăng ký ngay</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-4 pt-2 border-top">
        <span className="text-muted small">Đã có tài khoản? </span>
        <Link to="/login" className="fw-semibold text-decoration-none text-primary">
          Đăng nhập
        </Link>
      </div>
    </div>
  );
};

export default Register;
