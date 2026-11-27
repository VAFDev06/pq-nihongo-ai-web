# Báo cáo Kiểm thử & Đánh giá — PQ Nihongo Shadowing Local AI

**Ngày thực hiện:** 2026-11-27  
**Môi trường đo thực tế:**
- OS: Windows (x64), RAM 15.71 GB
- GPU: NVIDIA GeForce RTX 3050 Ti Laptop GPU (**4095 MB VRAM**, `lowVramMode=true` tự động bật)
- Python: `3.13.14` (`torch 2.14.1+cu126`, `qwen-asr 0.0.6`, `hatsuon 0.1.2`, `pyopenjtalk-plus 0.4.1.post10`, `librosa 1.0.1`, `av 19.0.2`)
- Models:
  - ASR: `Qwen/Qwen3-ASR-0.6B` (fp16, peak ~1.57 GB VRAM)
  - Alignment: `Qwen/Qwen3-ForcedAligner-0.6B` (fp16, peak ~1.85 GB VRAM)
  - Pronunciation: `hatsuon` ONNX `int8` (`122 MB`, CPU)
  - Sentence Intonation: `f0-pyin-dtw-experimental` (CPU)
  - Feedback: Deterministic Vietnamese Templates (`SHADOWING_FEEDBACK_MODEL_ENABLED=false`)
  - **Gemini API:** Không sử dụng (`geminiUsed: false`)

> **Tuyên bố minh bạch về nguồn dữ liệu audio kiểm thử:**  
> Các mẫu audio 01–15 được tạo bằng TTS tiếng Nhật chuẩn bản xứ (`edge-tts`: `ja-JP-NanamiNeural`, `ja-JP-KeitaNeural`) và các mẫu 16–20 được tạo bằng biến thể lỗi phát âm mô phỏng (thiếu trợ từ, rút ngắn trường âm, chèn khoảng ngắt nghỉ `+0.7s`, dịch cao độ `+4 bán cung` + kéo chậm `0.82x`, đọc câu trần thuật thay cho câu hỏi). Đây là dữ liệu tổng hợp/mô phỏng phục vụ kiểm chứng kỹ thuật pipeline; cần tiếp tục thu thập và kiểm định thêm trên bản ghi thực tế của học viên tiếng Nhật (L2) trước khi coi điểm số như chuẩn đánh giá chính thức.

---

## 1. Tổng hợp kết quả kiểm thử tự động

| Thành phần | Lệnh chạy | Kết quả | Chi tiết |
|---|---|---|---|
| Private AI Server (`ai-shadowing`) | `pytest -v` | **14 / 14 PASSED** | Audio validation, F0 intonation (rising/falling/cross-speaker DTW/noise), `/health`, `/intonation/analyze`, full `/shadowing/evaluate` |
| Spring Boot Backend (`backend`) | `.\mvnw.cmd test` | **14 / 14 PASSED** | `AuthValidationTest` (1), `SrsServiceTest` (5), `ShadowingScoringServiceTest` (4), `ShadowingAiServiceTest` (4) |
| React Frontend (`frontend`) | `npm run build` | **PASSED** | Production Vite bundle sạch, không lỗi |
| Bộ đánh giá tiếng Nhật 20+2 mẫu | `scripts/run_evaluation_suite.py` | **20/20 HTTP 200, 2/2 Edge HTTP 400** | Thời gian trung bình trạng thái ấm: **~5.1 giây/câu** trên GPU 4GB (không OOM) |

---

## 2. Kết quả đo chi tiết trên 20 mẫu câu tiếng Nhật

