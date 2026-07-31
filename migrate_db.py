"""
migrate_db.py - Chạy một lần để chuyển dữ liệu từ database_images/ sang SQLite.

Cách dùng:
    python migrate_db.py

Script sẽ:
1. Load InsightFace
2. Đọc toàn bộ ảnh trong database_images/
3. Extract embedding cho mỗi ảnh
4. Lưu vào face_db.sqlite
"""

import os
import cv2
import numpy as np
import sqlite3
from insightface.app import FaceAnalysis

DB_FOLDER = "database_images"
DB_PATH = "face_db.sqlite"


def init_db(conn: sqlite3.Connection):
    """Tạo bảng users nếu chưa tồn tại."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT NOT NULL UNIQUE,
            embedding BLOB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()


def main():
    print("=" * 50)
    print("   MIGRATION: database_images/ → face_db.sqlite")
    print("=" * 50)

    # 1. Khởi tạo InsightFace
    print("\n[1/3] Đang load InsightFace (ArcFace)...")
    face_app = FaceAnalysis(
        name="buffalo_l",
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
    )
    face_app.prepare(ctx_id=0, det_size=(640, 640))
    print("✅ InsightFace sẵn sàng.")

    # 2. Kết nối SQLite
    print(f"\n[2/3] Kết nối SQLite: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    print("✅ Database sẵn sàng.")

    # 3. Migrate từng ảnh
    print(f"\n[3/3] Đang migrate từ '{DB_FOLDER}/'...")
    if not os.path.exists(DB_FOLDER):
        print(f"⚠️  Thư mục '{DB_FOLDER}' không tồn tại. Không có gì để migrate.")
        conn.close()
        return

    files = [f for f in os.listdir(DB_FOLDER)
             if f.lower().endswith(('.jpg', '.png', '.jpeg'))]

    if not files:
        print("⚠️  Không tìm thấy ảnh nào trong thư mục.")
        conn.close()
        return

    success_count = 0
    fail_count = 0

    for file in files:
        name = os.path.splitext(file)[0]
        img_path = os.path.join(DB_FOLDER, file)

        img = cv2.imread(img_path)
        if img is None:
            print(f"  ⚠️  Không đọc được: {file}")
            fail_count += 1
            continue

        faces = face_app.get(img)
        if len(faces) == 0:
            print(f"  ⚠️  Không tìm thấy khuôn mặt: {file}")
            fail_count += 1
            continue

        embedding: np.ndarray = faces[0].embedding
        embedding_bytes = embedding.astype(np.float32).tobytes()

        try:
            conn.execute(
                "INSERT OR REPLACE INTO users (name, embedding) VALUES (?, ?)",
                (name, embedding_bytes)
            )
            conn.commit()
            print(f"  ✅ Đã migrate: {name}")
            success_count += 1
        except sqlite3.Error as e:
            print(f"  ❌ Lỗi DB khi lưu {name}: {e}")
            fail_count += 1

    conn.close()
    print("\n" + "=" * 50)
    print(f"✅ Thành công: {success_count} người dùng")
    print(f"❌ Thất bại : {fail_count} ảnh")
    print(f"📂 Database : {os.path.abspath(DB_PATH)}")
    print("=" * 50)
    print("\nGợi ý: Sau khi kiểm tra DB, bạn có thể xóa thư mục database_images/")
    print("để tối ưu dung lượng và bảo vệ privacy.")


if __name__ == "__main__":
    main()
