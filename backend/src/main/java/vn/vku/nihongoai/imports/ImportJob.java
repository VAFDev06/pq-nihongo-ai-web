package vn.vku.nihongoai.imports;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import vn.vku.nihongoai.flashcard.Deck;
import vn.vku.nihongoai.user.User;

import java.time.Instant;

@Entity
@Table(name = "import_jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 15)
    private ImportTargetType targetType;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deck_id")
    private Deck deck;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Enumerated(EnumType.STRING)
    @Column(name = "file_type", nullable = false, length = 5)
    private ImportFileType fileType;

    @Column(name = "total_rows", nullable = false)
    @Builder.Default
    private Integer totalRows = 0;

    @Column(name = "success_rows", nullable = false)
    @Builder.Default
    private Integer successRows = 0;

    @Column(name = "skipped_rows", nullable = false)
    @Builder.Default
    private Integer skippedRows = 0;

    @Column(name = "error_rows", nullable = false)
    @Builder.Default
    private Integer errorRows = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private ImportJobStatus status = ImportJobStatus.PREVIEW;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "error_report", columnDefinition = "TEXT")
    private String errorReport; // JSON array of [{row, field, message}]

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Integer getInsertedCount() {
        return this.successRows;
    }

    public Integer getUpdatedCount() {
        return 0;
    }
}