| ID | Nhóm kiểm thử (JLPT) | Câu mẫu (`referenceText`) | Audio người học / Audio mẫu | Kết quả ASR (`Qwen3-ASR-0.6B`) | Pronunciation (`overall` / `acc` / `comp` / `timing`) | Pitch Accent (`hatsuon`) | Intonation F0 *(Experimental)* | Confidence | Thời gian |
|---|---|---|---|---|---|---|---|---:|---:|
| 01 | Hiragana (N5) | `おはよう。きょうはいいてんきですね。` | `01_hiragana.wav` / — | `おはよう今日はいい天気ですね。` | 95.0 / 100.0 / 100.0 / 75.0 | 100.0 | 88.8 (`FALLING`, khớp ✓) | 0.789 | 103.69s *(cold load)* |
| 02 | Katakana (N5) | `コーヒーとサンドイッチをください。` | `02_katakana.wav` / — | `コーヒーとサンドイッチをください。` | 100.0 / 100.0 / 100.0 / 100.0 | 100.0 | 93.8 (`FALLING`, khớp ✓) | 0.810 | 5.39s |
| 03 | Kanji + Cross-speaker ref (N5) | `私は毎日日本語を勉強します。` | `03_kanji.wav` (nữ) / `03_kanji_ref_male.wav` (nam) | `私は毎日日本語を勉強します。` | 96.7 / 100.0 / 100.0 / 100.0 | 66.7 *(「私」 Heiban false-fall)* | 91.5 (`FLAT`, DTW MAE `1.50st`, corr `0.803`) | 0.795 | 6.27s |
| 04 | Long vowels 長音 (N4) | `おばあさんは東京の高校の先生です。` | `04_long_vowel.wav` / — | `おばあさんは東京の高校の先生です。` | 95.0 / 100.0 / 100.0 / 100.0 | 50.0 *(東京/高校 Heiban)* | 93.8 (`FALLING`, khớp ✓) | 0.795 | 5.65s |
| 05 | Small っ 促音 (N4) | `きってを買って、ちょっと待ってください。` | `05_sokuon_tsu.wav` / — | `切手を買ってちょっと待ってください。` | 95.0 / 100.0 / 100.0 / 100.0 *(4/4 `っ` đạt)* | 50.0 | 93.8 (`FALLING`, khớp ✓) | 0.810 | 5.66s |
| 06 | Moraic ん 撥音 (N5) | `にほんごのしんぶんをよんでいます。` | `06_moraic_n.wav` / — | `日本語の新聞を読んでいます。` | 95.0 / 100.0 / 100.0 / 100.0 *(4/4 `ん` đạt)* | 50.0 | 93.8 (`FALLING`, khớp ✓) | 0.791 | 4.68s |
| 07 | Similar sounds `りょ/りょう` (N4) | `りょこうでりょうりをたべました。` | `07_similar_sounds.wav` / — | `旅行で料理を食べました。` | 95.0 / 100.0 / 100.0 / 100.0 *(2/2 trường âm đạt)* | 50.0 | 93.8 (`FLAT`, khớp ✓) | 0.788 | 4.48s |
| 08 | Short sentence (N5) | `ありがとうございます。` | `08_short_sentence.wav` / — | `ありがとうございます。` | 100.0 / 100.0 / 100.0 / 100.0 | 100.0 | 76.3 (`RISING`, không khớp trần thuật) | 0.780 | 3.88s |
| 09 | Long sentence (N3) | `昨日の夜、友達と一緒に駅前の新しいレストランで美味しいラーメンを食べました。` | `09_long_sentence.wav` / — | Trùng khớp 100% (18 đoạn align) | 96.7 / 100.0 / 100.0 / 100.0 | 66.7 | 91.8 (`FALLING`, khớp ✓) | 0.742 | 7.82s |
| 10 | Question (N5) | `あしたは学校へ行きますか？` | `10_question.wav` / — | `明日は学校へ行きますか。` | 100.0 / 100.0 / 100.0 / 100.0 | 100.0 | 93.8 (**`RISING`**, khớp câu hỏi ✓) | 0.766 | 4.67s |
| 11 | Statement (N5) | `あしたは学校へ行きます。` | `11_statement.wav` / — | `明日は学校へ行きます。` | 100.0 / 100.0 / 100.0 / 100.0 | 100.0 | 93.8 (**`FLAT`**, khớp trần thuật ✓) | 0.762 | 4.85s |
| 12 | Slow speed `-30%` (N5) | `東京に行きます。` | `12_slow_speed.wav` / — | `東京に行きます。` | 100.0 / 100.0 / 100.0 / 100.0 | 100.0 | 93.8 (`FLAT`, reliability `HIGH`) | 0.776 | 4.44s |
| 13 | Fast speed `+25%` (N5) | `東京に行きます。` | `13_fast_speed.wav` / — | `東京に行きます。` | 90.0 / 100.0 / 100.0 / 100.0 | 0.0 *(nhạy tốc độ cao)* | 93.8 (`FLAT`, khớp ✓) | 0.776 | 3.99s |
| 14 | Pitch pair `橋` vs `箸` (N3) | `橋を渡って、箸で食べます。` | `14_pitch_pair_hashi.wav` / — | `橋を渡って橋で食べます。` | 100.0 / 100.0 / 100.0 / 100.0 | 100.0 | 84.6 (`FALLING`, khớp ✓) | 0.791 | 4.84s |
| 15 | Pitch pair `雨` vs `飴` (N4) | `雨が降る日に飴を食べます。` | `15_pitch_pair_ame.wav` / — | `雨が降る日に雨を食べます。` | 100.0 / 100.0 / 100.0 / `null` | 100.0 | 93.8 (`FLAT`, khớp ✓) | 0.790 | 4.86s |
| 16 | **Learner sim:** bỏ sót trợ từ `を` (N5) | `私は毎日日本語を勉強します。` | `16_learner_omission.wav` / `03_kanji_ref_male.wav` | **`私は毎日日本語勉強します。`** *(bắt đúng thiếu `を`)* | 100.0 / 100.0 / 100.0 / 100.0 *(xem giới hạn mục 4)* | 100.0 | 99.3 (`FALLING`, DTW `0.46st`) | 0.795 | 4.81s |
| 17 | **Learner sim:** sai trường âm `おばさん` vs `おばあさん` (N4) | `おばあさんは東京の高校の先生です。` | `17_learner_short_vowel.wav` / `04_long_vowel.wav` | **`おばさんは東京の高校の先生です。`** *(bắt đúng sai trường âm)* | 97.5 / 100.0 / 100.0 / 100.0 | 75.0 *(phát hiện lỗi trọng âm `おばあさん`)* | 95.9 (`FALLING`, DTW `1.01st`) | 0.795 | 5.82s |
| 18 | **Learner sim:** ngắt nghỉ `+0.7s` giữa câu (N5) | `私は毎日日本語を勉強します。` | `18_learner_long_pause.wav` / `03_kanji_ref_male.wav` | `私は毎日日本語を勉強します。` | 96.7 / 100.0 / 100.0 / 100.0 | 66.7 | **87.0** *(phát hiện `pauseCount=1`, `durationRatio=1.36x`)* | 0.795 | 5.78s |
| 19 | **Learner sim:** dịch cao độ `+4st` & chậm `0.82x` (N5) | `私は毎日日本語を勉強します。` | `19_learner_pitch_speed_diff.wav` / `03_kanji_ref_male.wav` | `私は毎日日本語を勉強します。` | 96.7 / 100.0 / 100.0 / 100.0 | 66.7 | **89.8** *(chuẩn hóa bán cung + DTW giữ MAE `1.43st` dù chênh cao độ/tốc độ)* | 0.795 | 5.99s |
| 20 | **Learner sim:** câu trần thuật thay cho câu hỏi (N5) | `あしたは学校へ行きますか？` | `11_statement.wav` / `10_question.wav` | **`明日は学校へ行きます。`** *(bắt đúng thiếu `か`)* | **88.2 / 92.9 / 92.9 / 100.0** *(bắt đúng mora `カ` bị bỏ sót)* | 100.0 | 90.4 (**`FLAT` ≠ `RISING`**, `finalPitchMatch=false` ✓) | 0.762 | 4.77s |

