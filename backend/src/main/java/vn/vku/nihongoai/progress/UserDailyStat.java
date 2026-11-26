package vn.vku.nihongoai.progress;

import jakarta.persistence.*;
import lombok.*;
import vn.vku.nihongoai.user.User;

import java.time.LocalDate;

@Entity
@Table(name = "user_daily_stats")
@IdClass(UserDailyStatId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDailyStat {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Id
    @Column(name = "stat_date", nullable = false)
    private LocalDate statDate;

    @Column(name = "words_added", nullable = false)
    @Builder.Default
    private Integer wordsAdded = 0;

    @Column(name = "cards_reviewed", nullable = false)
    @Builder.Default
    private Integer cardsReviewed = 0;

    @Column(name = "quiz_count", nullable = false)
    @Builder.Default
    private Integer quizCount = 0;

    @Column(name = "shadowing_count", nullable = false)
    @Builder.Default
    private Integer shadowingCount = 0;

    @Column(name = "conversation_count", nullable = false)
    @Builder.Default
    private Integer conversationCount = 0;

    @Column(name = "recognition_count", nullable = false)
    @Builder.Default
    private Integer recognitionCount = 0;

    @Column(name = "study_minutes", nullable = false)
    @Builder.Default
    private Integer studyMinutes = 0;
}
