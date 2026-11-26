package vn.vku.nihongoai.vocab;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import vn.vku.nihongoai.user.User;

import java.time.Instant;

@Entity
@Table(name = "user_vocabularies", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "word", "reading"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserVocabulary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vocabulary_id")
    private Vocabulary vocabulary;

    @Column(nullable = false, length = 100)
    private String word;

    @Column(length = 150)
    private String reading;

    @Column(length = 150)
    private String romaji;

    @Column(name = "meaning_vi", nullable = false, length = 500)
    private String meaningVi;

    @Column(name = "part_of_speech", length = 50)
    private String partOfSpeech;

    @Column(name = "han_viet", length = 150)
    private String hanViet;

    @Column(name = "jlpt_level", length = 10)
    private String jlptLevel;

    @Column(name = "example_ja", length = 500)
    private String exampleJa;

    @Column(name = "example_vi", length = 500)
    private String exampleVi;

    @Column(name = "example_reading", length = 500)
    private String exampleReading;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(length = 1000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    @Builder.Default
    private VocabSource source = VocabSource.MANUAL;

    @Column(name = "is_mastered", nullable = false)
    @Builder.Default
    private Boolean isMastered = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
