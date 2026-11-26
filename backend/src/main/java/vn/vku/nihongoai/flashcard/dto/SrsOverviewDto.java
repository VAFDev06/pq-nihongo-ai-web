package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SrsOverviewDto {
    private SrsStatsDto stats;
    private List<DeckOptionDto> decks;
    private List<SrsDueCardDto> cards;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeckOptionDto {
        private Long id;
        private String name;
        private long totalCards;
        private long dueCards;
        private long level0Count;
        private long masteredCount;
    }
}
