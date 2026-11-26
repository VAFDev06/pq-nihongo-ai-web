-- ============================================================================
-- V8: SRS 6-Level System, Dedicated Topic Status/JLPT, Dialogue Shadowing (A/B)
-- Non-destructive migration: preserves all existing users, decks, vocab & logs.
-- ============================================================================

-- 1. Upgrade card_progress to SRS 6 Levels (0..5)
ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS srs_level SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE card_progress ALTER COLUMN due_at DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_card_progress_srs_level'
    ) THEN
        ALTER TABLE card_progress ADD CONSTRAINT chk_card_progress_srs_level CHECK (srs_level BETWEEN 0 AND 5);
    END IF;
END $$;

-- Non-destructive migration of existing SRS rows from legacy 4-rating SM-2 to 6-level model
-- Never auto-promote legacy cards to Level 5 (permanent mastered); cap migrated rows at Level 4.
UPDATE card_progress
SET srs_level = CASE
        WHEN state = 'NEW' OR review_count = 0 THEN 0
        WHEN state IN ('RELEARNING', 'LEARNING') OR interval_days <= 1 THEN 1
        WHEN interval_days BETWEEN 2 AND 5 THEN 2
        WHEN interval_days BETWEEN 6 AND 12 THEN 3
        ELSE 4
    END,
    due_at = CASE
        WHEN state = 'NEW' OR review_count = 0 THEN NULL
        ELSE due_at
    END,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_card_progress_user_level_due
    ON card_progress (user_id, srs_level, due_at);

-- 2. Upgrade review_logs for 6-Level SRS and Relearn Mode history (immutable log)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'review_logs'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%rating%'
    ) LOOP
        EXECUTE format('ALTER TABLE review_logs DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE review_logs ADD COLUMN IF NOT EXISTS previous_level SMALLINT;
ALTER TABLE review_logs ADD COLUMN IF NOT EXISTS new_level SMALLINT;
ALTER TABLE review_logs ADD COLUMN IF NOT EXISTS review_mode VARCHAR(20) NOT NULL DEFAULT 'DUE_REVIEW';

UPDATE review_logs
SET new_level = LEAST(GREATEST(COALESCE(rating, 1), 1), 5)
WHERE new_level IS NULL;

-- 3. Upgrade topics for dedicated Admin Topic Management (JLPT level + ACTIVE/INACTIVE status)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS jlpt_level VARCHAR(2);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE topics
SET status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END
WHERE status IS NULL OR status = '';

-- 4. Upgrade shadowing_lessons for Dialogue Shadowing (A/B) & Publish Status
ALTER TABLE shadowing_lessons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE shadowing_lessons ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE shadowing_lessons ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);
ALTER TABLE shadowing_lessons ADD COLUMN IF NOT EXISTS is_dialogue BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE shadowing_lessons
SET status = CASE WHEN is_active THEN 'PUBLISHED' ELSE 'ARCHIVED' END
WHERE status IS NULL OR status = '';

