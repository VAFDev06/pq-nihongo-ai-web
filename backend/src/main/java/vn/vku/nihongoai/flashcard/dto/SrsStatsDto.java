package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SrsStatsDto {
    private Long deckId;
    // 3 chỉ số chuẩn đồng bộ 100% giữa Dashboard, SRS và PostgreSQL
    private long totalSrsCards;
    private long rememberedCards;  // CHỈ Level 5 (Đã thuộc vĩnh viễn)
    private long dueTodayCards;    // CHỈ Level 1..4 có dueAt <= now (không tính Level 0 & Level 5)

    // Phân bố chi tiết 6 cấp độ (Level 0 -> Level 5)
    private long level0Count;
    private long level1Count;
    private long level2Count;
    private long level3Count;
    private long level4Count;
    private long level5Count;

    // Trường phụ trợ tương thích
    private long newCards;         // = level0Count
    private long learningCards;    // = level1 + level2 + level3 + level4
    private long reviewedTodayCards;
    private long reviewsTodayCount;
    private long relearningCards;  // = level1Count
}
