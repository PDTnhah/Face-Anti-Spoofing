/**
 * UserList — Bảng danh sách người dùng trong DB (Admin only)
 */
export default function UserList({ users, onDelete, deleting }) {
  if (!users) return null;

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="section-title" style={{ marginBottom: 0 }}>👥 Danh sách người dùng</p>
        <span className="badge badge-info">{users.length} người</span>
      </div>

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <div>Chưa có người dùng nào trong hệ thống</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onDelete={onDelete}
              isDeleting={deleting === user.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, onDelete, isDeleting }) {
  const initials = user.name.slice(0, 2).toUpperCase();
  const createdDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('vi-VN')
    : '—';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        transition: 'all var(--transition)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
    >
      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--accent-gradient)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
          {user.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          ID: {user.id} · Đăng ký: {createdDate}
        </div>
      </div>

      {/* Delete button */}
      <button
        className="btn btn-danger btn-sm"
        onClick={() => onDelete(user.id, user.name)}
        disabled={isDeleting}
        title={`Xóa ${user.name}`}
      >
        {isDeleting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '🗑️ Xóa'}
      </button>
    </div>
  );
}
