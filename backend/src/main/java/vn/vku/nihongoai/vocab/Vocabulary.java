package vn.vku.nihongoai.vocab;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.user.User;

import java.time.Instant;

@Entity
@Table(name = "vocabularies", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"word", "reading"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vocabulary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String word;

    @Column(length = 150)
    private String reading;

    @Column(length = 150)
    private String romaji;

    @Column(name = "meaning_vi", nullable = false, length = 500)
    private String meaningVi;

    @Column(name = "part_of_speech", length = 30)
    private String partOfSpeech;

    @Column(name = "han_viet", length = 150)
    private String hanViet;

    @Enumerated(EnumType.STRING)
    @Column(name = "jlpt_level", length = 2)
    private JlptLevel jlptLevel;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "topic_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Topic topic;

    @Column(name = "example_ja", length = 500)
    private String exampleJa;

    @Column(name = "example_vi", length = 500)
    private String exampleVi;

    @Column(name = "example_reading", length = 500)
    private String exampleReading;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
