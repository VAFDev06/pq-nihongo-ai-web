package vn.vku.nihongoai.conversation;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import vn.vku.nihongoai.user.JlptLevel;

import java.time.Instant;

@Entity
@Table(name = "conversation_topics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationTopic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonAlias({"nameVi", "title"})
    @Column(name = "name_vi", nullable = false, length = 100)
    private String nameVi;

    @Column(name = "name_ja", length = 100)
    private String nameJa;

    @Column(length = 500)
    private String description;

    @Column(length = 50)
    private String icon;

    @Enumerated(EnumType.STRING)
    @Column(name = "jlpt_level", length = 2)
    private JlptLevel jlptLevel;

    @Column(name = "system_prompt", nullable = false, columnDefinition = "TEXT")
    private String systemPrompt;

    @Column(name = "ai_role", length = 150)
    private String aiRole;

    @Column(name = "user_role", length = 150)
    private String userRole;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public String getTitle() {
        return this.nameVi;
    }
}
