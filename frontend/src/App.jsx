import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'ADMIN' ? <Navigate to="/admin" replace /> : <Navigate to="/app/dashboard" replace />;
}

// Layouts
import PublicLayout from './layouts/PublicLayout';
import UserLayout from './layouts/UserLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth Route Guards
import ProtectedRoute from './auth/ProtectedRoute';
import AdminRoute from './auth/AdminRoute';

// Public Pages
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import ForgotPassword from './pages/public/ForgotPassword';
import ResetPassword from './pages/public/ResetPassword';

// User Pages
import Dashboard from './pages/user/Dashboard';
import Recognize from './pages/user/Recognize';
import MyVocab from './pages/user/MyVocab';
import Decks from './pages/user/Decks';
import DeckDetail from './pages/user/DeckDetail';
import ImportDeck from './pages/user/ImportDeck';
import StudySrs from './pages/user/StudySrs';
import Quiz from './pages/user/Quiz';
import ShadowingList from './pages/user/ShadowingList';
import ShadowingPractice from './pages/user/ShadowingPractice';
import ShadowingHistory from './pages/user/ShadowingHistory';
import ConversationRoom from './pages/user/ConversationRoom';
import ConversationHistory from './pages/user/ConversationHistory';
import Profile from './pages/user/Profile';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/Users';
import AdminTopics from './pages/admin/Topics';
import AdminDecks from './pages/admin/Decks';
import AdminShadowingLessons from './pages/admin/ShadowingLessons';
import AdminConversationTopics from './pages/admin/ConversationTopics';
import AdminAiLogs from './pages/admin/AiLogs';
import AdminSettings from './pages/admin/Settings';
import AdminAuditLogs from './pages/admin/AuditLogs';

function App() {
  return (
    <Routes>
      {/* Root redirect based on authentication & role */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Authentication routes */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Protected User Routes (/app/*) - strictly USER only */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<UserLayout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="recognize" element={<Recognize />} />
          <Route path="my-vocab" element={<MyVocab />} />
          <Route path="decks" element={<Decks />} />
          <Route path="decks/:id" element={<DeckDetail />} />
          <Route path="decks/:id/import" element={<ImportDeck />} />
          <Route path="decks/:id/study" element={<StudySrs />} />
          <Route path="decks/:id/quiz" element={<Quiz />} />
          <Route path="shadowing" element={<ShadowingList />} />
          <Route path="shadowing/practice/:id" element={<ShadowingPractice />} />
          <Route path="shadowing/history" element={<ShadowingHistory />} />
          <Route path="conversation" element={<ConversationRoom />} />
          <Route path="conversation/history" element={<ConversationHistory />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Protected Admin Routes (/admin/*) - strictly ADMIN only */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="topics" element={<AdminTopics />} />
          <Route path="vocab" element={<Navigate to="/admin/topics" replace />} />
          <Route path="decks" element={<AdminDecks />} />
          <Route path="shadowing" element={<AdminShadowingLessons />} />
          <Route path="conversation-topics" element={<AdminConversationTopics />} />
          <Route path="ai-logs" element={<AdminAiLogs />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default App;
