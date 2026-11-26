-- ========================================================
-- V4__fix_schema_and_seed_decks.sql
-- 1. Chuẩn hóa kiểu dữ liệu cột khớp 100% với Hibernate validate
-- 2. Cập nhật model Gemini AI sang gemini-3-flash-preview
-- 3. Khởi tạo các bộ Flashcard mẫu hệ thống (N5, N4, N3)
-- 4. Tách biệt dữ liệu ADMIN và khởi tạo sổ từ mẫu cho USER
-- ========================================================

-- 1. Chuẩn hóa kiểu cột cho Hibernate ddl-auto=validate
ALTER TABLE review_logs ALTER COLUMN rating TYPE INT;
ALTER TABLE shadowing_attempts ALTER COLUMN word_diff TYPE TEXT USING word_diff::text;
ALTER TABLE image_recognitions ALTER COLUMN result_json TYPE TEXT USING result_json::text;
ALTER TABLE import_jobs ALTER COLUMN error_report TYPE TEXT USING error_report::text;
ALTER TABLE audit_logs ALTER COLUMN detail TYPE TEXT USING detail::text;

-- 2. Cập nhật cấu hình Gemini AI sang model hoạt động ổn định
UPDATE system_settings
SET setting_value = 'gemini-3-flash-preview', updated_at = CURRENT_TIMESTAMP
WHERE setting_key IN ('ai.model.vision', 'ai.model.chat');

-- 3. Xóa dữ liệu học tập cá nhân bị gắn nhầm vào tài khoản ADMIN
DELETE FROM user_vocabularies WHERE user_id IN (SELECT id FROM users WHERE role = 'ADMIN');
DELETE FROM shadowing_attempts WHERE user_id IN (SELECT id FROM users WHERE role = 'ADMIN');
DELETE FROM conversations WHERE user_id IN (SELECT id FROM users WHERE role = 'ADMIN');

-- 4. Khởi tạo 3 bộ Flashcard mẫu hệ thống nếu chưa có
INSERT INTO flashcard_decks (owner_id, name, description, jlpt_level, topic_id, is_system, is_public, is_active)
SELECT NULL, 'Từ vựng JLPT N5 Cốt lõi – Giao tiếp & Đời sống', 'Bộ thẻ 15 từ vựng tiếng Nhật N5 quan trọng nhất trong sinh hoạt, trường học và gia đình.', 'N5',
       (SELECT id FROM topics WHERE name_vi = 'Đồ dùng trong nhà' LIMIT 1), TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM flashcard_decks WHERE name = 'Từ vựng JLPT N5 Cốt lõi – Giao tiếp & Đời sống');

INSERT INTO flashcard_decks (owner_id, name, description, jlpt_level, topic_id, is_system, is_public, is_active)
SELECT NULL, 'Từ vựng JLPT N4 – Du lịch, Ga tàu & Khách sạn', 'Các từ vựng và mẫu câu thiết yếu khi đi tàu điện, đặt phòng khách sạn và du lịch tại Nhật Bản.', 'N4',
       (SELECT id FROM topics WHERE name_vi = 'Du lịch' LIMIT 1), TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM flashcard_decks WHERE name = 'Từ vựng JLPT N4 – Du lịch, Ga tàu & Khách sạn');

INSERT INTO flashcard_decks (owner_id, name, description, jlpt_level, topic_id, is_system, is_public, is_active)
SELECT NULL, 'Từ vựng JLPT N3 – Công sở & Phỏng vấn (Business)', 'Từ vựng tiếng Nhật thương mại, phỏng vấn xin việc và giao tiếp nơi công sở.', 'N3',
       (SELECT id FROM topics WHERE name_vi = 'Công việc' LIMIT 1), TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM flashcard_decks WHERE name = 'Từ vựng JLPT N3 – Công sở & Phỏng vấn (Business)');

