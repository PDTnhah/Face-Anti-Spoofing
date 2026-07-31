import os
import sqlite3
import numpy as np
import cv2
import tensorflow as tf
import insightface
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from insightface.app import FaceAnalysis
from tensorflow.keras.applications.mobilenet_v3 import preprocess_input
from dotenv import load_dotenv

# ============================================================
# CẤU HÌNH
# ============================================================
load_dotenv()  # Đọc biến từ file .env

MODEL_PATH = "antispoof_final.keras"
DB_PATH = "face_db.sqlite"

THRESHOLD_SPOOF = 0.75       # > ngưỡng này => GIẢ MẠO
THRESHOLD_SIMILARITY = 0.4   # > ngưỡng này => CÙNG NGƯỜI

ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "")
if not ADMIN_API_KEY:
    print("⚠️  CẢNH BÁO: ADMIN_API_KEY chưa được đặt trong .env!")
    print("   Endpoint /register và /admin/users sẽ không an toàn.")

# ============================================================
# STATE TOÀN CỤC
# ============================================================
ai_liveness_model = None
face_app: Optional[FaceAnalysis] = None
user_database: dict[str, np.ndarray] = {}  # {name: embedding}


# ============================================================
# DATABASE HELPERS
# ============================================================
def get_db_conn() -> sqlite3.Connection:
    """Tạo kết nối SQLite mới (thread-safe row_factory)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Tạo bảng users nếu chưa tồn tại."""
    with get_db_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL UNIQUE,
                embedding  BLOB    NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    print("✅ SQLite Database đã sẵn sàng.")


def load_user_database():
    """Load toàn bộ embedding từ SQLite vào bộ nhớ."""
    global user_database
    user_database = {}

    with get_db_conn() as conn:
        rows = conn.execute("SELECT name, embedding FROM users").fetchall()

    for row in rows:
        name = row["name"]
        embedding = np.frombuffer(row["embedding"], dtype=np.float32).copy()
        user_database[name] = embedding
        print(f"  ✅ Đã load: {name}")

    print(f">>> Đã load {len(user_database)} người dùng từ Database.")


# ============================================================
# SECURITY
# ============================================================
def verify_admin_key(x_admin_api_key: Optional[str] = Header(None)):
    """Dependency: kiểm tra Admin API Key trong header."""
    if not ADMIN_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Server chưa cấu hình ADMIN_API_KEY. Liên hệ quản trị viên."
        )
    if x_admin_api_key != ADMIN_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="API Key không hợp lệ hoặc thiếu header X-Admin-Api-Key."
        )


# ============================================================
# COMPUTE
# ============================================================
def compute_similarity(embed1: np.ndarray, embed2: np.ndarray) -> float:
    """Cosine similarity giữa 2 vector embedding."""
    norm1 = np.linalg.norm(embed1)
    norm2 = np.linalg.norm(embed2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(embed1, embed2) / (norm1 * norm2))


# ============================================================
# LIFESPAN (Khởi động server)
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global ai_liveness_model, face_app

    # 1. Khởi tạo Database
    print(">>> Khởi tạo SQLite Database...")
    init_db()

    # 2. Load Liveness Model (Keras)
    if os.path.exists(MODEL_PATH):
        print(f">>> Loading Liveness Model: {MODEL_PATH}...")
        try:
            ai_liveness_model = tf.keras.models.load_model(MODEL_PATH, compile=False)
            print("✅ Liveness Model sẵn sàng.")
        except Exception as e:
            print(f"❌ LỖI load Liveness Model: {e}")
    else:
        print(f"❌ LỖI: Không tìm thấy file model '{MODEL_PATH}'")

    # 3. Load InsightFace (ArcFace)
    print(">>> Loading InsightFace (ArcFace)...")
    try:
        face_app = FaceAnalysis(
            name="buffalo_l",
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
        )
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        print("✅ InsightFace sẵn sàng.")
    except Exception as e:
        print(f"❌ LỖI load InsightFace: {e}")

    # 4. Load User Database từ SQLite
    print(">>> Đang load danh tính từ Database...")
    load_user_database()

    yield

    print(">>> Server đang tắt...")


# ============================================================
# APP
# ============================================================
app = FastAPI(
    lifespan=lifespan,
    title="Face Anti-Spoofing API",
    version="2.0.0",
    description="API nhận diện khuôn mặt kết hợp chống giả mạo (Liveness Detection)"
)

