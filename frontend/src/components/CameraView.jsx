import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

const styles = {
  wrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: 640,
    aspectRatio: '4/3', // Tự động tính chiều cao theo chiều rộng (640x480)
    borderRadius: 'var(--radius-lg, 12px)',
    overflow: 'hidden',
    background: '#111', 
    boxShadow: 'var(--shadow-card), 0 0 60px rgba(108,99,255,0.15)',
    border: '1px solid var(--border, #333)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)', // Lật gương webcam
    display: 'block',
  },
  scanLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    background: 'linear-gradient(90deg, transparent, #6c63ff, #00d4ff, transparent)',
    boxShadow: '0 0 12px rgba(108,99,255,0.8)',
    animation: 'scanLineAnim 2s ease-in-out infinite',
    pointerEvents: 'none',
  },
  cornerTL: { position: 'absolute', top: 16, left: 16, width: 28, height: 28, borderTop: '2px solid #6c63ff', borderLeft: '2px solid #6c63ff', borderRadius: '4px 0 0 0' },
  cornerTR: { position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderTop: '2px solid #6c63ff', borderRight: '2px solid #6c63ff', borderRadius: '0 4px 0 0' },
  cornerBL: { position: 'absolute', bottom: 16, left: 16, width: 28, height: 28, borderBottom: '2px solid #6c63ff', borderLeft: '2px solid #6c63ff', borderRadius: '0 0 0 4px' },
  cornerBR: { position: 'absolute', bottom: 16, right: 16, width: 28, height: 28, borderBottom: '2px solid #6c63ff', borderRight: '2px solid #6c63ff', borderRadius: '0 0 4px 0' },
};

const CameraView = forwardRef(function CameraView({ isScanning, onReady }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const onReadyCalledRef = useRef(false);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Camera API không khả dụng. Hãy đảm bảo bạn đang dùng localhost hoặc giao thức HTTPS.';
      setCameraError(msg);
      if (!onReadyCalledRef.current) {
        onReadyCalledRef.current = true;
        onReady?.(msg);
      }
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;

        if (video) {
          video.muted = true;
          video.defaultMuted = true;
          // FIX: Gán sự kiện onloadedmetadata trước khi gán srcObject để tránh race condition
          video.onloadedmetadata = async () => {
            try {
              await video.play();
            } catch (playErr) {
              console.error("Trình duyệt chặn autoplay hoặc lỗi play():", playErr);
            } finally {
              if (!cancelled && !onReadyCalledRef.current) {
                onReadyCalledRef.current = true;
                onReady?.();
              }
            }
          };

          video.srcObject = stream;
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Camera error:', err);
        let msg = 'Không thể mở camera.';
        if (err.name === 'NotAllowedError') msg = 'Trình duyệt đã chặn quyền truy cập camera. Hãy cấp quyền và tải lại trang.';
        if (err.name === 'NotFoundError') msg = 'Không tìm thấy thiết bị camera nào trên máy tính.';
        if (err.name === 'NotReadableError') msg = 'Camera đang bị một ứng dụng khác chiếm dụng (Discord, Zoom...) hoặc lỗi driver.';
        
        setCameraError(msg);

        if (!onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReady?.(msg);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      onReadyCalledRef.current = false;
    };
  }, []); 

  useImperativeHandle(ref, () => ({
    captureFrame: () =>
      new Promise((resolve) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return resolve(null);

        if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
          return resolve(null);
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
      }),
  }));

  return (
    <>
      <style>{`
        @keyframes scanLineAnim {
          0%   { top: 0%;   opacity: 1; }
          50%  { top: 95%;  opacity: 1; }
          51%  { top: 95%;  opacity: 0; }
          52%  { top: 0%;   opacity: 0; }
          100% { top: 0%;   opacity: 1; }
        }
      `}</style>
      
      <div style={styles.wrapper}>
        {cameraError ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24, textAlign: 'center', gap: 12,
            zIndex: 10, background: '#111'
          }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 14 }}>Lỗi Khởi Động</p>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{cameraError}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '8px 16px', background: '#333', color: 'white', borderRadius: 8, cursor: 'pointer', border: 'none' }}
            >
              🔄 Tải lại trang
            </button>
          </div>
        ) : null}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ ...styles.video, opacity: cameraError ? 0 : 1 }}
        />
        {isScanning && !cameraError && <div style={styles.scanLine} />}
        <div style={styles.cornerTL} />
        <div style={styles.cornerTR} />
        <div style={styles.cornerBL} />
        <div style={styles.cornerBR} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </>
  );
});

export default CameraView;