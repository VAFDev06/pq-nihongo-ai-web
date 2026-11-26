-- =========================================================================
-- V5__upgrade_features.sql:
-- 1. Thêm cấu hình tốc độ đọc TTS (tts_speed) theo tài khoản người dùng
-- 2. Bổ sung trường Hán Việt (han_viet), Từ loại (part_of_speech), Hiragana ví dụ (example_reading)
-- 3. Mở rộng VocabSource (AI_RECOGNITION, CONVERSATION)
-- 4. Hỗ trợ người dùng tự tạo chủ đề Hội thoại AI cá nhân (created_by, ai_role, user_role)
-- =========================================================================

-- 1. Thêm tts_speed vào bảng users (mặc định 1.15x tự nhiên)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tts_speed NUMERIC(4,2) NOT NULL DEFAULT 1.15;

-- 2. Mở rộng bảng vocabularies
ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS han_viet VARCHAR(150);
ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS example_reading VARCHAR(500);

-- Cập nhật âm Hán Việt chuẩn cho các từ Kanji hệ thống
UPDATE vocabularies SET han_viet = 'NHẬT BẢN NGỮ' WHERE word = '日本語' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'HỌC SINH' WHERE word = '学生' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'TIÊN SINH' WHERE word = '先生' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'HỌC HIỆU' WHERE word = '学校' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'ĐỒ THƯ QUÁN' WHERE word = '図書館' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'ĐIỆN XA' WHERE word = '電車' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'TÂN CÁN TUYẾN' WHERE word = '新幹線' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'DỊCH' WHERE word = '駅' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'BỆNH VIỆN' WHERE word = '病院' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'NGÂN HÀNG' WHERE word = '銀行' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'BƯU ĐIỆN CỤC' WHERE word = '郵便局' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'GIA TỘC' WHERE word = '家族' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'HỮU ĐẠT' WHERE word = '友達' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'SĨ SỰ' WHERE word = '仕事' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'HỘI XÃ' WHERE word = '会社' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'THỜI GIAN' WHERE word = '時間' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'ĐIỆN THOẠI' WHERE word = '電話' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'THIÊN KHÍ' WHERE word = '天気' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'ẨM THỰC' WHERE word = '食事' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'LIỆU LÝ' WHERE word = '料理' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'MIỄN CƯỠNG' WHERE word = '勉強' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'LỮ HÀNH' WHERE word = '旅行' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'ƯỚC THÚC' WHERE word = '約束' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'CHUẨN BỊ' WHERE word = '準備' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'KINH NGHIỆM' WHERE word = '経験' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'THÓI QUEN' WHERE word = '習慣' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'HOÀN CẢNH' WHERE word = '環境' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'KINH TẾ' WHERE word = '経済' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'CHÍNH TRỊ' WHERE word = '政治' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'CẢNH SÁT' WHERE word = '警察' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'NAM TÍNH' WHERE word = '男性' AND han_viet IS NULL;
UPDATE vocabularies SET han_viet = 'NỮ TÍNH' WHERE word = '女性' AND han_viet IS NULL;

-- Thêm 2 từ mẫu chuẩn (警察, 男性) vào từ điển hệ thống nếu chưa có
INSERT INTO vocabularies (word, reading, romaji, meaning_vi, part_of_speech, han_viet, jlpt_level, example_ja, example_vi, example_reading, is_active)
SELECT '警察', 'けいさつ', 'keisatsu', 'cảnh sát', 'danh từ', 'CẢNH SÁT', 'N4', '自転車を盗まれたので、警察に届けた。', 'Vì bị trộm xe đạp nên tôi đã báo cảnh sát.', 'じてんしゃをぬすまれたので、けいさつにとどけた。', TRUE
WHERE NOT EXISTS (SELECT 1 FROM vocabularies WHERE word = '警察' AND reading = 'けいさつ');

INSERT INTO vocabularies (word, reading, romaji, meaning_vi, part_of_speech, han_viet, jlpt_level, example_ja, example_vi, example_reading, is_active)
SELECT '男性', 'だんせい', 'dansei', 'Nam giới, đàn ông', 'Danh từ', 'NAM TÍNH', 'N4', '理想の男性と結婚する。', 'Kết hôn với người đàn ông lý tưởng.', 'りそうのだんせいとけっこんする。', TRUE
WHERE NOT EXISTS (SELECT 1 FROM vocabularies WHERE word = '男性' AND reading = 'だんせい');

-- 3. Mở rộng bảng user_vocabularies
ALTER TABLE user_vocabularies DROP CONSTRAINT IF EXISTS user_vocabularies_source_check;
ALTER TABLE user_vocabularies ADD CONSTRAINT user_vocabularies_source_check
    CHECK (source IN ('MANUAL','AI_IMAGE','AI_RECOGNITION','IMPORT','SYSTEM','CONVERSATION'));

