# Hướng dẫn Kiến trúc & Vận hành — PQ Nihongo Shadowing Local AI

Tài liệu này mô tả chi tiết phần tích hợp **Local AI Model Server** cho module **Shadowing** trong dự án **PQ Nihongo**, tuân thủ nguyên tắc:
- Chỉ tách phụ thuộc Gemini khỏi luồng **đánh giá phát âm Shadowing**.
- Giữ nguyên toàn bộ các tính năng khác của PQ Nihongo (Auth/JWT, Vocab, SRS, Flashcards, Quiz, AI Chat, Image Recognition, Dịch Nhật–Việt, Dịch phụ đề YouTube, Kuromoji/Furigana, Admin, `GeminiClient`, `AiQuotaService`).

---

## 1. Kiến trúc hệ thống

```text
┌───────────────────────────┐
│      React Frontend       │  MediaRecorder (audio/webm|ogg|mp4)
│  ShadowingPractice / List │  + ShadowingEvaluationPanel
└─────────────┬─────────────┘
              │ HTTP / REST (JWT Bearer, multipart/form-data)
              ▼
┌───────────────────────────┐
│    Spring Boot Backend    │  ShadowingController → ShadowingAiService
│   (:8080, ROLE_USER)      │  + Kuromoji (FuriganaService, ShadowingScoringService)
│                           │  + PostgreSQL (shadowing_attempts.evaluation_json)
└─────────────┬─────────────┘
              │ Internal HTTP (WebClient: shadowingAiWebClient)
              ▼
┌───────────────────────────┐
│ Private AI Model Server   │  FastAPI (:8001, private/loopback only)
│     (ai-shadowing/)       │  ├── Qwen/Qwen3-ASR-0.6B (ASR tiếng Nhật)
│                           │  ├── Qwen/Qwen3-ForcedAligner-0.6B (Timestamp Alignment)
│                           │  ├── hatsuon adapter (Mora / Special Mora / Tokyo Pitch / Timing)
│                           │  ├── Experimental F0 Intonation (pYIN + Semitone + DTW + Pause)
│                           │  └── Vietnamese Feedback (Templates / Optional Qwen3-4B)
└───────────────────────────┘
```

---

## 2. Hợp đồng API (Backend REST Endpoints)

Tất cả endpoint đều nằm dưới `/api/v1/shadowing` và yêu cầu xác thực JWT với `ROLE_USER` (không thay đổi `SecurityConfig`).

### Endpoint mới (Local AI Shadowing — không dùng Gemini)

