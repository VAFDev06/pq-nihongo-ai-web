package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.flashcard.ReviewLog;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewLogDto {
    private Long id;
    private Long flashcardId;
    private Long deckId;
    private String deckName;
    private String front;
    private String reading;
    private String back;
    private String hanViet;
    private Integer rating;
    private Integer previousLevel;
    private Integer newLevel;
    private String reviewMode;
    private String ratingLabel;
    private Integer prevIntervalDays;
    private Integer newIntervalDays;
    private BigDecimal easeFactor;
    private Integer durationMs;
    private Instant prevDueAt;
    private Instant nextDueAt;
    private Instant reviewedAt;

    public static ReviewLogDto from(ReviewLog rl) {
        int lvl = rl.getNewLevel() != null ? rl.getNewLevel() : (rl.getRating() != null ? rl.getRating() : 0);
        String label = switch (lvl) {
            case 1 -> "Level 1 · Đang học (4 giờ)";
            case 2 -> "Level 2 · Đang ghi nhớ (3 ngày)";
            case 3 -> "Level 3 · Ghi nhớ tốt (7 ngày)";
            case 4 -> "Level 4 · Ghi nhớ rất tốt (14 ngày)";
            case 5 -> "Level 5 · Đã thuộc (Vĩnh viễn)";
            default -> "Level " + lvl;
        };
        return ReviewLogDto.builder()
                .id(rl.getId())
                .flashcardId(rl.getFlashcard() != null ? rl.getFlashcard().getId() : null)
                .deckId(rl.getFlashcard() != null && rl.getFlashcard().getDeck() != null ? rl.getFlashcard().getDeck().getId() : null)
                .deckName(rl.getFlashcard() != null && rl.getFlashcard().getDeck() != null ? rl.getFlashcard().getDeck().getName() : null)
                .front(rl.getFlashcard() != null ? rl.getFlashcard().getFront() : "")
                .reading(rl.getFlashcard() != null ? rl.getFlashcard().getReading() : "")
                .back(rl.getFlashcard() != null ? rl.getFlashcard().getBack() : "")
                .hanViet(rl.getFlashcard() != null ? rl.getFlashcard().getHanViet() : "")
                .rating(lvl)
                .previousLevel(rl.getPreviousLevel())
                .newLevel(lvl)
                .reviewMode(rl.getReviewMode() != null ? rl.getReviewMode() : "DUE_REVIEW")
                .ratingLabel(label)
                .prevIntervalDays(rl.getPrevIntervalDays())
                .newIntervalDays(rl.getNewIntervalDays())
                .easeFactor(rl.getEaseFactor())
                .durationMs(rl.getDurationMs())
                .prevDueAt(rl.getPrevDueAt())
                .nextDueAt(rl.getNextDueAt())
                .reviewedAt(rl.getReviewedAt())
                .build();
    }
}
