-- ========================================================
-- V2__seed_data.sql: Nạp dữ liệu mẫu ban đầu
-- ========================================================

-- Cài đặt hệ thống ban đầu
INSERT INTO system_settings(setting_key, setting_value, description) VALUES
('ai.model.vision', 'gemini-1.5-flash', 'Model Gemini cho nhận diện ảnh'),
('ai.model.chat', 'gemini-1.5-flash', 'Model Gemini cho hội thoại'),
('ai.daily_limit.default', '30', 'Số lượt gọi AI mỗi người mỗi ngày'),
('ai.timeout_seconds', '30', 'Timeout gọi Gemini'),
('upload.max_image_mb', '10', 'Dung lượng ảnh tối đa'),
('import.max_rows', '2000', 'Số dòng tối đa mỗi lần import'),
('srs.new_cards_per_day', '10', 'Số thẻ mới tối đa mỗi ngày'),
('srs.max_reviews_per_day', '200', 'Số thẻ ôn tối đa mỗi ngày')
ON CONFLICT (setting_key) DO NOTHING;

-- Các chủ đề từ vựng ban đầu
INSERT INTO topics(name_vi, name_ja, description) VALUES
('Đồ dùng trong nhà', '家の物', 'Các đồ vật thường gặp trong gia đình'),
('Đồ ăn thức uống', '食べ物・飲み物', 'Món ăn, đồ uống và nhà hàng'),
('Trường học', '学校', 'Từ vựng trường lớp và học tập'),
('Giao thông', '交通', 'Phương tiện đi lại, tàu điện, xe buýt'),
('Quần áo', '服', 'Trang phục và phụ kiện thời trang'),
('Thiên nhiên', '自然', 'Thời tiết, khí hậu và bốn mùa'),
('Công việc', '仕事', 'Văn phòng, công ty và phỏng vấn'),
('Du lịch', '旅行', 'Khách sạn, máy bay và tham quan')
ON CONFLICT DO NOTHING;

-- Chủ đề hội thoại AI mẫu
INSERT INTO conversation_topics (name_vi, name_ja, description, icon, jlpt_level, system_prompt) VALUES
('Gọi món tại quán ăn', 'レストランで注文する', 'Tập gọi món ramen, hỏi giá và thanh toán hóa đơn tại quán ăn Nhật', 'Utensils', 'N5', 'Bạn là nhân viên phục vụ quán mì Ramen tại Tokyo. Hãy chào khách, giới thiệu thực đơn một cách lịch sự, thân thiện bằng tiếng Nhật N5 đơn giản. Khi người dùng nói sai ngữ pháp, hãy sửa và giải thích ngắn gọn bằng tiếng Việt.'),
('Hỏi đường ở ga tàu', '駅で道を尋ねる', 'Hỏi lối ra và cách chuyển tuyến tàu điện ngầm tại ga Shinjuku', 'MapPin', 'N5', 'Bạn là nhân viên nhà ga Shinjuku nhiệt tình. Hãy hướng dẫn người dùng tìm cổng ra và tuyến tàu phù hợp bằng tiếng Nhật N5-N4. Sửa lỗi ngữ pháp nếu có.'),
('Nhận phòng khách sạn', 'ホテルにチェックインする', 'Làm thủ tục nhận phòng, hỏi dịch vụ ăn sáng và wifi', 'Hotel', 'N4', 'Bạn là lễ tân khách sạn tại Kyoto. Hãy giao tiếp bằng kính ngữ lịch sự Keigo N4, hỗ trợ khách nhận phòng và giải đáp thắc mắc.'),
('Phỏng vấn xin việc bán thời gian', 'アルバイトの面接', 'Luyện tập trả lời các câu hỏi phỏng vấn xin việc konbini/quán ăn', 'Briefcase', 'N3', 'Bạn là người quản lý cửa hàng tiện lợi phỏng vấn ứng viên xin việc làm thêm. Hãy đặt câu hỏi về kinh nghiệm, lý do ứng tuyển, lịch làm việc bằng tiếng Nhật N3.'),
('Trò chuyện thường ngày', '日常会話', 'Nói chuyện về sở thích, thời tiết và cuộc sống hàng ngày tại Nhật Bản', 'Coffee', 'N5', 'Bạn là người bạn Nhật Bản thân thiện tên là Yuki. Hãy trò chuyện cởi mở về cuộc sống thường ngày bằng tiếng Nhật cơ bản N5-N4.')
ON CONFLICT DO NOTHING;

-- Bài học Shadowing mẫu N5 - N3
INSERT INTO shadowing_lessons (title, text_ja, text_vi, jlpt_level, audio_url) VALUES
('Chào hỏi buổi sáng', 'おはようございます。今日もいい天気ですね。', 'Chào buổi sáng. Hôm nay thời tiết cũng đẹp nhỉ.', 'N5', NULL),
('Giới thiệu bản thân', 'はじめまして、フックと申します。ベトナムから来ました。', 'Rất vui được gặp bạn, tôi tên là Phúc. Tôi đến từ Việt Nam.', 'N5', NULL),
('Cảm ơn và xin phép', 'どうもありがとうございます。失礼いたします。', 'Xin chân thành cảm ơn. Tôi xin phép.', 'N5', NULL),
('Hỏi giá tiền', 'すみません、これはいくらですか。', 'Xin lỗi, cái này giá bao nhiêu tiền vậy?', 'N5', NULL),
('Xin lỗi làm phiền', 'すみませんが、駅はどこですか。', 'Xin lỗi, ga xe lửa ở đâu vậy?', 'N5', NULL)
ON CONFLICT DO NOTHING;