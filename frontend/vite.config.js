import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/verify': 'http://localhost:8000',
      '/register': 'http://localhost:8000',
      '/admin': {
        target: 'http://localhost:8000',
        bypass(req) {
          // Chỉ proxy các API call (không phải navigate đến trang /admin)
          if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return false; // trả về null để Vite tự xử lý (SPA)
          }
        }
      },
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
