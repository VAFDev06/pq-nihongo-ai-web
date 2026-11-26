import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { setGlobalTtsSpeed, getGlobalTtsSpeed } from '../utils/tts';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('pq_theme') || 'light');
  const [ttsSpeed, setTtsSpeedState] = useState(getGlobalTtsSpeed());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pq_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const applyTtsSpeedFromUser = (userData) => {
    if (userData?.ttsSpeed) {
      const spd = parseFloat(userData.ttsSpeed);
      if (!Number.isNaN(spd) && spd >= 0.5 && spd <= 2.0) {
        setTtsSpeedState(spd);
        setGlobalTtsSpeed(spd);
      }
    }
  };

  const updateTtsSpeed = async (newSpeed) => {
    const spd = parseFloat(newSpeed);
    if (Number.isNaN(spd)) return;
    setTtsSpeedState(spd);
    setGlobalTtsSpeed(spd);
    setUser((prev) => (prev ? { ...prev, ttsSpeed: spd } : prev));
    if (token && user?.role === 'USER') {
      try {
        await axiosClient.patch('/users/me/tts-speed', { ttsSpeed: spd });
      } catch (err) {
        console.warn('Save TTS speed failed:', err);
      }
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await axiosClient.get('/users/me');
      if (res.success && res.data) {
        setUser(res.data);
        applyTtsSpeedFromUser(res.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Fetch profile failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await axiosClient.post('/auth/login', { email, password });
    if (res.success && res.data) {
      const { accessToken, refreshToken, user: userData } = res.data;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      setToken(accessToken);
      setUser(userData);
      applyTtsSpeedFromUser(userData);
      return userData;
    }
    throw new Error(res.message || 'Đăng nhập thất bại');
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await axiosClient.post('/auth/logout', { refreshToken });
      }
    } catch (err) {
      console.warn('Logout API call failed:', err);
    } finally {
      const savedTheme = localStorage.getItem('pq_theme');
      const savedSpeed = localStorage.getItem('pq_tts_speed');
      localStorage.clear();
      if (savedTheme) localStorage.setItem('pq_theme', savedTheme);
      if (savedSpeed) localStorage.setItem('pq_tts_speed', savedSpeed);
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const next = prev ? { ...prev, ...updatedFields } : null;
      if (next) applyTtsSpeedFromUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser,
        refreshProfile: fetchProfile,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
        isUser: user?.role === 'USER',
        theme,
        toggleTheme,
        ttsSpeed,
        updateTtsSpeed,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
