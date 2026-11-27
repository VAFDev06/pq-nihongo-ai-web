# PQ Nihongo — Private Shadowing AI Model Server

Dịch vụ AI cục bộ (nội bộ) dành riêng cho module **Japanese Shadowing** của **PQ Nihongo**, thay thế hoàn toàn nhu cầu gọi Gemini API trong luồng đánh giá phát âm Shadowing.

> **Bảo mật & Phạm vi:** Dịch vụ này chỉ lắng nghe nội bộ (`127.0.0.1:8001` hoặc mạng Docker private) để **Spring Boot Backend** gọi sang. Không mở công khai trực tiếp cho trình duyệt.

---

## 1. Kiến trúc & Các model sử dụng

```text
React Frontend (MediaRecorder)
        │  HTTP / REST (JWT Auth)
        ▼
Spring Boot Backend (:8080, PostgreSQL + Kuromoji)
        │  Internal HTTP (multipart/form-data)
        ▼
Private Shadowing AI Server (:8001)
  ├── Audio Preprocessor (PyAV + soundfile → 16kHz mono PCM16 WAV tạm, xóa sau xử lý)
  ├── Qwen/Qwen3-ASR-0.6B               → Nhận diện giọng nói tiếng Nhật (ja)
  ├── Qwen/Qwen3-ForcedAligner-0.6B     → Căn chỉnh mốc thời gian chữ – âm thanh
  ├── hatsuon (CPU ONNX int8, adapter)  → Chấm mora, mora đặc biệt (っ/ん/ー), trọng âm Tokyo, timing
  ├── Experimental F0 Intonation Module → Trích xuất F0 (pYIN), chuẩn hóa bán cung, DTW, ngắt nghỉ, cuối câu
  └── Feedback Generator                → Giải thích tiếng Việt (template mặc định; tùy chọn Qwen3-4B cục bộ)
```

---

## 2. Yêu cầu tài nguyên & Lưu trữ model

| Thành phần | Dung lượng đĩa (ước tính) | Thiết bị chạy | Ghi chú 4GB VRAM |
|---|---:|---|---|
| Virtual environment + PyTorch CUDA 12.6 | ~6.5 GB | GPU/CPU | Có thể dùng PyTorch CPU-only (~1.5 GB) |
| `Qwen/Qwen3-ASR-0.6B` | ~1.8 GB | CUDA fp16 (~1.57 GB VRAM) / CPU fp32 | Tự offload tuần tự khi VRAM ≤ 6 GB |
| `Qwen/Qwen3-ForcedAligner-0.6B` | ~1.9 GB | CUDA fp16 (~1.85 GB VRAM) / CPU fp32 | Tự offload tuần tự khi VRAM ≤ 6 GB |
| `hatsuon` ONNX `int8` (`model.onnx`) | ~122 MB (+ ~400 MB HF cache khi export) | CPU ONNX Runtime | Chạy CPU, warm ~0.43s |
| Experimental F0 Intonation (`librosa.pyin`) | 0 MB | CPU | Không tốn VRAM |
| Tùy chọn `Qwen/Qwen3-4B` (mặc định tắt) | ~8 GB | GPU ≥ 8–10 GB / CPU | Tắt mặc định (`SHADOWING_FEEDBACK_MODEL_ENABLED=false`) |

**Cơ chế bảo vệ 4GB VRAM (`DeviceManager`):**
- Khi `SHADOWING_LOW_VRAM_MODE=auto` (mặc định) và GPU có ≤ 6 GB VRAM (ví dụ RTX 3050 Ti 4 GB), cả `Qwen3-ASR-0.6B` và `Qwen3-ForcedAligner-0.6B` được cache một lần trong RAM máy chủ và nạp tuần tự lên GPU qua mutex lock (peak VRAM ~1.85 GB, tránh OOM do giữ cả hai model cùng lúc ~3.4 GB).
- Nếu vẫn gặp `CUDA OutOfMemoryError`, dịch vụ tự động giải phóng VRAM và fallback sang CPU.

---

## 3. Cài đặt lần đầu

### Bước 1: Tạo Virtual Environment

```powershell
cd ai-shadowing
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
```

### Bước 2: Cài PyTorch (chọn 1 trong 2)

