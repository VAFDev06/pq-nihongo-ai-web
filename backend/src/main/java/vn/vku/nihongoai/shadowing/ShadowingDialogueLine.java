package vn.vku.nihongoai.shadowing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "shadowing_dialogue_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShadowingDialogueLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private ShadowingLesson lesson;

    @Column(name = "line_order", nullable = false)
    @Builder.Default
    private Integer lineOrder = 1;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String speaker = "A";

    @Column(name = "japanese_text", nullable = false, columnDefinition = "TEXT")
    private String japaneseText;

    @Column(name = "hiragana_text", columnDefinition = "TEXT")
    private String hiraganaText;

    @Column(name = "vietnamese_translation", columnDefinition = "TEXT")
    private String vietnameseTranslation;

    @Column(name = "audio_url", length = 500)
    private String audioUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
