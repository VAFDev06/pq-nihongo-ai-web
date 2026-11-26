-- ========================================================
-- V3__seed_system_vocabularies.sql: Nạp 100+ từ vựng hệ thống chuẩn JLPT N5 - N3
-- ========================================================

INSERT INTO vocabularies (word, reading, romaji, meaning_vi, part_of_speech, jlpt_level, topic_id, example_ja, example_vi) VALUES
-- Chủ đề 1: Đồ dùng trong nhà (topic_id = 1)
('机', 'つくえ', 'tsukue', 'cái bàn', 'danh từ', 'N5', 1, '机の上に本があります。', 'Trên bàn có một quyển sách.'),
('椅子', 'いす', 'isu', 'cái ghế', 'danh từ', 'N5', 1, 'この椅子は座り心地が良いです。', 'Chiếc ghế này ngồi rất thoải mái.'),
('時計', 'とけい', 'tokei', 'đồng hồ', 'danh từ', 'N5', 1, '壁に時計が掛かっています。', 'Trên tường có treo một chiếc đồng hồ.'),
('電話', 'でんわ', 'denwa', 'điện thoại', 'danh từ', 'N5', 1, '先生に電話をかけます。', 'Tôi gọi điện thoại cho giáo viên.'),
('冷蔵庫', 'れいぞうこ', 'reizouko', 'tủ lạnh', 'danh từ', 'N5', 1, '冷蔵庫に牛乳が入っています。', 'Trong tủ lạnh có sữa bò.'),
('洗濯機', 'せんたくき', 'sentakuki', 'máy giặt', 'danh từ', 'N4', 1, '洗濯機で服を洗います。', 'Tôi giặt quần áo bằng máy giặt.'),
('掃除機', 'そうじき', 'soujiki', 'máy hút bụi', 'danh từ', 'N4', 1, '毎朝、掃除機をかけます。', 'Mỗi sáng tôi đều hút bụi.'),
('電子レンジ', 'でんしレンジ', 'denshirenji', 'lò vi sóng', 'danh từ', 'N4', 1, '弁当を電子レンジで温めます。', 'Tôi hâm nóng cơm hộp bằng lò vi sóng.'),
('鏡', 'かがみ', 'kagami', 'cái gương', 'danh từ', 'N4', 1, '鏡を見て髪を整えます。', 'Tôi soi gương chỉnh lại tóc.'),
('エアコン', 'エアコン', 'eakon', 'máy điều hòa', 'danh từ', 'N4', 1, 'エアコンをつけて部屋を涼しくします。', 'Tôi bật điều hòa cho phòng mát mẻ.'),
('扇風機', 'せんぷうき', 'senpuuki', 'quạt máy', 'danh từ', 'N3', 1, '夏は扇風機が欠かせません。', 'Mùa hè thì quạt máy là không thể thiếu.'),
('食器棚', 'しょっきだな', 'shokkidana', 'tủ bát đĩa', 'danh từ', 'N3', 1, 'お皿を食器棚に片付けます。', 'Tôi dọn đĩa cất vào tủ chén bát.'),
('炊飯器', 'すいはんき', 'suihanki', 'nồi cơm điện', 'danh từ', 'N3', 1, '新しい炊飯器でお米を炊きました。', 'Tôi nấu cơm bằng nồi cơm điện mới.'),

