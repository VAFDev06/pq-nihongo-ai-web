package vn.vku.nihongoai.shadowing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import vn.vku.nihongoai.user.User;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "shadowing_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShadowingAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    private ShadowingLesson lesson;

    @Column(name = "recognized_text", nullable = false, length = 2000)
    private String recognizedText;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal accuracy;

    @Column(name = "word_diff", nullable = false, columnDefinition = "TEXT")
    private String wordDiff; // JSON array of WordDiffItem

    @Column(name = "audio_url", length = 500)
    private String audioUrl;

    @Column(name = "playback_speed", precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal playbackSpeed = new BigDecimal("1.00");

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