-- 5. Nạp thẻ Flashcard cho Bộ thẻ mẫu N5
INSERT INTO flashcards (deck_id, front, reading, back, example_ja, example_vi, note, position)
SELECT d.id, v.front, v.reading, v.back, v.ex_ja, v.ex_vi, v.note, v.pos
FROM flashcard_decks d
CROSS JOIN (VALUES
    ('学校', 'がっこう', 'trường học', '毎日学校へ行きます。', 'Mỗi ngày tôi đều đi đến trường.', 'Danh từ N5', 1),
    ('先生', 'せんせい', 'giáo viên, thầy/cô', '田中先生はとても優しいです。', 'Thầy Tanaka rất hiền.', 'Danh từ N5', 2),
    ('学生', 'がくせい', 'học sinh, sinh viên', '私は大学の学生です。', 'Tôi là sinh viên đại học.', 'Danh từ N5', 3),
    ('図書館', 'としょかん', 'thư viện', '図書館で本を借ります。', 'Tôi mượn sách ở thư viện.', 'Danh từ N5', 4),
    ('電車', 'でんしゃ', 'tàu điện', '毎朝電車で通勤します。', 'Mỗi sáng tôi đi làm bằng tàu điện.', 'Danh từ N5', 5),
    ('駅', 'えき', 'nhà ga', '駅の前にカフェがあります。', 'Trước nhà ga có một quán cà phê.', 'Danh từ N5', 6),
    ('朝ご飯', 'あさごはん', 'bữa sáng', '朝ご飯にパンを食べました。', 'Tôi đã ăn bánh mì vào bữa sáng.', 'Danh từ N5', 7),
    ('飲み物', 'のみもの', 'đồ uống', '冷たい飲み物が欲しいです。', 'Tôi muốn một món đồ uống lạnh.', 'Danh từ N5', 8),
    ('天気', 'てんき', 'thời tiết', '今日はいい天気ですね。', 'Hôm nay thời tiết đẹp nhỉ.', 'Danh từ N5', 9),
    ('友達', 'ともだち', 'bạn bè', '週末に友達と映画を見ます。', 'Cuối tuần tôi xem phim cùng bạn.', 'Danh từ N5', 10)
) AS v(front, reading, back, ex_ja, ex_vi, note, pos)
WHERE d.name = 'Từ vựng JLPT N5 Cốt lõi – Giao tiếp & Đời sống'
ON CONFLICT (deck_id, front, reading) DO NOTHING;

-- 6. Nạp thẻ Flashcard cho Bộ thẻ mẫu N4
INSERT INTO flashcards (deck_id, front, reading, back, example_ja, example_vi, note, position)
SELECT d.id, v.front, v.reading, v.back, v.ex_ja, v.ex_vi, v.note, v.pos
FROM flashcard_decks d
CROSS JOIN (VALUES
    ('予約', 'よやく', 'đặt trước (phòng, vé)', 'ホテルをインターネットで予約しました。', 'Tôi đã đặt phòng khách sạn qua mạng.', 'Danh từ / Động từ nhóm 3 N4', 1),
    ('乗り換え', 'のりかえ', 'chuyển tuyến (tàu, xe)', '新宿駅で山手線に乗り換えます。', 'Tôi chuyển sang tuyến Yamanote ở ga Shinjuku.', 'Danh từ N4', 2),
    ('受付', 'うけつけ', 'quầy lễ tân', '受付で名前を書いてください。', 'Vui lòng viết tên ở quầy lễ tân.', 'Danh từ N4', 3),
    ('荷物', 'にもつ', 'hành lý', '荷物を部屋に運んでください。', 'Xin hãy chuyển hành lý lên phòng.', 'Danh từ N4', 4),
    ('出発', 'しゅっぱつ', 'khởi hành, xuất phát', '飛行機は午前9時に出発します。', 'Máy bay sẽ khởi hành lúc 9 giờ sáng.', 'Danh từ / Động từ nhóm 3 N4', 5),
    ('到着', 'とうちゃく', 'đến nơi, hạ cánh', '東京駅に到着しました。', 'Đã đến ga Tokyo.', 'Danh từ / Động từ nhóm 3 N4', 6)
) AS v(front, reading, back, ex_ja, ex_vi, note, pos)
WHERE d.name = 'Từ vựng JLPT N4 – Du lịch, Ga tàu & Khách sạn'
ON CONFLICT (deck_id, front, reading) DO NOTHING;

