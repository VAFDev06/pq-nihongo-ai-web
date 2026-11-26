-- ========================================================
-- V1__init_schema.sql: Khởi tạo toàn bộ 24 bảng dữ liệu PQ Nihongo
-- Chuẩn Mục 7 Tài liệu thiết kế Đồ án 4 VKU
-- ========================================================

-- A. TÀI KHOẢN
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    role VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN')),
    jlpt_level VARCHAR(2) NOT NULL DEFAULT 'N5' CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED')),
    daily_goal_cards INT NOT NULL DEFAULT 20 CHECK (daily_goal_cards > 0),
    ai_daily_limit INT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(100) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(100) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- B. TỪ VỰNG
CREATE TABLE IF NOT EXISTS topics (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_vi VARCHAR(100) NOT NULL,
    name_ja VARCHAR(100),
    description VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vocabularies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word VARCHAR(100) NOT NULL,
    reading VARCHAR(150),
    romaji VARCHAR(150),
    meaning_vi VARCHAR(500) NOT NULL,
    part_of_speech VARCHAR(30),
    jlpt_level VARCHAR(2) CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
    topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL,
    example_ja VARCHAR(500),
    example_vi VARCHAR(500),
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (word, reading)
);
CREATE INDEX IF NOT EXISTS idx_vocab_level ON vocabularies(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_vocab_topic ON vocabularies(topic_id);
CREATE INDEX IF NOT EXISTS idx_vocab_word ON vocabularies(word);

CREATE TABLE IF NOT EXISTS user_vocabularies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vocabulary_id BIGINT REFERENCES vocabularies(id) ON DELETE SET NULL,
    word VARCHAR(100) NOT NULL,
    reading VARCHAR(150),
    romaji VARCHAR(150),
    meaning_vi VARCHAR(500) NOT NULL,
    example_ja VARCHAR(500),
    example_vi VARCHAR(500),
    image_url VARCHAR(500),
    note VARCHAR(1000),
    source VARCHAR(15) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','AI_IMAGE','AI_RECOGNITION','IMPORT','SYSTEM','CONVERSATION')),
    is_mastered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, word, reading)
);
CREATE INDEX IF NOT EXISTS idx_uv_user ON user_vocabularies(user_id, is_mastered);

CREATE TABLE IF NOT EXISTS image_recognitions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    result_json TEXT NOT NULL,
    model VARCHAR(60),
    latency_ms INT,
    is_correct BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recog_user ON image_recognitions(user_id, created_at DESC);

-- F. FLASHCARD / SRS / QUIZ
CREATE TABLE IF NOT EXISTS flashcard_decks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    jlpt_level VARCHAR(2) CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
    topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deck_owner ON flashcard_decks(owner_id);

CREATE TABLE IF NOT EXISTS flashcards (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    user_vocabulary_id BIGINT REFERENCES user_vocabularies(id) ON DELETE SET NULL,
    front VARCHAR(200) NOT NULL,
    reading VARCHAR(200),
    back VARCHAR(500) NOT NULL,
    example_ja VARCHAR(500),
    example_vi VARCHAR(500),
    image_url VARCHAR(500),
    note VARCHAR(1000),
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (deck_id, front, reading)
);
CREATE INDEX IF NOT EXISTS idx_card_deck ON flashcards(deck_id);