-- Chủ đề 2: Đồ ăn thức uống (topic_id = 2)
('水', 'みず', 'mizu', 'nước', 'danh từ', 'N5', 2, '冷たい水を一杯ください。', 'Làm ơn cho tôi một cốc nước lạnh.'),
('お茶', 'おちゃ', 'ocha', 'trà', 'danh từ', 'N5', 2, '日本のお茶を飲みましょう。', 'Hãy cùng uống trà Nhật Bản nào.'),
('ご飯', 'ごはん', 'gohan', 'cơm, bữa ăn', 'danh từ', 'N5', 2, '朝ご飯をしっかり食べます。', 'Tôi ăn bữa sáng thật đầy đủ.'),
('肉', 'にく', 'niku', 'thịt', 'danh từ', 'N5', 2, '牛肉と豚肉のどちらが好きですか。', 'Bạn thích thịt bò hay thịt lợn hơn?'),
('魚', 'さかな', 'sakana', 'cá', 'danh từ', 'N5', 2, '新鮮な魚の刺身を食べました。', 'Tôi đã ăn sashimi cá tươi sống.'),
('野菜', 'やさい', 'yasai', 'rau củ', 'danh từ', 'N5', 2, '健康のために野菜を食べます。', 'Tôi ăn rau củ vì sức khỏe.'),
('果物', 'くだもの', 'kudamono', 'hoa quả, trái cây', 'danh từ', 'N5', 2, 'デザートに果物を食べましょう。', 'Hãy ăn trái cây tráng miệng nhé.'),
('卵', 'たまご', 'tamago', 'trứng', 'danh từ', 'N5', 2, '卵焼きを作りました。', 'Tôi đã làm món trứng cuộn.'),
('パン', 'パン', 'pan', 'bánh mì', 'danh từ', 'N5', 2, '朝食にパンとコーヒーをとります。', 'Tôi ăn sáng với bánh mì và cà phê.'),
('ラーメン', 'ラーメン', 'raamen', 'mì Ramen', 'danh từ', 'N5', 2, 'この店のラーメンはとても美味しいです。', 'Mì ramen ở quán này rất ngon.'),
('寿司', 'すし', 'sushi', 'món Sushi', 'danh từ', 'N5', 2, '回転寿司に行きましょう。', 'Chúng ta cùng đi ăn sushi băng chuyền nhé.'),
('天ぷら', 'てんぷら', 'tenpura', 'món Tempura chiên', 'danh từ', 'N4', 2, 'エビの天ぷらを注文しました。', 'Tôi đã gọi món tempura tôm.'),
('調味料', 'ちょうみりょう', 'choumiryou', 'gia vị', 'danh từ', 'N3', 2, '日本の伝統的な調味料には醤油があります。', 'Gia vị truyền thống của Nhật Bản có nước tương.'),
('栄養', 'えいよう', 'eiyou', 'dinh dưỡng', 'danh từ', 'N3', 2, '栄養のバランスを考えて食事をします。', 'Tôi ăn uống chú ý đến sự cân bằng dinh dưỡng.'),

-- Chủ đề 3: Trường học & Học tập (topic_id = 3)
('学校', 'がっこう', 'gakkou', 'trường học', 'danh từ', 'N5', 3, '毎朝8時に学校へ行きます。', 'Mỗi sáng tôi đến trường lúc 8 giờ.'),
('先生', 'せんせい', 'sensei', 'thầy cô giáo', 'danh từ', 'N5', 3, '田中先生はとても優しいです。', 'Thầy Tanaka rất hiền từ.'),
('学生', 'がくせい', 'gakusei', 'học sinh, sinh viên', 'danh từ', 'N5', 3, '大学で日本語を学ぶ学生です。', 'Tôi là sinh viên học tiếng Nhật ở trường đại học.'),
('教室', 'きょうしつ', 'kyoushitsu', 'phòng học, lớp học', 'danh từ', 'N5', 3, '教室で静かに本を読みます。', 'Tôi yên lặng đọc sách trong phòng học.'),
('本', 'ほん', 'hon', 'quyển sách', 'danh từ', 'N5', 3, '図書館で面白い本を借りました。', 'Tôi mượn một quyển sách hay ở thư viện.'),
('辞書', 'じしょ', 'jisho', 'từ điển', 'danh từ', 'N5', 3, '分からない言葉は辞書で調べます。', 'Từ nào không hiểu tôi sẽ tra từ điển.'),
('宿題', 'しゅくだい', 'shukudai', 'bài tập về nhà', 'danh từ', 'N5', 3, '寝る前に宿題を終わらせます。', 'Tôi làm xong bài tập về nhà trước khi đi ngủ.'),
('試験', 'しけん', 'shiken', 'kỳ thi, bài kiểm tra', 'danh từ', 'N5', 3, '来週、日本語能力試験があります。', 'Tuần tới có kỳ thi năng lực tiếng Nhật.'),
('質問', 'しつもん', 'shitsumon', 'câu hỏi', 'danh từ', 'N5', 3, '先生に質問をしてもいいですか。', 'Em có thể đặt câu hỏi cho thầy không ạ?'),
('文法', 'ぶんぽう', 'bunpou', 'ngữ pháp', 'danh từ', 'N4', 3, '日本語の文法をしっかり勉強します。', 'Tôi học kỹ ngữ pháp tiếng Nhật.'),
('語彙', 'ごい', 'goi', 'từ vựng', 'danh từ', 'N3', 3, '毎日新しい語彙を20個覚えます。', 'Mỗi ngày tôi ghi nhớ 20 từ vựng mới.'),
('講義', 'こうぎ', 'kougi', 'bài giảng, tiết học đại học', 'danh từ', 'N3', 3, '教授の講義を熱心に聞きます。', 'Tôi chăm chú nghe bài giảng của giáo sư.'),

