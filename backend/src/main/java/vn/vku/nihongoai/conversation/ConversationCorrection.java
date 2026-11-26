package vn.vku.nihongoai.conversation;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import vn.vku.nihongoai.user.User;

import java.time.Instant;

@Entity
@Table(name = "conversation_corrections")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationCorrection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private ConversationMessage message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "original_text", nullable = false, length = 500)
    private String originalText;

    @Column(name = "corrected_text", nullable = false, length = 500)
    private String correctedText;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private CorrectionCategory category;

    @Column(name = "explanation_vi", nullable = false, length = 1000)
    private String explanationVi;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