CREATE TABLE IF NOT EXISTS shadowing_dialogue_lines (
    id BIGSERIAL PRIMARY KEY,
    lesson_id BIGINT NOT NULL REFERENCES shadowing_lessons(id) ON DELETE CASCADE,
    line_order INT NOT NULL DEFAULT 1,
    speaker VARCHAR(50) NOT NULL DEFAULT 'A',
    japanese_text TEXT NOT NULL,
    hiragana_text TEXT,
    vietnamese_translation TEXT,
    audio_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadowing_dialogue_lines_lesson_order
    ON shadowing_dialogue_lines (lesson_id, line_order);

-- Backfill 1 dialogue line for any existing single-sentence lessons that don't have lines yet
INSERT INTO shadowing_dialogue_lines (lesson_id, line_order, speaker, japanese_text, hiragana_text, vietnamese_translation)
SELECT sl.id, 1, 'A', sl.text_ja, NULL, sl.text_vi
FROM shadowing_lessons sl
WHERE NOT EXISTS (
    SELECT 1 FROM shadowing_dialogue_lines sdl WHERE sdl.lesson_id = sl.id
);

-- Seed 2 rich published A/B dialogue lessons if not already present
DO $$
DECLARE
    v_topic_id BIGINT;
    v_lesson1_id BIGINT;
    v_lesson2_id BIGINT;
BEGIN
    SELECT id INTO v_topic_id FROM topics ORDER BY id ASC LIMIT 1;

    IF NOT EXISTS (SELECT 1 FROM shadowing_lessons WHERE title = 'Bài 1: Chào hỏi và giới thiệu bản thân (Hội thoại A/B)') THEN
        INSERT INTO shadowing_lessons (title, description, text_ja, text_vi, jlpt_level, topic_id, is_active, status, is_dialogue)
        VALUES (
            'Bài 1: Chào hỏi và giới thiệu bản thân (Hội thoại A/B)',
            'Luyện phản xạ chào hỏi tự nhiên và tự giới thiệu tên, quê quán với đồng nghiệp mới người Nhật.',
            'はじめまして、ミンと申します。ベトナムから来ました。よろしくお願いします。',
            'Xin chào lần đầu gặp mặt, tôi tên là Minh. Tôi đến từ Việt Nam. Rất mong được giúp đỡ.',
            'N5',
            v_topic_id,
            TRUE,
            'PUBLISHED',
            TRUE
        ) RETURNING id INTO v_lesson1_id;

        INSERT INTO shadowing_dialogue_lines (lesson_id, line_order, speaker, japanese_text, hiragana_text, vietnamese_translation) VALUES
        (v_lesson1_id, 1, 'A', 'おはようございます。今日からここで働くミンと申します。', 'おはようございます。きょうからここではたらくみんともうします。', 'Chào buổi sáng. Tôi tên là Minh, bắt đầu làm việc ở đây từ hôm nay.'),
        (v_lesson1_id, 2, 'B', 'おはようございます！田中です。ベトナムから来たんですか。', 'おはようございます！たなかです。べとなむからきたんですか。', 'Chào buổi sáng! Tôi là Tanaka. Bạn đến từ Việt Nam phải không?'),
        (v_lesson1_id, 3, 'A', 'はい、そうです。日本に来てまだ三ヶ月です。', 'はい、そうです。にほんにきてまださんかげつです。', 'Vâng, đúng vậy. Tôi mới sang Nhật được 3 tháng thôi.'),
        (v_lesson1_id, 4, 'B', '日本語がとても上手ですね！分からないことがあったら、いつでも聞いてください。', 'にほんごがとてもじょうずですね！わからないことがあったら、いつでもきいてください。', 'Tiếng Nhật của bạn giỏi quá! Nếu có điều gì chưa rõ thì cứ hỏi tôi bất cứ lúc nào nhé.'),
        (v_lesson1_id, 5, 'A', 'ありがとうございます。これからよろしくお願いします。', 'ありがとうございます。これからよろしくおねがいします。', 'Cảm ơn anh/chị rất nhiều. Từ nay rất mong được anh/chị giúp đỡ.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM shadowing_lessons WHERE title = 'Bài 2: Gọi món tại quán ăn Nhật Bản (Hội thoại A/B)') THEN
        INSERT INTO shadowing_lessons (title, description, text_ja, text_vi, jlpt_level, topic_id, is_active, status, is_dialogue)
        VALUES (
            'Bài 2: Gọi món tại quán ăn Nhật Bản (Hội thoại A/B)',
            'Hội thoại thực tế giữa nhân viên phục vụ và khách hàng khi gọi món ramen và đồ uống tại nhà hàng.',
            'いらっしゃいませ。ご注文はお決まりですか。',
            'Xin chào quý khách. Quý khách đã chọn được món chưa ạ?',
            'N5',
            v_topic_id,
            TRUE,
            'PUBLISHED',
            TRUE
        ) RETURNING id INTO v_lesson2_id;

        INSERT INTO shadowing_dialogue_lines (lesson_id, line_order, speaker, japanese_text, hiragana_text, vietnamese_translation) VALUES
        (v_lesson2_id, 1, 'A', 'いらっしゃいませ。何名様ですか。', 'いらっしゃいませ。なんめいさまですか。', 'Xin chào quý khách. Quý khách đi mấy người ạ?'),
        (v_lesson2_id, 2, 'B', '一人です。メニューを見せていただけますか。', 'ひとりです。めにゅーをみせていただけますか。', 'Tôi đi một mình. Cho tôi xem thực đơn được không?'),
        (v_lesson2_id, 3, 'A', 'はい、どうぞ。おすすめは醤油ラーメンです。', 'はい、どうぞ。おすすめはしょうゆらーめんです。', 'Vâng, xin mời. Món gợi ý của quán là mì Ramen nước tương ạ.'),
        (v_lesson2_id, 4, 'B', 'じゃあ、醤油ラーメンと冷たいお茶を一つずつお願いします。', 'じゃあ、しょうゆらーめんとつめたいおちゃをひとつずつおねがいします。', 'Vậy cho tôi một tô mì Ramen nước tương và một ly trà lạnh nhé.'),
        (v_lesson2_id, 5, 'A', 'かしこまりました。少々お待ちください。', 'かしこまりました。しょうしょうおまちください。', 'Tôi đã rõ ạ. Xin quý khách vui lòng đợi một lát.');
    END IF;
END $$;

-- 5. Ensure conversation_topics has system topics across JLPT N5..N1 so level filters return real DB topics
INSERT INTO conversation_topics (name_vi, description, ai_role, user_role, jlpt_level, system_prompt, is_active)
SELECT 'Thảo luận công việc & Báo cáo tiến độ (N2)',
       'Trao đổi tiến độ dự án và xử lý vấn đề phát sinh cùng cấp trên tại công ty Nhật.',
       'Quản lý dự án (PM) người Nhật',
       'Kỹ sư phần mềm',
       'N2',
       'Bạn là quản lý dự án người Nhật tại công ty IT. Hãy thảo luận tiến độ công việc, deadline và giải pháp bằng tiếng Nhật trình độ N2 lịch sự.',
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM conversation_topics WHERE jlpt_level = 'N2' AND created_by IS NULL);

INSERT INTO conversation_topics (name_vi, description, ai_role, user_role, jlpt_level, system_prompt, is_active)
SELECT 'Đàm phán hợp tác & Thuyết trình chuyên sâu (N1)',
       'Thảo luận chiến lược kinh doanh, thuyết trình ý tưởng và đàm phán bằng Kính ngữ (Keigo) chuẩn N1.',
       'Giám đốc đối tác Nhật Bản',
       'Đại diện doanh nghiệp',
       'N1',
       'Bạn là giám đốc đối tác doanh nghiệp Nhật Bản. Hãy trao đổi về chiến lược hợp tác và đặt câu hỏi phản biện chuyên sâu bằng tiếng Nhật trình độ N1 và Kính ngữ chuẩn.',
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM conversation_topics WHERE jlpt_level = 'N1' AND created_by IS NULL);
