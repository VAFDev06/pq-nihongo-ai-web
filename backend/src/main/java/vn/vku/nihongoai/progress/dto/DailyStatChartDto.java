package vn.vku.nihongoai.progress.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyStatChartDto {
    private LocalDate date;
    private String dayOfWeek;
    private int cardsReviewed;
    private int wordsAdded;
    private int shadowingCount;
    private int conversationCount;
    private int studyMinutes;
}
