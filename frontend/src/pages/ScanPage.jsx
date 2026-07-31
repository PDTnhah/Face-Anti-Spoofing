/**
 * ScanPage — Trang chính: webcam scan + liveness + identity
 */
import { useRef, useState, useCallback } from 'react';
import CameraView from '../components/CameraView';
import ResultOverlay from '../components/ResultOverlay';
import LogPanel from '../components/LogPanel';
import { verifyFace } from '../api/faceApi';

export default function ScanPage() {
  const cameraRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [cameraReady, setCameraReady] = useState(false);
  const scanRef = useRef(false); // tránh race condition với closure

  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setLogs((prev) => [...prev.slice(-49), { time, msg, type }]);
  }, []);

  const handleCameraReady = useCallback((err) => {
    if (err) {
      addLog(err, 'error');
    } else {
      setCameraReady(true);
      addLog('Camera đã sẵn sàng.', 'info');
    }
  }, [addLog]);

  const stopScanning = useCallback(() => {
    scanRef.current = false;
    setIsScanning(false);
  }, []);

  const processFrame = useCallback(async () => {
    if (!scanRef.current) return;

    const blob = await cameraRef.current?.captureFrame();
    if (!blob) {
      // Video chưa load xong (readyState < 2 hoặc videoWidth = 0) → retry
      if (scanRef.current) setTimeout(processFrame, 200);
      return;
    }

    try {
      const data = await verifyFace(blob);

      // Chưa thấy mặt → tiếp tục quét
      if (data.status === 'error' && data.message?.includes('Không tìm thấy')) {
        if (scanRef.current) setTimeout(processFrame, 150);
        return;
      }

      // Có kết quả → dừng
      setResult(data);
      addLog(data.message, data.status);
      stopScanning();
    } catch (err) {
      addLog(`Lỗi kết nối: ${err.message}`, 'error');
      stopScanning();
    }
  }, [addLog, stopScanning]);

  const startScanning = useCallback(() => {
    if (isScanning || !cameraReady) return;
    setResult(null);
    scanRef.current = true;
    setIsScanning(true);
    addLog('Bắt đầu quét...', 'info');
    processFrame();
  }, [isScanning, cameraReady, addLog, processFrame]);

  return (
    <main className="page-center">
      {/* Hero text */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 800,
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 8,
        }}>
          Face Anti-Spoofing
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Nhận diện khuôn mặt kết hợp phát hiện giả mạo real-time
        </p>
      </div>

      {/* Camera */}
      <CameraView ref={cameraRef} isScanning={isScanning} onReady={handleCameraReady} />

      {/* Result */}
      {result && <ResultOverlay result={result} />}

      {/* Scan button */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button
          id="btn-scan"
          className="btn btn-primary btn-lg"
          onClick={startScanning}
          disabled={isScanning || !cameraReady}
        >
          {isScanning ? (
            <><span className="spinner" /> Đang quét...</>
          ) : result ? (
            'Quét lại'
          ) : (
            'Bắt đầu quét'
          )}
        </button>
      </div>

      {/* Status hint */}
      {!cameraReady && (
        <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>
          Đang khởi động camera...
        </p>
      )}

      {/* Logs */}
      <LogPanel logs={logs} />
    </main>
  );
}
