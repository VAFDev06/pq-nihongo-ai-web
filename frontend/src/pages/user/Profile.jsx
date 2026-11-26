import React, { useState, useRef } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../auth/AuthContext';
import { TTS_SPEED_OPTIONS } from '../../utils/tts';
import {
  User,
  Mail,
  Lock,
  CheckCircle,
  AlertCircle,
  Save,
  Upload,
  Camera,
  Volume2,
  Loader2,
} from 'lucide-react';

export const Profile = () => {
  const { user, updateUser, ttsSpeed, updateTtsSpeed } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [targetJlptLevel, setTargetJlptLevel] = useState(user?.targetJlptLevel || user?.jlptLevel || 'N5');
  const [dailyTargetCards, setDailyTargetCards] = useState(user?.dailyTargetCards || user?.dailyGoalCards || 20);
  const [selectedSpeed, setSelectedSpeed] = useState(ttsSpeed || 1.15);

  // Upload avatar from computer
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileStatus({
        type: 'danger',
        message: 'Chỉ hỗ trợ tải lên ảnh định dạng JPG, PNG hoặc WEBP.',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileStatus({
        type: 'danger',
        message: 'Kích thước ảnh đại diện tối đa là 5MB.',
      });
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setAvatarPreview(localPreviewUrl);
    setUploadingAvatar(true);
    setProfileStatus({ type: '', message: '' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axiosClient.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success && res.data) {
        updateUser(res.data);
        setAvatarPreview(res.data.avatarUrl);
        setProfileStatus({
          type: 'success',
          message: 'Đã tải lên và cập nhật ảnh đại diện từ máy tính thành công!',
        });
      }
    } catch (err) {
      setProfileStatus({
        type: 'danger',
        message: err.response?.data?.message || 'Tải ảnh đại diện thất bại.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileStatus({ type: '', message: '' });
    setSavingProfile(true);

    try {
      const res = await axiosClient.put('/users/me', {
        fullName,
        targetJlptLevel,
        dailyTargetCards: parseInt(dailyTargetCards, 10),
        ttsSpeed: parseFloat(selectedSpeed),
      });

      if (res.success && res.data) {
        updateUser(res.data);
        await updateTtsSpeed(parseFloat(selectedSpeed));
        setProfileStatus({ type: 'success', message: 'Cập nhật thông tin hồ sơ & thiết lập học tập thành công!' });
      }
    } catch (err) {
      setProfileStatus({
        type: 'danger',
        message: err.response?.data?.message || 'Cập nhật hồ sơ thất bại.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', message: '' });

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'danger', message: 'Mật khẩu xác nhận không khớp' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'danger', message: 'Mật khẩu mới phải từ 6 ký tự trở lên' });
      return;
    }

    setSavingPassword(true);

    try {
      const res = await axiosClient.post('/users/me/change-password', {
        oldPassword,
        newPassword,
      });

      if (res.success) {
        setPasswordStatus({ type: 'success', message: 'Đổi mật khẩu thành công!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordStatus({
        type: 'danger',
        message: err.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h3 className="fw-bold mb-1">Hồ sơ cá nhân & Cài đặt học tập</h3>
        <p className="text-muted small mb-0">
          Quản lý ảnh đại diện, thông tin tài khoản, mục tiêu học tập và tốc độ giọng đọc tiếng Nhật
        </p>
      </div>

      <div className="row g-4">
        {/* Profile Settings */}
        <div className="col-12 col-lg-7">
          <div className="card pq-card p-4">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <User size={20} className="text-primary" /> Thông tin tài khoản
            </h5>

            {profileStatus.message && (
              <div className={`alert alert-${profileStatus.type} d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-3`}>
                {profileStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <div>{profileStatus.message}</div>
              </div>
            )}

            {/* Avatar Upload from Computer */}
            <div className="p-3 bg-light rounded-4 border mb-4 d-flex flex-column flex-sm-row align-items-center gap-3">
              <div className="position-relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={fullName}
                    className="rounded-circle border shadow-sm"
                    style={{ width: '88px', height: '88px', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white fw-bold fs-2 shadow-sm"
                    style={{ width: '88px', height: '88px' }}
                  >
                    {fullName?.charAt(0) || 'U'}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-circle position-absolute bottom-0 end-0 p-1.5 shadow"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Tải ảnh đại diện từ máy tính"
                >
                  <Camera size={14} />
                </button>
              </div>

              <div className="text-center text-sm-start flex-grow-1">
                <div className="fw-bold text-dark mb-1">Ảnh đại diện cá nhân</div>
                <div className="small text-muted mb-2">
                  Tải ảnh trực tiếp từ máy tính của bạn (Hỗ trợ JPG, PNG, WEBP tối đa 5MB).
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="d-none"
                  onChange={handleAvatarFileChange}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 size={15} className="spinner-border spinner-border-sm" />
                      <span>Đang tải ảnh lên...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      <span>Chọn ảnh từ máy tính</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Địa chỉ Email</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0 text-muted">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    className="form-control bg-light border-start-0 ps-1"
                    value={user?.email || ''}
                    disabled
                  />
                </div>
                <div className="small text-muted mt-1">Email dùng để đăng nhập và không thể thay đổi.</div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Họ và tên</label>
                <input
                  type="text"
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold text-secondary">Mục tiêu JLPT</label>
                  <select
                    className="form-select"
                    value={targetJlptLevel}
                    onChange={(e) => setTargetJlptLevel(e.target.value)}
                  >
                    <option value="N5">N5 - Nhập môn & Cơ bản</option>
                    <option value="N4">N4 - Sơ cấp</option>
                    <option value="N3">N3 - Trung cấp</option>
                    <option value="N2">N2 - Trung cao</option>
                    <option value="N1">N1 - Cao cấp</option>
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold text-secondary">Mục tiêu ôn tập (thẻ/ngày)</label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    className="form-control"
                    value={dailyTargetCards}
                    onChange={(e) => setDailyTargetCards(e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold text-secondary d-flex align-items-center gap-1.5">
                  <Volume2 size={16} className="text-primary" />
                  <span>Tốc độ giọng đọc tiếng Nhật mặc định (Áp dụng toàn bộ ứng dụng)</span>
                </label>
                <select
                  className="form-select"
                  value={selectedSpeed}
                  onChange={(e) => setSelectedSpeed(parseFloat(e.target.value))}
                >
                  {TTS_SPEED_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="small text-muted mt-1">
                  Mặc định 1.15x giúp giọng đọc từ vựng, câu ví dụ, Shadowing và Hội thoại AI nhanh, tự nhiên như người Nhật.
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-sky d-inline-flex align-items-center gap-2"
                disabled={savingProfile}
              >
                <Save size={18} />
                <span>{savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Password Change */}
        <div className="col-12 col-lg-5">
          <div className="card pq-card p-4">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <Lock size={20} className="text-danger" /> Đổi mật khẩu
            </h5>

            {passwordStatus.message && (
              <div className={`alert alert-${passwordStatus.type} d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-3`}>
                {passwordStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <div>{passwordStatus.message}</div>
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">Mật khẩu mới</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold text-secondary">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-outline-danger d-inline-flex align-items-center gap-2"
                disabled={savingPassword}
              >
                <Lock size={18} />
                <span>{savingPassword ? 'Đang đổi...' : 'Cập nhật mật khẩu'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