---

## 3. Kiểm thử Edge Cases & Xử lý lỗi

| ID | Kịch bản | HTTP Status | Kết quả thực tế |
|---|---|---:|---|
| E1 | File im lặng 2.0 giây (`20_edge_silence.wav`) | `400` | `{"code": "SILENT_AUDIO", "message": "Bản ghi gần như im lặng..."}` — từ chối sạch, không bịa điểm |
| E2 | File quá ngắn 0.1 giây (`21_edge_too_short.wav`) | `400` | `{"code": "AUDIO_TOO_SHORT", "message": "Bản ghi âm quá ngắn (0.10 giây)..."}` |
| Unit | File rỗng / sai định dạng (`.pdf`) / hỏng byte | `400` / `415` | Trả mã lỗi rõ ràng (`EMPTY_AUDIO`, `UNSUPPORTED_AUDIO_FORMAT`, `INVALID_AUDIO`) |
| Unit | Nhiễu trắng không hữu thanh (F0) | `200` | `f0Available=false`, `score=null`, `reliability="UNRELIABLE"` — tuyệt đối không bịa điểm |
| Unit | Local AI server offline + có `fallbackTranscript` | `200` | Spring Boot giảm cấp an toàn sang `PARTIAL` (chỉ có Kuromoji wordDiff, toàn bộ điểm AI = `null` + cảnh báo rõ) |