-- Chủ đề 4: Giao thông & Đi lại (topic_id = 4)
('駅', 'えき', 'eki', 'nhà ga', 'danh từ', 'N5', 4, '駅の前で友達と待ち合わせをします。', 'Tôi hẹn gặp bạn ở trước nhà ga.'),
('電車', 'でんしゃ', 'densha', 'tàu điện', 'danh từ', 'N5', 4, '満員電車に乗って通勤します。', 'Tôi đi làm bằng tàu điện chật kín người.'),
('地下鉄', 'ちかてつ', 'chikatetsu', 'tàu điện ngầm', 'danh từ', 'N5', 4, '東京の地下鉄はとても便利です。', 'Tàu điện ngầm ở Tokyo rất tiện lợi.'),
('バス', 'バス', 'basu', 'xe buýt', 'danh từ', 'N5', 4, 'バス停でバスを待っています。', 'Tôi đang đợi xe buýt ở trạm dừng.'),
('切符', 'きっぷ', 'kippu', 'vé xe, vé tàu', 'danh từ', 'N5', 4, '自動販売機で切符を買います。', 'Tôi mua vé ở máy bán hàng tự động.'),
('自転車', 'じてんしゃ', 'jitensha', 'xe đạp', 'danh từ', 'N5', 4, '天気がいいので自転車で出かけます。', 'Thời tiết đẹp nên tôi ra ngoài bằng xe đạp.'),
('新幹線', 'しんかんせん', 'shinkansen', 'tàu siêu tốc Shinkansen', 'danh từ', 'N4', 4, '新幹線で大阪へ行きます。', 'Tôi đi Osaka bằng tàu Shinkansen.'),
('飛行機', 'ひこうき', 'hikouki', 'máy bay', 'danh từ', 'N4', 4, '飛行機でベトナムへ帰国します。', 'Tôi về nước bằng máy bay.'),
('空港', 'くうこう', 'kuukou', 'sân bay', 'danh từ', 'N4', 4, '成田空港に到着しました。', 'Tôi đã đến sân bay Narita.'),
('乗り換える', 'のりかえる', 'norikaeru', 'chuyển tuyến tàu/xe', 'động từ', 'N4', 4, '新宿駅で山手線に乗り換えます。', 'Tôi chuyển sang tuyến Yamanote ở ga Shinjuku.'),
('踏切', 'ふみきり', 'fumikiri', 'rào chắn đường ray', 'danh từ', 'N3', 4, '踏切では必ず一時停止します。', 'Tại nơi giao cắt đường sắt phải dừng xe tạm thời.'),
('混雑', 'こんざつ', 'konzatsu', 'đông đúc, tắc nghẽn', 'danh từ', 'N3', 4, 'ラッシュ時は道が混雑します。', 'Vào giờ cao điểm đường phố thường đông đúc.'),

