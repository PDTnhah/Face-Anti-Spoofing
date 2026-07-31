# Tóm tắt hệ thống Face-Anti-Spoofing

## 1. Tổng quan
Hệ thống là một ứng dụng nhận diện khuôn mặt kết hợp tính năng kiểm tra sự sống (Liveness Detection - chống giả mạo bằng màn hình/ảnh in). Dự án được thiết kế theo mô hình Client-Server với Backend xử lý AI bằng Python và Frontend giao diện người dùng bằng React.

## 2. Kiến trúc Backend (`main.py`)
- **Framework & Routing**: Sử dụng `FastAPI` để tạo máy chủ HTTP ở cổng 8000, đảm nhiệm cả việc cung cấp API và phục vụ các file tĩnh (Frontend SPA).
- **Cơ sở dữ liệu**: Dùng `SQLite` (`face_db.sqlite`) lưu thông tin người dùng (ID, Tên, Ngày tạo) và Vector Đặc Trưng (Embedding) của khuôn mặt. Hệ thống không lưu trữ ảnh thô của người dùng.
- **Mô hình AI**:
  - **Nhận diện khuôn mặt (Identity)**: Sử dụng thư viện `insightface` (mô hình ArcFace `buffalo_l`) trích xuất embedding 512 chiều. Mức độ nhận diện được tính bằng Cosine Similarity.
  - **Chống giả mạo (Anti-Spoofing/Liveness)**: Sử dụng `TensorFlow/Keras` (mô hình `antispoof_final.keras` với base là MobileNetV3). Trả về điểm (score) đánh giá khuôn mặt là người thật hay giả mạo.
- **Các API chính**:
  - `POST /verify`: (Public) Nhận frame ảnh chụp từ camera, trả về kết quả liveness và danh tính người trong ảnh.
  - `POST /register`: (Admin) Nhận ảnh và tên, lưu thông tin vào DB. Bắt buộc có header `X-Admin-Api-Key`.
  - `GET /admin/users` & `DELETE /admin/users/{id}`: Quản lý database.

## 3. Kiến trúc Frontend (`frontend/` & `templates/`)
- **Frontend Mới (React + Vite)**: Nằm trong thư mục `frontend/`. 
  - Khởi tạo bằng React 19 và React Router.
  - Quản lý thiết bị phần cứng Webcam (trong `CameraView.jsx`) và gọi API tới Backend định kỳ (`ScanPage.jsx`).
  - Chế độ Production: Chạy `npm run build`, kết quả sinh ra thư mục `frontend/dist`. FastAPI backend sẽ tự động load folder này.
- **Frontend Cũ (Legacy HTML)**: Tệp `templates/index.html`. 
  - Là mã nguồn Vanilla JS/HTML cũ trước khi áp dụng React. 
  - Sẽ được kích hoạt làm "dự phòng" (fallback) nếu FastAPI không tìm thấy thư mục `frontend/dist`. 

## 4. Flow xử lý Nhận diện (Luồng Verification)
Khi người dùng đứng trước Camera:
1. Trình duyệt (React) tự động chụp 1 khung hình (frame) và gửi tới `POST /verify`.
2. Backend (FastAPI) đọc ảnh và tìm vị trí khuôn mặt lớn nhất (InsightFace).
3. Cắt (crop) khuôn mặt, đưa qua MobileNetV3 (`antispoof_final.keras`) để check ảnh thật hay in giấy/điện thoại. Nếu điểm Fake quá cao -> Trả về CẢNH BÁO GIẢ MẠO.
4. Nếu vượt qua Anti-spoofing, trích xuất vector của khuôn mặt (InsightFace) và đem duyệt qua toàn bộ Vector (in-memory loaded from DB) của hệ thống.
5. So sánh độ đo Cosine Similarity. Nếu > `THRESHOLD_SIMILARITY` -> TRẢ VỀ TÊN NGƯỜI DÙNG, ngược lại -> NGƯỜI LẠ.

## 5. Trạng thái cấu hình hiện tại
- Thông tin quản trị (`ADMIN_API_KEY`) đang được đọc động từ file `.env`.
- Database lưu embedding của tất cả users lên RAM vào lúc backend vừa khởi động (Lifespan event của FastAPI) để tăng tốc độ so sánh real-time. Bất kỳ thay đổi thêm/xóa user nào cũng được tự động sync vào cả SQLite và RAM.
