/**
 * ResultOverlay — Hiển thị kết quả nhận diện với animation
 */
const CONFIG = {
  approved: {
    icon: '✅',
    color: 'var(--success)',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.3)',
    glow: '0 0 40px rgba(34,197,94,0.2)',
    label: 'NHẬN DIỆN THÀNH CÔNG',
  },
  denied: {
    icon: '🚫',
    color: 'var(--danger)',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
    glow: '0 0 40px rgba(239,68,68,0.2)',
    label: 'PHÁT HIỆN GIẢ MẠO',
  },
  warning: {
    icon: '⚠️',
    color: 'var(--warning)',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    glow: '0 0 40px rgba(245,158,11,0.2)',
    label: 'KHÔNG XÁC ĐỊNH',
  },
  error: {
    icon: '❌',
    color: 'var(--text-muted)',
    bg: 'rgba(71,85,105,0.2)',
    border: 'rgba(71,85,105,0.3)',
    glow: 'none',
    label: 'LỖI HỆ THỐNG',
  },
};

export default function ResultOverlay({ result }) {
  if (!result) return null;

  const cfg = CONFIG[result.status] || CONFIG.error;

  return (
    <div
      className="fade-in"
      style={{
        width: '100%',
        maxWidth: 640,
        marginTop: 16,
        padding: '20px 24px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: cfg.glow,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{cfg.icon}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: cfg.color, textTransform: 'uppercase' }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {result.message}
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {result.identity && (
          <Metric label="Danh tính" value={result.identity} color={cfg.color} />
        )}
        {result.similarity !== undefined && (
          <Metric label="Độ tương đồng" value={`${(result.similarity * 100).toFixed(1)}%`} />
        )}
        {result.liveness_score !== undefined && (
          <Metric label="Liveness Score" value={result.liveness_score.toFixed(4)} />
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 120,
      padding: '10px 14px',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
    </div>
  );
}