-- Chủ đề 5: Quần áo & Thời trang (topic_id = 5)
('服', 'ふく', 'fuku', 'quần áo', 'danh từ', 'N5', 5, 'デパートで新しい服を買いました。', 'Tôi đã mua quần áo mới ở trung tâm thương mại.'),
('靴', 'くつ', 'kutsu', 'giày', 'danh từ', 'N5', 5, '玄関で靴を脱いでください。', 'Xin hãy tháo giày ở tiền sảnh.'),
('帽子', 'ぼうし', 'boushi', 'cái mũ, nón', 'danh từ', 'N5', 5, '日差しが強いので帽子をかぶります。', 'Vì trời nắng gắt nên tôi đội mũ.'),
('傘', 'かさ', 'kasa', 'cái ô, dù', 'danh từ', 'N5', 5, '雨が降ってきたので傘をさします。', 'Trời bắt đầu mưa nên tôi che ô.'),
('上着', 'うわぎ', 'uwagi', 'áo khoác ngoài', 'danh từ', 'N4', 5, '寒いので上着を着てください。', 'Trời lạnh nên hãy mặc áo khoác nhé.'),
('着物', 'きもの', 'kimono', 'trang phục Kimono', 'danh từ', 'N4', 5, 'お祭りで着物を着て写真を撮りました。', 'Tôi mặc Kimono chụp ảnh tại lễ hội.'),
('流行', 'りゅうこう', 'ryuukou', 'trào lưu, thịnh hành', 'danh từ', 'N3', 5, '若者の間で流行しているファッションです。', 'Đây là phong cách thời trang đang thịnh hành trong giới trẻ.'),

-- Chủ đề 6: Thiên nhiên & Thời tiết (topic_id = 6)
('雨', 'あめ', 'ame', 'cơn mưa', 'danh từ', 'N5', 6, '今日は午後から雨が降るでしょう。', 'Hôm nay từ chiều có lẽ sẽ có mưa.'),
('雪', 'ゆき', 'yuki', 'tuyết', 'danh từ', 'N5', 6, '冬になると山に雪が積もります。', 'Cứ đến mùa đông là tuyết phủ dày trên núi.'),
('風', 'かぜ', 'kaze', 'gió', 'danh từ', 'N5', 6, '強い風が吹いています。', 'Gió đang thổi rất mạnh.'),
('海', 'うみ', 'umi', 'biển', 'danh từ', 'N5', 6, '夏休みに海で泳ぎたいです。', 'Tôi muốn đi bơi biển vào kỳ nghỉ hè.'),
('山', 'やま', 'yama', 'núi', 'danh từ', 'N5', 6, '富士山は日本で一番高い山です。', 'Núi Phú Sĩ là ngọn núi cao nhất Nhật Bản.'),
('桜', 'さくら', 'sakura', 'hoa anh đào', 'danh từ', 'N5', 6, '春に桜の花が満開になります。', 'Vào mùa xuân hoa anh đào nở rộ.'),
('紅葉', 'こうよう', 'kouyou', 'lá đỏ mùa thu', 'danh từ', 'N4', 6, '秋に京都へ紅葉を見に行きます。', 'Vào mùa thu tôi đi Kyoto ngắm lá đỏ.'),
('台風', 'たいふう', 'taifuu', 'bão nhiệt đới', 'danh từ', 'N4', 6, '台風が近づいているので注意してください。', 'Bão đang tới gần nên xin hãy cẩn thận.'),
('四季', 'しき', 'shiki', 'bốn mùa', 'danh từ', 'N3', 6, '日本には美しい四季の変化があります。', 'Nhật Bản có sự thay đổi bốn mùa tuyệt đẹp.'),
('温暖', 'おんだん', 'ondan', 'ấm áp, ôn hòa', 'tính từ', 'N3', 6, 'この地域は一年を通して温暖な気候です。', 'Khu vực này quanh năm khí hậu ôn hòa.'),