---

## 4. Phân tích & Các giới hạn đã ghi nhận từ đo đạc thực tế

1. **Hiệu quả phối hợp đa model (ASR + Kuromoji + hatsuon + F0):**
   - Ở mẫu 16 (bỏ sót trợ từ `を` đứng ngay sau `ご` kết thúc bằng âm `/o/`) và mẫu 17 (`おばさん` thay vì `おばあさん`), bộ căn chỉnh CTC của `hatsuon` có thể hấp thụ nguyên âm lân cận nên vẫn chấm `accuracy=100.0`, trong khi `Qwen3-ASR-0.6B` + đối chiếu token **Kuromoji** bắt trúng ngay lập tức lỗi thiếu từ / sai trường âm.
   - Ngược lại, ở mẫu 14–15 (từ đồng âm khác Kanji `橋/箸`, `雨/飴`), ASR viết thành cùng 1 Kanji nhưng **Kuromoji** so khớp theo cách đọc Hiragana và `hatsuon` phân tích trực tiếp tín hiệu âm thanh trọng âm Tokyo.
2. **Giới hạn của `hatsuon` alpha (0.1.2):**
   - Tỉ lệ báo nhầm hạ giọng trên từ Heiban (`fall_for_unaccented`) xuất hiện rõ ở các mẫu 03, 04, 05, 06, 09, 13 (đặc biệt khi tốc độ nói nhanh `+25%` ở mẫu 13).
   - Chưa hiệu chuẩn trên dữ liệu người học tiếng Nhật (L2) thực tế; giao diện đã hiển thị cảnh báo minh bạch cho người học.
3. **Giới hạn của module Ngữ điệu F0 thử nghiệm (`experimental=true`):**
   - Phân biệt tốt câu hỏi lên giọng (`10_question`: `RISING`) vs trần thuật (`11_statement`: `FLAT`), phát hiện tốt ngắt nghỉ giữa câu (`18_learner_long_pause`), và kháng tốt sự khác biệt cao độ giới tính & tốc độ nói nhờ chuẩn hóa bán cung + DTW (`03_kanji` nữ vs nam: MAE `1.50st`, `19_learner_pitch_speed_diff` +4st & 0.82x: MAE `1.43st`).
   - Một số câu ngắn như `ありがとうございます。` (mẫu 08) có nguyên âm cuối vô thanh hóa (`/su/`) làm đuôi hữu thanh cuối cùng rơi vào `ま` (cao độ đang lên nhẹ trước khi hạ), khiến bộ phát hiện cuối câu nhận nhầm `RISING`. Do đó kết quả F0 luôn được gắn nhãn **Thử nghiệm (Experimental)** kèm độ tin cậy.
4. **Hiệu năng trên GPU 4GB VRAM:**
   - Lần chạy đầu tiên nạp model từ cache ổ `D:` mất ~100s (cả ASR + Aligner + `pyopenjtalk`), từ lần thứ 2 trở đi mỗi request đánh giá đầy đủ mất **3.9s – 7.8s** nhờ cơ chế giữ model trên host RAM và offload tuần tự lên GPU (`lowVramMode=true`).
