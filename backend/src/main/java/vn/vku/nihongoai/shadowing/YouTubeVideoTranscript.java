package vn.vku.nihongoai.shadowing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "youtube_video_transcripts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YouTubeVideoTranscript {

    @Id
    @Column(name = "video_id", length = 20)
    private String videoId;

    @Column(length = 300)
    private String title;

    @Column(length = 200)
    private String author;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "extract_method", length = 50)
    private String extractMethod;

    @Column(name = "method_label", length = 150)
    private String methodLabel;

    @Column(length = 50)
    private String language;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
