# Context: Full source snapshot

Tập hợp toàn bộ nội dung mã nguồn hiện có trong project.

---

## File: main.py

```python
# import os
# import cv2
# import numpy as np
# import tensorflow as tf
# from fastapi import FastAPI, File, UploadFile
# from fastapi.responses import HTMLResponse
# from fastapi.templating import Jinja2Templates
# from fastapi.requests import Request
# from contextlib import asynccontextmanager

# MODEL_PATH = "antispoof_final.keras"
# THRESHOLD_SPOOF = 0.5 

# from tensorflow.keras.applications.mobilenet_v3 import preprocess_input

# ai_model = None
# face_cascade = None

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     global ai_model, face_cascade
    
#     # Load Model AI
#     if os.path.exists(MODEL_PATH):
#         print(f"Đang load model {MODEL_PATH}...")
#         try:
#             ai_model = tf.keras.models.load_model(MODEL_PATH, compile=False)
#             print("Load model AI thành công!")
#         except Exception as e:
#             print(f"LỖI LOAD MODEL: {e}")
#     else:
#         print(f"KHÔNG TÌM THẤY FILE MODEL: {MODEL_PATH}")

#     # Load Face Detector (Haar Cascade)
#     cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
#     if os.path.exists(cascade_path):
#         face_cascade = cv2.CascadeClassifier(cascade_path)
#         print("Load Face Detector thành công!")
#     else:
#         print("Lỗi: Không tìm thấy file xml của OpenCV.")
    
#     yield
#     print("Server shutting down...")

# app = FastAPI(lifespan=lifespan)
# templates = Jinja2Templates(directory="templates")

# @app.get("/", response_class=HTMLResponse)
# async def read_root(request: Request):
#     return templates.TemplateResponse("index.html", {"request": request})

# @app.post("/verify")
# async def verify_face(file: UploadFile = File(...)):
#     global ai_model, face_cascade
    
#     # Check hệ thống
#     if ai_model is None:
#         return {"status": "error", "message": "Lỗi: Chưa load được Model AI"}
#     if face_cascade is None:
#         return {"status": "error", "message": "Lỗi: Chưa load được OpenCV"}

#     try:
#         # Đọc ảnh từ Client
#         contents = await file.read()
#         nparr = np.frombuffer(contents, np.uint8)
#         frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
#         if frame is None:
#              return {"status": "error", "message": "Không đọc được ảnh gửi lên"}

#     except Exception as e:
#         return {"status": "error", "message": f"Lỗi đọc file: {str(e)}"}

#     # 2. Phát hiện khuôn mặt
#     gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
#     # scaleFactor=1.1: Quét kỹ hơn
#     # minNeighbors=4: Giảm xuống 4 để nhạy hơn
#     # minSize=(30, 30): Bỏ qua các vật thể quá nhỏ
#     faces = face_cascade.detectMultiScale(
#         gray, 
#         scaleFactor=1.1, 
#         minNeighbors=4, 
#         minSize=(30, 30)
#     )

#     if len(faces) == 0:
#         return {"status": "error", "message": "Không tìm thấy khuôn mặt"}

#     # Lấy khuôn mặt to nhất (Diện tích w * h lớn nhất)
#     x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

#     # 3. Xử lý AI
#     try:
#         face_crop = frame[y:y+h, x:x+w]
        
#         # Resize 
#         face_resized = cv2.resize(face_crop, (224, 224))
        
#         # Chuyển màu BGR -> RGB
#         img_rgb = cv2.cvtColor(face_resized, cv2.COLOR_BGR2RGB)
        
#         # Thêm chiều batch: (224, 224, 3) -> (1, 224, 224, 3)
#         img_input = np.expand_dims(img_rgb, axis=0)
        
#         img_input = preprocess_input(img_input)

#         # Predict
#         prediction = ai_model.predict(img_input)
#         score = float(prediction[0][0])
        
#     except Exception as e:
#         print(f"Lỗi AI processing: {e}")
#         return {"status": "error", "message": "Lỗi xử lý nội bộ AI"}

#     is_live = score < THRESHOLD_SPOOF
    
#     if is_live:
#         return {
#             "status": "approved",
#             "message": "NGƯỜI THẬT",
#             "liveness_score": score
#         }
#     else:
#         return {
#             "status": "denied",
#             "message": "GIẢ MẠO",
#             "liveness_score": score
#         }

import os
import cv2
import numpy as np
import tensorflow as tf
import insightface
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from contextlib import asynccontextmanager
from insightface.app import FaceAnalysis
from tensorflow.keras.applications.mobilenet_v3 import preprocess_input

MODEL_PATH = "antispoof_final.keras"
DB_FOLDER = "database_images"
THRESHOLD_SPOOF = 0.75      # Ngưỡng thật/giả (Dưới 0.5 là thật)
THRESHOLD_SIMILARITY = 0.4 # Ngưỡng nhận diện mặt (Trên 0.4 là cùng 1 người)

ai_liveness_model = None
face_app = None
user_database = {} # Lưu trữ vector khuôn mặt

# --- HÀM TÍNH TOÁN ---
def load_user_database():
    """Load toàn bộ ảnh trong folder database_images để học khuôn mặt"""
    global user_database
    user_database = {}
    
    if not os.path.exists(DB_FOLDER):
        os.makedirs(DB_FOLDER)
        print(f"⚠️ Đã tạo folder '{DB_FOLDER}'. Hãy bỏ ảnh người dùng vào đây (vd: tuan.jpg).")
        return

    print(">>> Đang load danh tính từ Database...")
    files = os.listdir(DB_FOLDER)
    for file in files:
        if file.lower().endswith(('.jpg', '.png', '.jpeg')):
            name = os.path.splitext(file)[0] # Lấy tên file làm tên người (tuan.jpg -> tuan)
            img_path = os.path.join(DB_FOLDER, file)
            
            # Đọc ảnh và lấy embedding
            img = cv2.imread(img_path)
            if img is None: continue
            
            faces = face_app.get(img)
            if len(faces) > 0:
                # Lấy vector đặc trưng của khuôn mặt đầu tiên
                user_database[name] = faces[0].embedding
                print(f"✅ Đã học mặt: {name}")
            else:
                print(f"⚠️ Không tìm thấy mặt trong ảnh: {file}")

def compute_similarity(embed1, embed2):
    """Tính độ tương đồng giữa 2 vector"""
    # Công thức: (A . B) / (||A|| * ||B||)
    return np.dot(embed1, embed2) / (np.linalg.norm(embed1) * np.linalg.norm(embed2))

# --- LIFECYCLE (KHỞI ĐỘNG SERVER) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global ai_liveness_model, face_app
    
    # 1. Load Model Liveness (Keras)
    if os.path.exists(MODEL_PATH):
        print(f"Loading Liveness Model: {MODEL_PATH}...")
        ai_liveness_model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    else:
        print(f"❌ LỖI: Không tìm thấy {MODEL_PATH}")

    # 2. Load InsightFace (ArcFace)
    print("Loading InsightFace (ArcFace)...")
    face_app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
    face_app.prepare(ctx_id=0, det_size=(640, 640))
    
    # 3. Load Database người dùng
    load_user_database()
    
    yield
    print("Server shutting down...")

app = FastAPI(lifespan=lifespan)
templates = Jinja2Templates(directory="templates")

# --- API ENDPOINTS ---

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/verify")
async def verify_face(file: UploadFile = File(...)):
    global ai_liveness_model, face_app, user_database

    if ai_liveness_model is None or face_app is None:
        return {"status": "error", "message": "Hệ thống chưa sẵn sàng"}

    # 1. Đọc ảnh upload
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except:
        return {"status": "error", "message": "Lỗi đọc file ảnh"}

    # 2. Phát hiện khuôn mặt bằng InsightFace
    # Hàm này trả về list các khuôn mặt kèm theo tọa độ và vector
    faces = face_app.get(frame)

    if len(faces) == 0:
        return {"status": "error", "message": "Không tìm thấy khuôn mặt nào"}

    # Lấy khuôn mặt to nhất
    target_face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    
    # --- BƯỚC 3: KIỂM TRA LIVENESS (THẬT/GIẢ) ---
    bbox = target_face.bbox.astype(int) # [x1, y1, x2, y2]
    
    # Cắt ảnh khuôn mặt
    h, w, _ = frame.shape
    x1, y1, x2, y2 = max(0, bbox[0]), max(0, bbox[1]), min(w, bbox[2]), min(h, bbox[3])
    face_crop = frame[y1:y2, x1:x2]

    if face_crop.size == 0:
        return {"status": "error", "message": "Lỗi cắt ảnh khuôn mặt"}

    # Preprocess cho MobileNetV3
    resized_face = cv2.resize(face_crop, (224, 224))
    rgb_face = cv2.cvtColor(resized_face, cv2.COLOR_BGR2RGB) # Model train bằng RGB
    face_input = np.expand_dims(rgb_face, axis=0)
    face_input = preprocess_input(face_input)

    # Predict
    spoof_score = float(ai_liveness_model.predict(face_input, verbose=0)[0][0])
    
    # Logic: Model của bạn train (0=Real, 1=Spoof) hoặc ngược lại.
    # Dựa vào code cũ: score < 0.5 là REAL.
    if spoof_score > THRESHOLD_SPOOF:
        return {
            "status": "denied",
            "message": "CẢNH BÁO: GIẢ MẠO (SPOOF)",
            "liveness_score": spoof_score,
            "identity": "Unknown"
        }
    elif spoof_score > 0.4:
        print(f"⚠️ Cảnh báo nghi ngờ: {spoof_score:.4f}")
        # Vẫn cho đi tiếp để check ArcFace, nhưng có thể log lại

    # --- BƯỚC 4: NHẬN DIỆN DANH TÍNH (ARCFACE) ---
    # Nếu đã qua bước trên nghĩa là người thật, check tiếp nhận dạng là ai
    user_embedding = target_face.embedding
    
    best_match_name = "Người lạ"
    highest_sim = 0.0

    for name, db_embedding in user_database.items():
        sim = compute_similarity(user_embedding, db_embedding)
        if sim > highest_sim:
            highest_sim = sim
            best_match_name = name
    
    # Kiểm tra ngưỡng nhận diện
    if highest_sim > THRESHOLD_SIMILARITY:
        final_status = "approved"
        final_message = f"Xin chào, {best_match_name}"
    else:
        final_status = "warning"
        final_message = "Người thật, nhưng không có trong dữ liệu"
        best_match_name = "Unknown"

    return {
        "status": final_status,
        "message": final_message,
        "identity": best_match_name,
        "similarity": float(highest_sim),
        "liveness_score": spoof_score
    }

# API đăng ký nhanh người dùng 
@app.post("/register")
async def register_user(name: str = Form(...), file: UploadFile = File(...)):
    global user_database
    
    file_path = os.path.join(DB_FOLDER, f"{name}.jpg")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Học lại vector ngay lập tức
    img = cv2.imread(file_path)
    faces = face_app.get(img)
    if len(faces) > 0:
        user_database[name] = faces[0].embedding
        return {"status": "success", "message": f"Đã đăng ký {name} thành công!"}
    else:
        os.remove(file_path)
        return {"status": "error", "message": "Ảnh đăng ký không rõ mặt"}
```