# Serve Vite build (production) — chỉ hoạt động sau khi chạy `npm run build`
FRONTEND_DIST = os.path.join("frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

templates = Jinja2Templates(directory=FRONTEND_DIST if os.path.exists(FRONTEND_DIST) else "templates")


# ============================================================
# ROUTES — FRONTEND (serve SPA)
# ============================================================
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def serve_scan_page(request: Request):
    """Serve trang Scan Camera."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def serve_admin_page(request: Request):
    """Serve trang Admin Dashboard (cùng SPA index.html, React Router xử lý routing)."""
    return templates.TemplateResponse("index.html", {"request": request})


# ============================================================
# API — VERIFY (công khai)
# ============================================================
@app.post("/verify", summary="Xác minh khuôn mặt (Liveness + Identity)")
async def verify_face(file: UploadFile = File(...)):
    """
    Nhận ảnh từ webcam, kiểm tra:
    1. Liveness (thật/giả mạo) bằng MobileNetV3
    2. Nhận diện danh tính bằng ArcFace (InsightFace)
    """
    global ai_liveness_model, face_app, user_database

    if ai_liveness_model is None or face_app is None:
        raise HTTPException(status_code=503, detail="Hệ thống AI chưa sẵn sàng.")

    # 1. Đọc ảnh upload
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Không decode được ảnh")
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"Lỗi đọc file ảnh: {e}"})

    # 2. Phát hiện khuôn mặt bằng InsightFace
    faces = face_app.get(frame)
    if len(faces) == 0:
        return {"status": "error", "message": "Không tìm thấy khuôn mặt nào"}

    # Lấy khuôn mặt lớn nhất
    target_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

    # 3. Kiểm tra Liveness (thật/giả mạo)
    bbox = target_face.bbox.astype(int)
    h, w, _ = frame.shape
    x1, y1 = max(0, bbox[0]), max(0, bbox[1])
    x2, y2 = min(w, bbox[2]), min(h, bbox[3])
    face_crop = frame[y1:y2, x1:x2]

    if face_crop.size == 0:
        return {"status": "error", "message": "Lỗi cắt ảnh khuôn mặt"}

    # Preprocess cho MobileNetV3
    resized_face = cv2.resize(face_crop, (224, 224))
    rgb_face = cv2.cvtColor(resized_face, cv2.COLOR_BGR2RGB)
    face_input = preprocess_input(np.expand_dims(rgb_face, axis=0))

    spoof_score = float(ai_liveness_model.predict(face_input, verbose=0)[0][0])

    if spoof_score > THRESHOLD_SPOOF:
        return {
            "status": "denied",
            "message": "CẢNH BÁO: GIẢ MẠO (SPOOF)",
            "liveness_score": round(spoof_score, 4),
            "identity": "Unknown"
        }

    if spoof_score > 0.4:
        print(f"⚠️  Nghi ngờ: liveness_score={spoof_score:.4f}")

    # 4. Nhận diện danh tính (ArcFace)
    user_embedding = target_face.embedding
    best_match_name = "Người lạ"
    highest_sim = 0.0

    for name, db_embedding in user_database.items():
        sim = compute_similarity(user_embedding, db_embedding)
        if sim > highest_sim:
            highest_sim = sim
            best_match_name = name

    if highest_sim > THRESHOLD_SIMILARITY:
        final_status = "approved"
        final_message = f"Xin chào, {best_match_name}!"
    else:
        final_status = "warning"
        final_message = "Người thật, nhưng không có trong cơ sở dữ liệu"
        best_match_name = "Unknown"

    return {
        "status": final_status,
        "message": final_message,
        "identity": best_match_name,
        "similarity": round(float(highest_sim), 4),
        "liveness_score": round(spoof_score, 4)
    }


# ============================================================
# API — ADMIN (yêu cầu X-Admin-Api-Key)
# ============================================================
@app.post(
    "/register",
    summary="Đăng ký người dùng mới",
    dependencies=[Depends(verify_admin_key)]
)
async def register_user(
    name: str = Form(..., description="Tên định danh người dùng (không dấu, không khoảng trắng)"),
    file: UploadFile = File(..., description="Ảnh khuôn mặt rõ nét")
):
    """
    [ADMIN] Đăng ký khuôn mặt mới vào hệ thống.
    - Trích xuất embedding bằng InsightFace
    - Lưu vào SQLite (KHÔNG lưu ảnh gốc)
    - Cập nhật in-memory database ngay lập tức
    """
    global user_database

    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên không được để trống.")

    # Đọc ảnh từ upload
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Không đọc được file ảnh.")

    # Extract embedding
    faces = face_app.get(img)
    if len(faces) == 0:
        raise HTTPException(status_code=422, detail="Không tìm thấy khuôn mặt trong ảnh. Hãy dùng ảnh rõ nét hơn.")

    embedding: np.ndarray = faces[0].embedding
    embedding_bytes = embedding.astype(np.float32).tobytes()

    # Lưu vào SQLite
    try:
        with get_db_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO users (name, embedding) VALUES (?, ?)",
                (name, embedding_bytes)
            )
            conn.commit()
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lưu database: {e}")

    # Cập nhật in-memory ngay lập tức (không cần restart)
    user_database[name] = embedding.astype(np.float32)

    return {
        "status": "success",
        "message": f"Đã đăng ký '{name}' thành công!",
        "total_users": len(user_database)
    }


@app.get(
    "/admin/users",
    summary="Lấy danh sách người dùng",
    dependencies=[Depends(verify_admin_key)]
)
async def list_users():
    """[ADMIN] Trả về danh sách tất cả người dùng (id + tên, không trả embedding)."""
    with get_db_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()

    users = [{"id": row["id"], "name": row["name"], "created_at": row["created_at"]} for row in rows]
    return {"status": "success", "total": len(users), "users": users}


@app.delete(
    "/admin/users/{user_id}",
    summary="Xóa người dùng theo ID",
    dependencies=[Depends(verify_admin_key)]
)
async def delete_user(user_id: int):
    """[ADMIN] Xóa một người dùng khỏi DB và cập nhật in-memory cache ngay lập tức."""
    global user_database

    with get_db_conn() as conn:
        row = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy user với id={user_id}")

        name = row["name"]
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

    # Xóa khỏi in-memory cache
    user_database.pop(name, None)

    return {
        "status": "success",
        "message": f"Đã xóa '{name}' khỏi hệ thống.",
        "total_users": len(user_database)
    }