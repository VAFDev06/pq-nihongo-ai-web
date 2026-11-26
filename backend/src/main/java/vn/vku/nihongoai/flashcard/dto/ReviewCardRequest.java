package vn.vku.nihongoai.flashcard.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewCardRequest {
    @NotNull(message = "flashcardId không được để trống")
    @JsonAlias({"flashcardId", "cardId", "id"})
    private Long flashcardId;

    @NotNull(message = "Cấp độ đánh giá (1..5) không được để trống")
    @Min(value = 1, message = "Cấp độ đánh giá phải từ 1 (Đang học - 4 giờ) đến 5 (Đã thuộc)")
    @Max(value = 5, message = "Cấp độ đánh giá phải từ 1 (Đang học - 4 giờ) đến 5 (Đã thuộc)")
    @JsonAlias({"targetLevel", "level", "srsLevel", "rating"})
    private Integer targetLevel;

    /**
     * DUE_REVIEW (ôn theo lịch đến hạn) | SET_RELEARN (học lại bộ thẻ) | MANUAL_LEVEL (đổi cấp độ trực tiếp)
     */
    private String reviewMode;

    private Integer durationMs;

    public Integer getRating() {
        return this.targetLevel;
    }

    public void setRating(Integer rating) {
        this.targetLevel = rating;
    }
}