-- 7. Nạp thẻ Flashcard cho Bộ thẻ mẫu N3
INSERT INTO flashcards (deck_id, front, reading, back, example_ja, example_vi, note, position)
SELECT d.id, v.front, v.reading, v.back, v.ex_ja, v.ex_vi, v.note, v.pos
FROM flashcard_decks d
CROSS JOIN (VALUES
    ('面接', 'めんせつ', 'phỏng vấn', '明日、アルバイトの面接があります。', 'Ngày mai tôi có buổi phỏng vấn làm thêm.', 'Danh từ N3', 1),
    ('経験', 'けいけん', 'kinh nghiệm', '接客の経験があります。', 'Tôi có kinh nghiệm phục vụ khách hàng.', 'Danh từ N3', 2),
    ('連絡', 'れんらく', 'liên lạc', '後でメールで連絡いたします。', 'Tôi sẽ liên lạc lại bằng email sau.', 'Danh từ / Động từ nhóm 3 N3', 3),
    ('相談', 'そうだん', 'thảo luận, bàn bạc', '上司に相談してから決めます。', 'Tôi sẽ hỏi ý kiến cấp trên rồi mới quyết định.', 'Danh từ / Động từ nhóm 3 N3', 4),
    ('確認', 'かくにん', 'xác nhận, kiểm tra', 'スケジュールを確認してください。', 'Vui lòng kiểm tra lại lịch trình.', 'Danh từ / Động từ nhóm 3 N3', 5)
) AS v(front, reading, back, ex_ja, ex_vi, note, pos)
WHERE d.name = 'Từ vựng JLPT N3 – Công sở & Phỏng vấn (Business)'
ON CONFLICT (deck_id, front, reading) DO NOTHING;

-- 8. Khởi tạo từ vựng mẫu trong sổ từ cá nhân cho tài khoản học viên mặc định (user@nihongoai.local)
INSERT INTO user_vocabularies (user_id, word, reading, romaji, meaning_vi, example_ja, example_vi, source, is_mastered)
SELECT u.id, v.word, v.reading, v.romaji, v.meaning_vi, v.ex_ja, v.ex_vi, 'SYSTEM', v.mastered
FROM users u
CROSS JOIN (VALUES
    ('日本語', 'にほんご', 'nihongo', 'tiếng Nhật', '私は毎日日本語を勉強しています。', 'Tôi học tiếng Nhật mỗi ngày.', TRUE),
    ('図書館', 'としょかん', 'toshokan', 'thư viện', '大学の図書館で本を読みます。', 'Tôi đọc sách ở thư viện trường đại học.', FALSE),
    ('新幹線', 'しんかんせん', 'shinkansen', 'tàu siêu tốc Shinkansen', '新幹線で京都へ行きました。', 'Tôi đã đi Kyoto bằng tàu Shinkansen.', FALSE),
    ('約束', 'やくそく', 'yakusoku', 'lời hứa, cuộc hẹn', '友達との約束を守ります。', 'Tôi giữ lời hứa với bạn bè.', TRUE),
    ('準備', 'じゅんび', 'junbi', 'chuẩn bị', '旅行の準備をしています。', 'Tôi đang chuẩn bị cho chuyến du lịch.', FALSE)
) AS v(word, reading, romaji, meaning_vi, ex_ja, ex_vi, mastered)
WHERE u.email = 'user@nihongoai.local' AND u.role = 'USER'
ON CONFLICT (user_id, word, reading) DO NOTHING;
