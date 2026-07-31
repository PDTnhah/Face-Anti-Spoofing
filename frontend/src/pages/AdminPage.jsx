/**
 * AdminPage — Trang quản trị: nhập API Key, xem/thêm/xóa user
 */
import { useState, useCallback, useEffect } from 'react';
import UserList from '../components/UserList';
import RegisterForm from '../components/RegisterForm';
import { fetchUsers, deleteUser } from '../api/faceApi';

export default function AdminPage() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('adminKey') || '');
  const [keyInput, setKeyInput] = useState(apiKey);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [users, setUsers] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const loadUsers = useCallback(async (key) => {
    setLoadingUsers(true);
    setError(null);
    try {
      const data = await fetchUsers(key);
      setUsers(data.users);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message);
      setIsAuthenticated(false);
      setUsers(null);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Auto-login nếu đã có key trong sessionStorage
  useEffect(() => {
    if (apiKey) loadUsers(apiKey);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key) return;
    setApiKey(key);
    sessionStorage.setItem('adminKey', key);
    loadUsers(key);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminKey');
    setApiKey('');
    setKeyInput('');
    setIsAuthenticated(false);
    setUsers(null);
    setError(null);
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Xác nhận xóa "${userName}" khỏi hệ thống?`)) return;
    setDeletingId(userId);
    try {
      await deleteUser(apiKey, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert(`Lỗi xóa: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Chưa đăng nhập ────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <main className="page-center" style={{ justifyContent: 'center', minHeight: 'calc(100vh - 70px)' }}>
        <div className="glass-card-elevated fade-in" style={{ width: '100%', maxWidth: 420, padding: 36 }}>
          {/* Icon */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 'var(--radius-lg)',
              background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, margin: '0 auto 16px',
              boxShadow: 'var(--accent-glow)',
            }}>
              🔐
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              Admin Dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Nhập Admin API Key để tiếp tục
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-key-input"
                className={`input input-password`}
                type={showKey ? 'text' : 'password'}
                placeholder="Nhập Admin API Key..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                autoComplete="off"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, padding: 4,
                }}
                title={showKey ? 'Ẩn key' : 'Hiện key'}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>

            {error && (
              <div className="fade-in" style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13,
                background: 'var(--danger-bg)', color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}>
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loadingUsers || !keyInput.trim()}
            >
              {loadingUsers
                ? <><span className="spinner" /> Đang xác thực...</>
                : '🔓 Đăng nhập'}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            Key được lưu trong session và xóa khi đóng tab.<br/>
            Tìm key trong file <code style={{ color: 'var(--accent-secondary)' }}>.env</code> tại server.
          </p>
        </div>
      </main>
    );
  }

  // ─── Đã đăng nhập ──────────────────────────────────────
  return (
    <main className="page" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 800,
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Admin Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Quản lý danh tính khuôn mặt trong hệ thống
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge badge-success">🟢 Đã xác thực</span>
          <button className="btn btn-ghost btn-sm" onClick={() => loadUsers(apiKey)} disabled={loadingUsers}>
            {loadingUsers ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '🔄 Làm mới'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            🚪 Đăng xuất
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Left: User list */}
        <div>
          {loadingUsers && !users ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
              <span className="spinner" style={{ margin: '0 auto', display: 'block', width: 32, height: 32 }} />
              <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Đang tải danh sách...</p>
            </div>
          ) : (
            <UserList
              users={users}
              onDelete={handleDelete}
              deleting={deletingId}
            />
          )}
        </div>

        {/* Right: Register form */}
        <div>
          <RegisterForm
            apiKey={apiKey}
            onSuccess={() => loadUsers(apiKey)}
          />

          {/* Info box */}
          <div className="glass-card" style={{ padding: 18, marginTop: 16 }}>
            <p className="section-title">ℹ️ Lưu ý quan trọng</p>
            <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 16 }}>
              <li>Ảnh gốc <strong>không lưu</strong> trên server</li>
              <li>Chỉ lưu vector embedding (512 chiều)</li>
              <li>Tên định danh: không dấu, dùng underscore</li>
              <li>Đăng ký trùng tên sẽ <strong>ghi đè</strong> dữ liệu cũ</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