ALTER TABLE user_vocabularies ADD COLUMN IF NOT EXISTS part_of_speech VARCHAR(50);
ALTER TABLE user_vocabularies ADD COLUMN IF NOT EXISTS han_viet VARCHAR(150);
ALTER TABLE user_vocabularies ADD COLUMN IF NOT EXISTS example_reading VARCHAR(500);
ALTER TABLE user_vocabularies ADD COLUMN IF NOT EXISTS jlpt_level VARCHAR(10);

UPDATE user_vocabularies SET han_viet = 'TÂN CÁN TUYẾN', part_of_speech = 'Danh từ', jlpt_level = 'N5' WHERE word = '新幹線' AND han_viet IS NULL;
UPDATE user_vocabularies SET han_viet = 'ĐỒ THƯ QUÁN', part_of_speech = 'Danh từ', jlpt_level = 'N5' WHERE word = '図書館' AND han_viet IS NULL;

-- 4. Mở rộng bảng flashcards
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS part_of_speech VARCHAR(50);
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS han_viet VARCHAR(150);
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS example_reading VARCHAR(500);

UPDATE flashcards SET part_of_speech = 'Danh từ', han_viet = 'ĐIỆN XA', example_reading = 'まいにちでんしゃでかいしゃへいきます。' WHERE front = '電車' AND han_viet IS NULL;
UPDATE flashcards SET part_of_speech = 'Danh từ', han_viet = 'TÂN CÁN TUYẾN', example_reading = 'しんかんせんでとうきょうへいきます。' WHERE front = '新幹線' AND han_viet IS NULL;
UPDATE flashcards SET part_of_speech = 'Danh từ', han_viet = 'ĐỒ THƯ QUÁN', example_reading = 'としょかんでほんをかります。' WHERE front = '図書館' AND han_viet IS NULL;
UPDATE flashcards SET part_of_speech = 'Danh từ', han_viet = 'ƯỚC THÚC', example_reading = 'ともだちとやくそくがあります。' WHERE front = '約束' AND han_viet IS NULL;
UPDATE flashcards SET part_of_speech = 'Danh từ', han_viet = 'CHUẨN BỊ', example_reading = 'りょこうのじゅんびをします。' WHERE front = '準備' AND han_viet IS NULL;
UPDATE flashcards SET part_of_speech = 'Danh từ', han_viet = 'KINH NGHIỆM', example_reading = 'いいけいけんになりました。' WHERE front = '経験' AND han_viet IS NULL;

-- Bổ sung thẻ 警察 và 男性 vào bộ thẻ N5/N4 để người học thấy ngay mẫu chuẩn
DO $$
DECLARE
    v_deck_id BIGINT;
BEGIN
    SELECT id INTO v_deck_id FROM flashcard_decks WHERE is_system = TRUE ORDER BY id ASC LIMIT 1;
    IF v_deck_id IS NOT NULL THEN
        INSERT INTO flashcards (deck_id, front, reading, back, part_of_speech, han_viet, example_ja, example_vi, example_reading, note, position)
        SELECT v_deck_id, '警察', 'けいさつ', 'cảnh sát', 'danh từ', 'CẢNH SÁT',
               '自転車を盗まれたので、警察に届けた。',
               'Vì bị trộm xe đạp nên tôi đã báo cảnh sát.',
               'じてんしゃをぬすまれたので、けいさつにとどけた。',
               'じてんしゃをぬすまれたので、けいさつにとどけた。 (CẢNH SÁT)', 0
        WHERE NOT EXISTS (SELECT 1 FROM flashcards WHERE deck_id = v_deck_id AND front = '警察');

        INSERT INTO flashcards (deck_id, front, reading, back, part_of_speech, han_viet, example_ja, example_vi, example_reading, note, position)
        SELECT v_deck_id, '男性', 'だんせい', 'Nam giới, đàn ông', 'Danh từ', 'NAM TÍNH',
               '理想の男性と結婚する。',
               'Kết hôn với người đàn ông lý tưởng.',
               'りそうのだんせいとけっこんする。',
               'りそうのだんせいとけっこんする。 (NAM TÍNH)', 1
        WHERE NOT EXISTS (SELECT 1 FROM flashcards WHERE deck_id = v_deck_id AND front = '男性');
    END IF;
END $$;

-- 5. Hỗ trợ chủ đề hội thoại cá nhân do USER tự tạo
ALTER TABLE conversation_topics ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE conversation_topics ADD COLUMN IF NOT EXISTS ai_role VARCHAR(150);
ALTER TABLE conversation_topics ADD COLUMN IF NOT EXISTS user_role VARCHAR(150);
