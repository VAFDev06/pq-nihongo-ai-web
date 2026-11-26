package vn.vku.nihongoai.conversation;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "conversation_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MessageRole role; // USER, AI

    @Column(name = "content_ja", nullable = false, columnDefinition = "TEXT")
    private String contentJa;

    @Column(name = "content_vi", columnDefinition = "TEXT")
    private String contentVi;

    @Column(name = "message_type", nullable = false, length = 20)
    @Builder.Default
    private String messageType = "CHAT";

    @Column(name = "suggested_replies_json", columnDefinition = "TEXT")
    private String suggestedRepliesJson;

    @Column(name = "tutor_answer_json", columnDefinition = "TEXT")
    private String tutorAnswerJson;

    @OneToMany(mappedBy = "message", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ConversationCorrection> corrections = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
