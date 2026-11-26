package vn.vku.nihongoai.progress.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardProgressDto {
    private long totalSavedWords;
    private long masteredWords;
    private long totalSrsCards;
    private long dueCardsToday;
    private long newSrsCards;
    private long reviewedTodayCards;
    private long reviewsTodayCount;
    private long rememberedSrsCards;
    private long relearningSrsCards;
    private int dailyGoalCards;
    private int completedCardsToday;
    private double dailyGoalProgressPercentage;
    private double averageShadowingAccuracy;
    private long totalConversations;
    private long totalRecognitions;

    public long getDueCardsCount() {
        return this.dueCardsToday;
    }

    public long getTotalVocabCount() {
        return this.totalSavedWords;
    }

    public long getMasteredVocabCount() {
        return this.masteredWords;
    }

    public int getCardsReviewedToday() {
        return this.completedCardsToday;
    }

    public double getAverageShadowingScore() {
        return this.averageShadowingAccuracy;
    }

    public long getConversationsCount() {
        return this.totalConversations;
    }

    public long getShadowingAttemptsCount() {
        return this.totalRecognitions; // fallback
    }
}
