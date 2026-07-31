/**
 * RegisterForm — Form đăng ký người dùng mới (Admin only)
 */
import { useState, useRef } from 'react';
import { registerUser } from '../api/faceApi';

export default function RegisterForm({ apiKey, onSuccess }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', msg }
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setFeedback(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !file) {
      setFeedback({ type: 'error', msg: 'Vui lòng nhập tên và chọn ảnh.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const data = await registerUser(apiKey, name.trim(), file);
      setFeedback({ type: 'success', msg: data.message });
      setName('');
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <p className="section-title">➕ Đăng ký người dùng mới</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Name input */}
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
            Tên định danh
          </label>
          <input
            className="input"
            type="text"
            placeholder="vd: nguyen_van_a (không dấu, không khoảng trắng)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* File picker */}
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
            Ảnh khuôn mặt
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${preview ? 'var(--accent-primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: 16,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all var(--transition)',
              background: preview ? 'rgba(108,99,255,0.05)' : 'transparent',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => !preview && (e.currentTarget.style.borderColor = 'rgba(108,99,255,0.5)')}
            onMouseLeave={e => !preview && (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            {preview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={preview}
                  alt="Preview"
                  style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)', opacity: 0, transition: 'opacity var(--transition)',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <span style={{ color: 'white', fontSize: 13 }}>Nhấn để đổi ảnh</span>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 14 }}>Nhấn để chọn ảnh JPG/PNG</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Ảnh cần rõ mặt, đủ ánh sáng</div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className="fade-in"
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              background: feedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            {feedback.type === 'success' ? '✅ ' : '❌ '}{feedback.msg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !name.trim() || !file}
        >
          {loading ? (
            <><span className="spinner" /> Đang xử lý...</>
          ) : (
            '➕ Đăng ký khuôn mặt'
          )}
        </button>
      </form>
    </div>
  );
}
