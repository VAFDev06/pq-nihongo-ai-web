-- =================================================================================
-- V7: YOUTUBE VIDEO SHADOWING PERSISTENCE + VIETNAMESE TRANSLATION
--     AND SYSTEM TEMPLATE DECK STATUS (DRAFT / PUBLISHED / ARCHIVED)
-- =================================================================================

-- 1. Bảng lưu metadata video YouTube đã trích xuất transcript (tránh gọi AI/YouTube lặp lại)
CREATE TABLE IF NOT EXISTS youtube_video_transcripts (
    video_id VARCHAR(20) PRIMARY KEY,
    title VARCHAR(300),
    author VARCHAR(200),
    duration_seconds INT,
    extract_method VARCHAR(50),
    method_label VARCHAR(150),
    language VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng lưu từng câu transcript YouTube kèm Hiragana, bản dịch tiếng Việt & timestamp
CREATE TABLE IF NOT EXISTS youtube_video_sentences (
    id BIGSERIAL PRIMARY KEY,
    video_id VARCHAR(20) NOT NULL REFERENCES youtube_video_transcripts(video_id) ON DELETE CASCADE,
    sentence_order INT NOT NULL,
    japanese_text TEXT NOT NULL,
    hiragana_text TEXT,
    vietnamese_translation TEXT,
    translation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    start_time DOUBLE PRECISION NOT NULL,
    end_time DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_youtube_video_sentence_order UNIQUE (video_id, sentence_order)
);

CREATE INDEX IF NOT EXISTS idx_youtube_video_sentences_video ON youtube_video_sentences(video_id, sentence_order);

-- 3. Bổ sung trạng thái xuất bản (DRAFT, PUBLISHED, ARCHIVED) và ảnh đại diện cho bộ thẻ mẫu
ALTER TABLE flashcard_decks ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE flashcard_decks ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);

UPDATE flashcard_decks
SET status = CASE
    WHEN is_active = FALSE THEN 'ARCHIVED'
    WHEN is_system = TRUE AND is_public = FALSE THEN 'DRAFT'
    ELSE 'PUBLISHED'
END;
