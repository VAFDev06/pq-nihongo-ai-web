import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

export const AdminSettings = () => {
  const [settingsList, setSettingsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/settings');
      if (res.success && Array.isArray(res.data)) {
        setSettingsList(res.data);
      }
    } catch (err) {
      console.error('Fetch settings failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key, newValue) => {
    setSettingsList((prev) =>
      prev.map((item) => {
        const k = item.key || item.settingKey;
        return k === key ? { ...item, value: newValue, settingValue: newValue } : item;
      })
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setSaving(true);

    try {
      const payload = settingsList.map((item) => ({
        settingKey: item.key || item.settingKey,
        settingValue: String(item.value ?? item.settingValue ?? ''),
      }));

      const res = await axiosClient.put('/admin/settings', payload);
      if (res.success) {
        setStatus({ type: 'success', message: 'Đã lưu cấu hình hệ thống vào PostgreSQL thành công!' });
        fetchSettings();
      }
    } catch (err) {
      setStatus({
        type: 'danger',
        message: err.response?.data?.message || 'Cập nhật cấu hình thất bại.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: '860px' }}>
      <div>
        <h3 className="fw-bold mb-1 text-dark">Cấu hình tham số hệ thống</h3>
        <p className="text-muted small mb-0">
          Quản lý trực tiếp các khóa cấu hình trong bảng <code>system_settings</code> (Model Gemini AI, hạn mức gọi AI, giới hạn SRS)
        </p>
      </div>

      {status.message && (
        <div className={`alert alert-${status.type} d-flex align-items-center gap-2 py-2 px-3 small rounded-3`}>
          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <div>{status.message}</div>
        </div>
      )}

      <div className="card pq-card p-4">
        {loading ? (
          <div className="text-center py-4 text-muted">Đang tải cấu hình hệ thống...</div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="d-flex flex-column gap-3 mb-4">
              {settingsList.map((item) => {
                const k = item.key || item.settingKey;
                const val = item.value ?? item.settingValue ?? '';
                return (
                  <div key={k} className="p-3 bg-light rounded-3 border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label fw-bold text-dark mb-0 font-monospace small">{k}</label>
                      {item.updatedAt && (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Cập nhật: {new Date(item.updatedAt).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                    {item.description && <div className="small text-muted mb-2">{item.description}</div>}
                    <input
                      type="text"
                      className="form-control"
                      value={val}
                      onChange={(e) => handleChange(k, e.target.value)}
                      required
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              disabled={saving}
            >
              <Save size={18} />
              <span>{saving ? 'Đang lưu...' : 'Lưu toàn bộ cấu hình'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
