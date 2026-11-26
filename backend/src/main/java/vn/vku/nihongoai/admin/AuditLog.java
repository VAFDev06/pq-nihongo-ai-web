package vn.vku.nihongoai.admin;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import vn.vku.nihongoai.user.User;

import java.time.Instant;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    private User admin;

    @Column(name = "admin_id", insertable = false, updatable = false)
    private Long adminId;

    @Column(nullable = false, length = 40)
    private String action; // LOCK_USER, DELETE_VOCAB, IMPORT_VOCAB...

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public String getEntityName() {
        return this.entityType;
    }

    public String getPerformedBy() {
        return this.adminId != null ? "Admin #" + this.adminId : "System Admin";
    }
}
