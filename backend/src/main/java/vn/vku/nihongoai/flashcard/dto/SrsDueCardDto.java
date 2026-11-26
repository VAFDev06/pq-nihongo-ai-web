package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.flashcard.CardProgress;
import vn.vku.nihongoai.flashcard.CardState;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SrsDueCardDto {
    private Long cardProgressId;
    private Long flashcardId;
    private Long deckId;
    private String deckName;
    private String front;
    private String reading;
    private String back;
    private String partOfSpeech;
    private String hanViet;
    private String exampleJa;
    private String exampleVi;
    private String exampleReading;
    private String imageUrl;
    private String note;
    private Integer srsLevel;
    private String srsLevelLabel;
    private Boolean isDue;
    private CardState state;
    private BigDecimal easeFactor;
    private Integer intervalDays;
    private Integer repetitions;
    private Integer lapses;
    private Integer reviewCount;
    private Instant dueAt;
    private Instant lastReviewedAt;

    public static String levelLabel(int level) {
        return switch (level) {
            case 0 -> "Từ mới";
            case 1 -> "Đang học (4 giờ)";
            case 2 -> "Đang ghi nhớ (3 ngày)";
            case 3 -> "Ghi nhớ tốt (7 ngày)";
            case 4 -> "Ghi nhớ rất tốt (14 ngày)";
            case 5 -> "Đã thuộc";
            default -> "Level " + level;
        };
    }

    public static SrsDueCardDto from(CardProgress cp) {
        return from(cp, Instant.now());
    }

    public static SrsDueCardDto from(CardProgress cp, Instant now) {
        int lvl = cp.getSrsLevel() != null ? cp.getSrsLevel() : 0;
        boolean due = lvl >= 1 && lvl <= 4 && cp.getDueAt() != null && !cp.getDueAt().isAfter(now);
        return SrsDueCardDto.builder()
                .cardProgressId(cp.getId())
                .flashcardId(cp.getFlashcard().getId())
                .deckId(cp.getFlashcard().getDeck().getId())
                .deckName(cp.getFlashcard().getDeck().getName())
                .front(cp.getFlashcard().getFront())
                .reading(cp.getFlashcard().getReading())
                .back(cp.getFlashcard().getBack())
                .partOfSpeech(cp.getFlashcard().getPartOfSpeech())
                .hanViet(cp.getFlashcard().getHanViet())
                .exampleJa(cp.getFlashcard().getExampleJa())
                .exampleVi(cp.getFlashcard().getExampleVi())
                .exampleReading(cp.getFlashcard().getExampleReading())
                .imageUrl(cp.getFlashcard().getImageUrl())
                .note(cp.getFlashcard().getNote())
                .srsLevel(lvl)
                .srsLevelLabel(levelLabel(lvl))
                .isDue(due)
                .state(cp.getState())
                .easeFactor(cp.getEaseFactor())
                .intervalDays(cp.getIntervalDays())
                .repetitions(cp.getRepetitions())
                .lapses(cp.getLapses())
                .reviewCount(cp.getReviewCount() != null ? cp.getReviewCount() : 0)
                .dueAt(cp.getDueAt())
                .lastReviewedAt(cp.getLastReviewedAt())
                .build();
    }

    public Long getCardId() {
        return this.flashcardId;
    }

    public String getJapaneseText() {
        return this.front;
    }

    public String getVietnameseMeaning() {
        return this.back;
    }

    public String getExampleSentence() {
        return this.exampleJa;
    }

    public String getExampleMeaning() {
        return this.exampleVi;
    }
}