CREATE TABLE IF NOT EXISTS card_progress (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flashcard_id BIGINT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    state VARCHAR(12) NOT NULL DEFAULT 'NEW' CHECK (state IN ('NEW','LEARNING','REVIEW','RELEARNING')),
    ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50 CHECK (ease_factor >= 1.30),
    interval_days INT NOT NULL DEFAULT 0,
    repetitions INT NOT NULL DEFAULT 0,
    lapses INT NOT NULL DEFAULT 0,
    due_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (user_id, flashcard_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_due ON card_progress(user_id, due_at);

CREATE TABLE IF NOT EXISTS review_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flashcard_id BIGINT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),
    prev_interval_days INT NOT NULL,
    new_interval_days INT NOT NULL,
    ease_factor NUMERIC(4,2) NOT NULL,
    duration_ms INT,
    reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_review_user_time ON review_logs(user_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS quiz_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id BIGINT NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    quiz_type VARCHAR(15) NOT NULL CHECK (quiz_type IN ('MULTIPLE_CHOICE','FILL_IN','FILL_IN_BLANK','LISTENING')),
    total_questions INT NOT NULL,
    correct_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    flashcard_id BIGINT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_answer VARCHAR(500),
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(15) NOT NULL CHECK (target_type IN ('DECK','SYSTEM_VOCAB')),
    deck_id BIGINT REFERENCES flashcard_decks(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(5) NOT NULL CHECK (file_type IN ('CSV','XLSX')),
    total_rows INT NOT NULL DEFAULT 0,
    success_rows INT NOT NULL DEFAULT 0,
    skipped_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    status VARCHAR(10) NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW','DONE','FAILED')),
    error_report TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- C. SHADOWING
CREATE TABLE IF NOT EXISTS shadowing_lessons (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    text_ja VARCHAR(1000) NOT NULL,
    text_vi VARCHAR(1000),
    jlpt_level VARCHAR(2) NOT NULL CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
    topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL,
    audio_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shadow_level ON shadowing_lessons(jlpt_level, is_active);

CREATE TABLE IF NOT EXISTS shadowing_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id BIGINT NOT NULL REFERENCES shadowing_lessons(id) ON DELETE CASCADE,
    recognized_text VARCHAR(2000) NOT NULL,
    accuracy NUMERIC(5,2) NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
    word_diff TEXT NOT NULL,
    audio_url VARCHAR(500),
    playback_speed NUMERIC(3,2) DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attempt_user ON shadowing_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempt_lesson ON shadowing_attempts(lesson_id);

-- D. HỘI THOẠI AI
CREATE TABLE IF NOT EXISTS conversation_topics (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_vi VARCHAR(100) NOT NULL,
    name_ja VARCHAR(100),
    description VARCHAR(500),
    icon VARCHAR(50),
    jlpt_level VARCHAR(2) CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id BIGINT REFERENCES conversation_topics(id) ON DELETE SET NULL,
    jlpt_level VARCHAR(2) NOT NULL CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
    title VARCHAR(200),
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED')),
    summary TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('USER','AI','ASSISTANT','SYSTEM')),
    content_ja TEXT NOT NULL,
    content_vi TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_corrections (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_text VARCHAR(500) NOT NULL,
    corrected_text VARCHAR(500) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('GRAMMAR','VOCAB','PARTICLE','POLITENESS','OTHER')),
    explanation_vi VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_corr_user ON conversation_corrections(user_id, category);

-- E. TIẾN ĐỘ
CREATE TABLE IF NOT EXISTS user_daily_stats (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    words_added INT NOT NULL DEFAULT 0,
    cards_reviewed INT NOT NULL DEFAULT 0,
    quiz_count INT NOT NULL DEFAULT 0,
    shadowing_count INT NOT NULL DEFAULT 0,
    conversation_count INT NOT NULL DEFAULT 0,
    recognition_count INT NOT NULL DEFAULT 0,
    study_minutes INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, stat_date)
);

-- H. ADMIN / HỆ THỐNG
CREATE TABLE IF NOT EXISTS ai_call_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    feature VARCHAR(30) NOT NULL CHECK (feature IN ('RECOGNITION','IMAGE_RECOGNITION','CONVERSATION','SHADOWING','GRAMMAR_CORRECTION','OTHER')),
    model VARCHAR(60) NOT NULL,
    prompt_tokens INT,
    completion_tokens INT,
    latency_ms INT,
    status VARCHAR(15) NOT NULL CHECK (status IN ('SUCCESS','ERROR','TIMEOUT','RATE_LIMIT')),
    error_message VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ailog_time ON ai_call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ailog_user_day ON ai_call_logs(user_id, created_at);

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description VARCHAR(500),
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT,
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);