```powershell
# Nếu có GPU NVIDIA (CUDA 12.6)
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu126

# Hoặc CPU-only (baseline ổn định trên mọi máy)
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### Bước 3: Cài dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

> **Lưu ý Windows Python 3.13+:** Gói `pyopenjtalk` gốc chỉ phân phối source `.tar.gz` cần CMake/MSVC. `requirements.txt` sử dụng `pyopenjtalk-plus` (prebuilt binary wheel cho Windows cp310–cp314, cung cấp trực tiếp module `pyopenjtalk` cho `hatsuon`) cùng `hatsuon[audio,onnx,export]`. Trên Linux/Docker vẫn có thể dùng `hatsuon[all,export]`.

### Bước 4: Export acoustic model của `hatsuon` (chỉ chạy 1 lần)

```powershell
# Trỏ thư mục lưu model vào ai-shadowing/.cache (tránh chiếm dung lượng ổ C:)
$env:HF_HOME = "$PWD\.cache\huggingface"
$env:HATSUON_MODEL_DIR = "$PWD\.cache\hatsuon"
.\.venv\Scripts\python.exe scripts\export_hatsuon_model.py
```

Kết quả mong đợi: tạo thành công `.cache/hatsuon/model.onnx` (~122 MB).

---

## 4. Cấu hình môi trường (`.env`)

Sao chép `.env.example` sang `.env` và điều chỉnh nếu cần:

```env
SHADOWING_HOST=127.0.0.1
SHADOWING_PORT=8001
SHADOWING_DEVICE=auto               # auto | cpu | cuda
SHADOWING_LOW_VRAM_MODE=auto        # auto | true | false
SHADOWING_PRELOAD_MODELS=false      # true để nạp sẵn model khi khởi động
SHADOWING_ASR_MODEL=Qwen/Qwen3-ASR-0.6B
SHADOWING_ALIGNER_MODEL=Qwen/Qwen3-ForcedAligner-0.6B
SHADOWING_PRONUNCIATION_ENABLED=true
SHADOWING_INTONATION_ENABLED=true
SHADOWING_FEEDBACK_MODEL_ENABLED=false
SHADOWING_FEEDBACK_MODEL=Qwen/Qwen3-4B
SHADOWING_MAX_FILE_SIZE_MB=15
SHADOWING_MIN_AUDIO_SECONDS=0.35
SHADOWING_MAX_AUDIO_SECONDS=35
SHADOWING_TIMEOUT_SECONDS=120
```

> Không đặt bất kỳ Gemini API key hay secret công khai nào trong cấu hình Shadowing.

---

## 5. Khởi động dịch vụ

Cách 1 — Chạy nhanh trên Windows từ thư mục gốc dự án:
```powershell
.\run-ai-shadowing.bat
```

Cách 2 — Chạy trực tiếp bằng `uvicorn`:
```powershell
cd ai-shadowing
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1
```

Kiểm tra sức khỏe:
```powershell
curl http://127.0.0.1:8001/health
```

---

## 6. Internal API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/health` | Kiểm tra trạng thái thiết bị, VRAM mode và từng thành phần model |
| `POST` | `/asr/transcribe` | Nhận diện lời nói tiếng Nhật (`audio`, optional `referenceText`, `language=ja`) |
| `POST` | `/alignment/align` | Căn chỉnh timestamp chữ – âm thanh (`audio`, `referenceText`, `language=ja`) |
| `POST` | `/pronunciation/score` | Chấm phát âm mora, mora đặc biệt & trọng âm Tokyo qua `hatsuon` (`audio`, `referenceText`) |
| `POST` | `/intonation/analyze` | Phân tích ngữ điệu câu F0 thử nghiệm (`audio`, `referenceText`, optional `referenceAudio`) |
| `POST` | `/shadowing/evaluate` | Pipeline đầy đủ kết hợp tất cả thành phần + feedback tiếng Việt |

---

## 7. Chạy kiểm thử

```powershell
cd ai-shadowing
.\.venv\Scripts\python.exe -m pytest -v
```

Chạy bộ đánh giá toàn diện 20 mẫu câu tiếng Nhật + 2 edge cases:
```powershell
.\.venv\Scripts\python.exe scripts\run_evaluation_suite.py
```

---

## 8. Giới hạn kỹ thuật đã biết

1. **`hatsuon` đang ở giai đoạn alpha (0.1.2):** Ngưỡng chấm hiện được hiệu chuẩn trên dữ liệu người Nhật bản xứ (JSUT/JVS), chưa hiệu chuẩn trên tập dữ liệu người học L2. Khoảng ~9% cụm từ Heiban chuẩn vẫn có thể bị báo nhầm `fall_for_unaccented`. Luôn xem điểm số là gợi ý luyện tập, không phải điểm thi chính thức.
2. **Mora tương đồng & đồng hóa âm:** Một số trợ từ đồng âm với nguyên âm liền trước (ví dụ `ご` + `を`) có thể được CTC alignment của `hatsuon` hấp thụ; do đó cần kết hợp cùng kết quả nhận diện của `Qwen3-ASR-0.6B` và so khớp token `Kuromoji`.
3. **Ngữ điệu câu F0 mang tính thử nghiệm (`experimental=true`):** Khi không có audio mẫu đi kèm (`referenceAudio`), điểm ngữ điệu chỉ ước lượng từ độ biến thiên F0, xu hướng cao độ cuối câu và nhịp ngắt nghỉ với độ tin cậy bị giới hạn (`≤ 0.62`). Khi tín hiệu F0 không đủ rõ (`voicedRatio < 0.15`), hệ thống trả `score = null`, tuyệt đối không bịa điểm.
4. **ForcedAligner không phải bộ chấm phát âm:** Mốc thời gian từ `Qwen3-ForcedAligner-0.6B` chỉ dùng cho đồng bộ thời lượng/nhịp độ, không dùng làm bằng chứng phát âm đúng.