---

## File: templates/index.html

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hệ thống FaceID & Anti-Spoofing</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f0f2f5;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        }
        h1 { color: #333; margin-bottom: 10px; }
        
        .container {
            position: relative;
            width: 640px;
            max-width: 100%;
            background: #000;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        video {
            width: 100%;
            display: block;
            transform: scaleX(-1); /* Lật gương webcam */
        }
        
        /* Lớp phủ kết quả */
        .overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            display: none; /* Mặc định ẩn */
        }

        /* Màu sắc trạng thái */
        .status-approved { color: #2ecc71; border-top: 4px solid #2ecc71; }
        .status-denied { color: #e74c3c; border-top: 4px solid #e74c3c; }
        .status-warning { color: #f39c12; border-top: 4px solid #f39c12; }

        /* Khu vực nút điều khiển */
        .controls {
            margin-top: 20px;
            display: flex;
            gap: 10px;
        }

        button {
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 5px;
            transition: background 0.3s;
            font-weight: bold;
        }

        #btnScan {
            background-color: #3498db;
            color: white;
        }
        #btnScan:hover { background-color: #2980b9; }
        #btnScan:disabled { background-color: #95a5a6; cursor: not-allowed; }

        #logArea {
            margin-top: 20px;
            width: 640px;
            height: 150px;
            overflow-y: auto;
            background: white;
            padding: 10px;
            border: 1px solid #ddd;
            font-family: monospace;
            font-size: 12px;
            box-shadow: inset 0 0 5px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>

    <h1>Hệ thống Face Anti-Spoofing</h1>

    <div class="container" id="cameraBox">
        <video id="video" autoplay playsinline></video>
        <div id="result" class="overlay"></div>
    </div>

    <canvas id="canvas" style="display:none;"></canvas>

    <div class="controls">
        <button id="btnScan" onclick="startScanning()">Bắt đầu quét</button>
    </div>

    <div id="logArea">LOG HỆ THỐNG:</div>

    <script>
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const resultDiv = document.getElementById('result');
        const logArea = document.getElementById('logArea');
        const btnScan = document.getElementById('btnScan');

        let isScanning = false; // Biến trạng thái để kiểm soát vòng lặp

        // 1. Mở Webcam
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
            .then(stream => {
                video.srcObject = stream;
                log("Camera đã sẵn sàng.");
            })
            .catch(err => {
                console.error("Lỗi Camera:", err);
                log("Lỗi: Không thể mở Camera.");
            });

        function log(msg) {
            const time = new Date().toLocaleTimeString();
            logArea.innerHTML = `[${time}] ${msg}<br>` + logArea.innerHTML;
        }

        // 2. Hàm bắt đầu quá trình quét
        function startScanning() {
            if (isScanning) return; // Tránh bấm nhiều lần
            
            isScanning = true;
            btnScan.disabled = true;
            btnScan.innerText = "Đang xử lý...";
            resultDiv.style.display = 'none'; // Ẩn kết quả cũ
            
            processFrame(); // Bắt đầu vòng lặp gửi ảnh
        }

        // 3. Hàm xử lý gửi ảnh
        async function processFrame() {
            if (!isScanning) return;

            // Chụp frame
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('file', blob, 'capture.jpg');

                try {
                    const response = await fetch('/verify', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();

                    handleResponse(data);

                } catch (error) {
                    console.error(error);
                    log("Lỗi kết nối Server");
                    stopScanning(); // Dừng nếu lỗi mạng
                }
            }, 'image/jpeg', 0.8);
        }

        // 4. Xử lý kết quả trả về
        function handleResponse(data) {
            // Trường hợp 1: Không thấy mặt -> Thử lại ngay lập tức
            if (data.status === 'error' && data.message.includes("Không tìm thấy khuôn mặt")) {
                console.log("Chưa thấy mặt, thử lại...");
                if (isScanning) {
                    // Gọi đệ quy nhẹ để thử lại sau 100ms (tránh spam server quá nhanh)
                    setTimeout(processFrame, 100); 
                }
                return;
            }

            // Trường hợp 2: Có kết quả (Thành công, Thất bại, hoặc Cảnh báo)
            // -> HIỂN THỊ VÀ DỪNG QUÉT
            showResult(data);
            stopScanning();
        }

        // 5. Hiển thị UI kết quả
        function showResult(data) {
            resultDiv.style.display = 'block';
            resultDiv.className = 'overlay'; // Reset class

            let logMsg = "";

            if (data.status === 'approved') {
                resultDiv.classList.add('status-approved');
                resultDiv.innerHTML = `✅ ${data.message}<br>`;
                logMsg = `APPROVED: ${data.message}`;
            } 
            else if (data.status === 'denied') {
                resultDiv.classList.add('status-denied');
                resultDiv.innerHTML = `🚫 ${data.message}<br>`;
                logMsg = `DENIED: Phát hiện giả mạo (Score: ${data.liveness_score.toFixed(4)})`;
            } 
            else {
                // Warning hoặc Unknown
                resultDiv.classList.add('status-warning');
                resultDiv.innerHTML = `⚠️ ${data.message}`;
                logMsg = `WARNING: ${data.message}`;
            }

            log(logMsg);
        }

        // 6. Hàm dừng quét và reset nút
        function stopScanning() {
            isScanning = false;
            btnScan.disabled = false;
            btnScan.innerText = "📸 Quét lại";
        }

    </script>
</body>
</html>
```

---

## File: requirements.txt

```
fastapi
uvicorn
python-multipart
tensorflow
opencv-python
numpy
pillow
jinja2
```
