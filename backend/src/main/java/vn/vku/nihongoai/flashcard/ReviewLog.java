package vn.vku.nihongoai.flashcard;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import vn.vku.nihongoai.user.User;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "review_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flashcard_id", nullable = false)
    private Flashcard flashcard;

    @Column(nullable = false)
    private Integer rating; // Lưu đồng bộ targetLevel (1..5) cho tương thích

    @Column(name = "previous_level")
    private Integer previousLevel;

    @Column(name = "new_level")
    private Integer newLevel;

    @Column(name = "review_mode", nullable = false, length = 20)
    @Builder.Default
    private String reviewMode = "DUE_REVIEW"; // DUE_REVIEW | SET_RELEARN | MANUAL_LEVEL

    @Column(name = "prev_interval_days", nullable = false)
    private Integer prevIntervalDays;

    @Column(name = "new_interval_days", nullable = false)
    private Integer newIntervalDays;

    @Column(name = "ease_factor", nullable = false, precision = 4, scale = 2)
    private BigDecimal easeFactor;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "prev_due_at")
    private Instant prevDueAt;

    @Column(name = "next_due_at")
    private Instant nextDueAt;

    @CreationTimestamp
    @Column(name = "reviewed_at", nullable = false, updatable = false)
    private Instant reviewedAt;
}