-- Chủ đề 7: Công việc & Văn phòng (topic_id = 7)
('会社', 'かいしゃ', 'kaisha', 'công ty', 'danh từ', 'N5', 7, '日本のIT会社で働いています。', 'Tôi đang làm việc tại một công ty IT Nhật Bản.'),
('仕事', 'しごと', 'shigoto', 'công việc', 'danh từ', 'N5', 7, '今日の仕事はもう終わりました。', 'Công việc hôm nay của tôi đã xong rồi.'),
('会議', 'かいぎ', 'kaigi', 'cuộc họp', 'danh từ', 'N4', 7, '午後から大事な会議があります。', 'Từ buổi chiều có một cuộc họp quan trọng.'),
('名刺', 'めいし', 'meishi', 'danh thiếp', 'danh từ', 'N4', 7, 'お客様と名刺を交換します。', 'Tôi trao đổi danh thiếp với khách hàng.'),
('面接', 'めんせつ', 'mensetsu', 'phỏng vấn', 'danh từ', 'N4', 7, '明日はアルバイトの面接があります。', 'Ngày mai tôi có buổi phỏng vấn xin việc làm thêm.'),
('残業', 'ざんぎょう', 'zangyou', 'làm thêm giờ (OT)', 'danh từ', 'N4', 7, '忙しい時期は残業が多くなります。', 'Giai đoạn bận rộn thì việc làm thêm giờ tăng lên.'),
('出張', 'しゅっちょう', 'shucchou', 'đi công tác', 'danh từ', 'N3', 7, '来月、大阪へ出張することになりました。', 'Tháng sau tôi được phân công đi công tác Osaka.'),
('契約', 'けいやく', 'keiyaku', 'hợp đồng', 'danh từ', 'N3', 7, '新しい取引先と契約を結びました。', 'Chúng tôi đã ký hợp đồng với đối tác mới.'),
('同僚', 'どうりょう', 'douryou', 'đồng nghiệp', 'danh từ', 'N3', 7, '親切な同僚にいつも助けられています。', 'Tôi luôn được những người đồng nghiệp tốt bụng giúp đỡ.'),

-- Chủ đề 8: Du lịch & Khách sạn (topic_id = 8)
('旅行', 'りょこう', 'ryokou', 'du lịch', 'danh từ', 'N5', 8, '家族と一緒に北海道へ旅行しました。', 'Tôi đã đi du lịch Hokkaido cùng gia đình.'),
('ホテル', 'ホテル', 'hoteru', 'khách sạn', 'danh từ', 'N5', 8, '駅の近くのホテルを予約しました。', 'Tôi đã đặt phòng ở khách sạn gần ga.'),
('部屋', 'へや', 'heya', 'căn phòng', 'danh từ', 'N5', 8, '窓から海の見える部屋に泊まりました。', 'Tôi trọ ở căn phòng nhìn ra biển từ cửa sổ.'),
('お土産', 'おみやげ', 'omiyage', 'quà lưu niệm, đặc sản', 'danh từ', 'N4', 8, '友達にお土産のお菓子を買いました。', 'Tôi đã mua bánh kẹo làm quà lưu niệm cho bạn bè.'),
('案内', 'あんない', 'annai', 'hướng dẫn, dẫn đường', 'danh từ', 'N4', 8, '街の観光地を案内してくれました。', 'Anh ấy đã hướng dẫn tôi đi các điểm tham quan trong thành phố.'),
('景色', 'けしき', 'keshiki', 'phong cảnh', 'danh từ', 'N4', 8, '山頂からの景色は本当に素晴らしいです。', 'Phong cảnh từ đỉnh núi thực sự rất tuyệt vời.'),
('観光客', 'かんこうきゃく', 'kankoukyaku', 'khách du lịch', 'danh từ', 'N3', 8, '京都は世界中からの観光客で賑わっています。', 'Kyoto nhộn nhịp với du khách từ khắp nơi trên thế giới.'),
('宿泊', 'しゅくはく', 'shukuhaku', 'trọ lại, lưu trú', 'danh từ', 'N3', 8, '温泉旅館に一泊宿泊しました。', 'Tôi đã trọ một đêm tại lữ quán suối nước nóng.')
ON CONFLICT (word, reading) DO NOTHING;