| Method | Path | Content-Type | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/shadowing/ai-status` | `application/json` | Trả về trạng thái sẵn sàng của Local AI (không lộ internal URL) |
| `POST` | `/api/v1/shadowing/lessons/{id}/evaluate` | `multipart/form-data` | Chấm điểm ghi âm bài học/hội thoại, lưu lịch sử `shadowing_attempts` kèm `evaluation_json` |
| `POST` | `/api/v1/shadowing/custom/evaluate` | `multipart/form-data` | Chấm điểm ghi âm câu tự nhập / YouTube segment, lưu lịch sử |
| `POST` | `/api/v1/shadowing/evaluate` | `multipart/form-data` | Đánh giá trực tiếp file audio + `referenceText` (không tạo bản ghi lịch sử) |

**Tham số `multipart/form-data`:**
- `audio` *(bắt buộc)*: file ghi âm người học (`.webm`, `.ogg`, `.wav`, `.mp3`, `.m4a`, `.flac`, tối đa 15 MB, 0.35s–35s).
- `referenceAudio` *(tùy chọn)*: file audio mẫu để chạy so sánh đường cao độ F0 chuẩn hóa theo DTW.
- `lineId`, `expectedTextJa`, `playbackSpeed`, `jlptLevel`, `fallbackTranscript` *(tùy chọn)*.

### Endpoint cũ được giữ nguyên 100% tương thích ngược
- `GET /api/v1/shadowing/lessons`, `GET /api/v1/shadowing/lessons/{id}`
- `POST /api/v1/shadowing/lessons/{id}/attempt` (chấm điểm theo text Kuromoji)
- `POST /api/v1/shadowing/custom-score`
- `GET /api/v1/shadowing/attempts`, `GET /api/v1/shadowing/attempts/{id}` (bản ghi cũ có `evaluation: null`, bản ghi mới có đầy đủ `evaluation`)
- Các endpoint dịch Nhật–Việt & phụ đề YouTube (`/custom/translate`, `/youtube/**`) giữ nguyên.

---

## 3. Cấu trúc kết quả JSON (`evaluation`)

```json
{
  "referenceText": "私は毎日日本語を勉強します。",
  "referenceReading": "わたしはまいにちにほんごをべんきょうします。",
  "recognizedText": "私は毎日日本語を勉強します。",
  "status": "COMPLETED",
  "scores": {
    "overall": 96.7,
    "accuracy": 100.0,
    "completeness": 100.0,
    "pitchAccent": 66.7,
    "intonation": 84.2,
    "timing": 100.0,
    "kuromojiTokenAccuracy": 100.0
  },
  "pronunciation": {
    "available": true,
    "engine": "hatsuon",
    "moraResults": [],
    "wordResults": [],
    "specialMoraSummary": { "sokuonTotal": 0, "sokuonIssues": 0, "moraicNTotal": 2, "moraicNIssues": 0, "longVowelTotal": 1, "longVowelIssues": 0 },
    "errors": [],
    "insertions": []
  },
  "intonation": {
    "experimental": true,
    "f0Available": true,
    "referenceComparisonAvailable": true,
    "reliability": "HIGH",
    "confidence": 0.8,
    "score": 84.2,
    "finalPitchMovement": "FALLING",
    "expectedFinalMovement": "FALLING_OR_FLAT",
    "finalPitchMatch": true,
    "pitchContour": [],
    "pauseAnalysis": [],
    "referenceComparison": { "dtwMaeSemitones": 1.6, "contourCorrelation": 0.72, "durationRatio": 1.07 },
    "feedback": []
  },
  "alignment": { "available": true, "engine": "Qwen/Qwen3-ForcedAligner-0.6B", "segments": [] },
  "asr": { "available": true, "engine": "Qwen/Qwen3-ASR-0.6B", "language": "ja", "recognizedText": "..." },
  "wordDiff": [],
  "kuromojiTokens": [],
  "feedback": { "source": "TEMPLATE", "summary": "...", "explanations": [], "practiceSuggestions": [], "encouragement": "..." },
  "warnings": [],
  "confidence": 0.886
}
```

> **Nguyên tắc trung thực điểm số:** Bất kỳ chỉ số nào không đủ độ tin cậy hoặc thành phần bị tắt/lỗi đều trả `null` kèm cảnh báo trong `warnings`, tuyệt đối không bịa điểm.

---

## 4. Thay đổi Database & Tương thích ngược

- Migration Flyway mới: `backend/src/main/resources/db/migration/V10__add_shadowing_ai_evaluation.sql`:
  ```sql
  ALTER TABLE shadowing_attempts
      ADD COLUMN IF NOT EXISTS evaluation_json TEXT;
  ```
- Không xóa dữ liệu cũ, không đổi tên cột, không ảnh hưởng các bảng ngoài Shadowing.

---

## 5. Biến môi trường cấu hình

### Spring Boot Backend (`.env` / `application.yml`)
```env
SHADOWING_AI_ENABLED=true
SHADOWING_AI_BASE_URL=http://localhost:8001
SHADOWING_TIMEOUT_SECONDS=120
SHADOWING_MAX_AUDIO_MB=15
```

### Private AI Model Server (`ai-shadowing/.env`)
Xem chi tiết tại [ai-shadowing/README.md](../ai-shadowing/README.md) và [ai-shadowing/.env.example](../ai-shadowing/.env.example).

---

## 6. Bảo mật & Quyền riêng tư

- Private AI Server chỉ lắng nghe nội bộ (`127.0.0.1:8001` hoặc `expose: 8001` trong Docker network).
- Spring Boot xác thực JWT (`ROLE_USER`) và kiểm soát quyền sở hữu lịch sử (`attempt.user.id == currentUser.id`).
- File audio người học được kiểm tra định dạng, dung lượng, thời lượng; xử lý qua file WAV tạm và **xóa ngay trong khối `finally`**, không lưu trữ thô lâu dài và không ghi nội dung audio ra log.
- Khi đường dẫn `audioUrl` nội bộ của bài học được dùng làm reference audio, backend kiểm tra chống path traversal trong thư mục `app.upload.dir`.
