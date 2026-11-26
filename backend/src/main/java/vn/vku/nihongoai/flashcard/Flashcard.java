package vn.vku.nihongoai.flashcard;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import vn.vku.nihongoai.vocab.UserVocabulary;

import java.time.Instant;

@Entity
@Table(name = "flashcards", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"deck_id", "front", "reading"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Flashcard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deck_id", nullable = false)
    private Deck deck;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_vocabulary_id")
    private UserVocabulary userVocabulary;

    @Column(nullable = false, length = 200)
    private String front;

    @Column(length = 200)
    private String reading;

    @Column(nullable = false, length = 500)
    private String back;

    @Column(name = "part_of_speech", length = 50)
    private String partOfSpeech;

    @Column(name = "han_viet", length = 150)
    private String hanViet;

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

    @Column(nullable = false)
    @Builder.Default
    private Integer position = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
