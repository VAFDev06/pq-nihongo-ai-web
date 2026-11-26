package vn.vku.nihongoai.shadowing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "youtube_video_sentences", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"video_id", "sentence_order"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YouTubeVideoSentence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "video_id", nullable = false, length = 20)
    private String videoId;

    @Column(name = "sentence_order", nullable = false)
    private Integer sentenceOrder;

    @Column(name = "japanese_text", nullable = false, columnDefinition = "TEXT")
    private String japaneseText;

    @Column(name = "hiragana_text", columnDefinition = "TEXT")
    private String hiraganaText;

    @Column(name = "vietnamese_translation", columnDefinition = "TEXT")
    private String vietnameseTranslation;

    @Column(name = "translation_status", nullable = false, length = 20)
    @Builder.Default
    private String translationStatus = "PENDING"; // TRANSLATED, PENDING, FAILED

    @Column(name = "start_time", nullable = false)
    private Double startTime;

    @Column(name = "end_time", nullable = false)
    private Double endTime;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
