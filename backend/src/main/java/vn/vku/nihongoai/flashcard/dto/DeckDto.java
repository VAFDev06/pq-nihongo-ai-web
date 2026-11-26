package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.flashcard.Deck;
import vn.vku.nihongoai.flashcard.DeckStatus;
import vn.vku.nihongoai.user.JlptLevel;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeckDto {
    private Long id;
    private String name;
    private String description;
    private JlptLevel jlptLevel;
    private Long topicId;
    private String topicNameVi;
    private String coverImageUrl;
    private DeckStatus status;
    private Boolean isSystem;
    private Boolean isPublic;
    private Boolean isActive;
    private Boolean isMine;
    private long totalCards;
    private long dueCards;       // Level 1..4 đến hạn (dueAt <= now)
    private long level0Count;    // Từ mới chưa học
    private long learningCount;  // Level 1..4 đang học
    private long masteredCount;  // Level 5 đã thuộc vĩnh viễn
    private int progressPercentage;
    private Instant createdAt;
    private Instant updatedAt;

    public static DeckDto from(Deck deck, Long currentUserId, long totalCards, long dueCards) {
        return from(deck, currentUserId, totalCards, dueCards, 0, 0, 0);
    }

    public static DeckDto from(
            Deck deck,
            Long currentUserId,
            long totalCards,
            long dueCards,
            long level0Count,
            long learningCount,
            long masteredCount
    ) {
        boolean isMine = deck.getOwner() != null && deck.getOwner().getId().equals(currentUserId);
        DeckStatus st = deck.getStatus();
        if (st == null) {
            if (Boolean.FALSE.equals(deck.getIsActive())) {
                st = DeckStatus.ARCHIVED;
            } else if (Boolean.TRUE.equals(deck.getIsSystem()) && Boolean.FALSE.equals(deck.getIsPublic())) {
                st = DeckStatus.DRAFT;
            } else {
                st = DeckStatus.PUBLISHED;
            }
        }
        int pct = totalCards > 0 ? (int) Math.round((double) masteredCount * 100.0 / totalCards) : 0;
        return DeckDto.builder()
                .id(deck.getId())
                .name(deck.getName())
                .description(deck.getDescription())
                .jlptLevel(deck.getJlptLevel())
                .topicId(deck.getTopic() != null ? deck.getTopic().getId() : null)
                .topicNameVi(deck.getTopic() != null ? deck.getTopic().getNameVi() : null)
                .coverImageUrl(deck.getCoverImageUrl())
                .status(st)
                .isSystem(deck.getIsSystem())
                .isPublic(deck.getIsPublic())
                .isActive(deck.getIsActive())
                .isMine(isMine)
                .totalCards(totalCards)
                .dueCards(dueCards)
                .level0Count(level0Count)
                .learningCount(learningCount)
                .masteredCount(masteredCount)
                .progressPercentage(pct)
                .createdAt(deck.getCreatedAt())
                .updatedAt(deck.getUpdatedAt())
                .build();
    }

    public String getTitle() {
        return this.name;
    }

    public long getCardCount() {
        return this.totalCards;
    }

    public long getDueCount() {
        return this.dueCards;
    }
}
