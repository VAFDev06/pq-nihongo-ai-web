-- =================================================================================
-- V6: NÂNG CẤP MODULE SRS (ĐỒNG BỘ 100% DASHBOARD & LỊCH SỬ ÔN TẬP)
--     VÀ HỘI THOẠI GIA SƯ TIẾNG NHẬT 1-1 (VOICE MODE, GỢI Ý CÂU, HỎI GIA SƯ TIẾNG VIỆT)
-- =================================================================================

-- 1. Bổ sung review_count cho card_progress và đồng bộ toàn bộ thẻ trong bộ thẻ cá nhân vào card_progress
ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0;

UPDATE card_progress cp
SET review_count = GREATEST(
    cp.repetitions + cp.lapses,
    COALESCE((
        SELECT COUNT(*)::INT FROM review_logs rl
        WHERE rl.user_id = cp.user_id AND rl.flashcard_id = cp.flashcard_id
    ), 0)
);

INSERT INTO card_progress (user_id, flashcard_id, state, ease_factor, interval_days, repetitions, lapses, review_count, due_at)
SELECT d.owner_id, f.id, 'NEW', 2.50, 0, 0, 0, 0, NOW()
FROM flashcards f
JOIN flashcard_decks d ON f.deck_id = d.id
WHERE d.owner_id IS NOT NULL
  AND d.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM card_progress cp
      WHERE cp.user_id = d.owner_id AND cp.flashcard_id = f.id
  );

-- 2. Bổ sung prev_due_at và next_due_at cho bảng lịch sử ôn tập review_logs
ALTER TABLE review_logs ADD COLUMN IF NOT EXISTS prev_due_at TIMESTAMPTZ;
ALTER TABLE review_logs ADD COLUMN IF NOT EXISTS next_due_at TIMESTAMPTZ;

-- 3. Bổ sung chế độ Gia sư 1-1 (tutor_mode, chat_mode) và gợi ý câu trả lời / giải thích gia sư
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tutor_mode VARCHAR(30) NOT NULL DEFAULT 'ROLEPLAY';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS chat_mode VARCHAR(15) NOT NULL DEFAULT 'CHAT';

ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'CHAT';
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS suggested_replies_json TEXT;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS tutor_answer_json TEXT;
