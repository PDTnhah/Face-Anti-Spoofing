/**
 * LogPanel — Hiển thị log hệ thống theo thời gian thực
 */
import { useEffect, useRef } from 'react';

export default function LogPanel({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getClass = (type) => {
    switch (type) {
      case 'approved': return 'log-msg-approved';
      case 'denied': return 'log-msg-denied';
      case 'warning': return 'log-msg-warning';
      default: return 'log-msg-info';
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 640, marginTop: 16 }}>
      <p className="section-title">Log hệ thống</p>
      <div className="log-panel">
        {logs.length === 0 && (
          <span style={{ color: 'var(--text-muted)' }}>Chờ hoạt động...</span>
        )}
        {logs.map((entry, i) => (
          <div key={i} className="log-entry">
            <span className="log-time">[{entry.time}]</span>
            <span className={getClass(entry.type)}>{entry.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
