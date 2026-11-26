package vn.vku.nihongoai.flashcard;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import vn.vku.nihongoai.user.User;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "card_progress", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "flashcard_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flashcard_id", nullable = false)
    private Flashcard flashcard;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    @Builder.Default
    private CardState state = CardState.NEW;

    /**
     * Hệ thống SRS 6 cấp độ:
     * 0: Từ mới (chưa đánh giá lần đầu)
     * 1: Đang học (ôn lại sau 4 giờ)
     * 2: Đang ghi nhớ (ôn lại sau 3 ngày)
     * 3: Ghi nhớ tốt (ôn lại sau 7 ngày)
     * 4: Ghi nhớ rất tốt (ôn lại sau 14 ngày)
     * 5: Đã thuộc (vĩnh viễn - dueAt = null)
     */
    @Column(name = "srs_level", nullable = false)
    @Builder.Default
    private Integer srsLevel = 0;

    @Column(name = "ease_factor", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal easeFactor = new BigDecimal("2.50");

    @Column(name = "interval_days", nullable = false)
    @Builder.Default
    private Integer intervalDays = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer repetitions = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer lapses = 0;

    @Column(name = "review_count", nullable = false)
    @Builder.Default
    private Integer reviewCount = 0;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "last_reviewed_at")
    private Instant lastReviewedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
