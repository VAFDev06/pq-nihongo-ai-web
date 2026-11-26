package vn.vku.nihongoai.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.conversation.Conversation;
import vn.vku.nihongoai.conversation.ConversationStatus;
import vn.vku.nihongoai.user.JlptLevel;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationDetailDto {
    private Long id;
    private Long topicId;
    private String topicNameVi;
    private JlptLevel jlptLevel;
    private String tutorMode;
    private String chatMode;
    private String title;
    private ConversationStatus status;
    private String summary;
    private int messageCount;
    private List<ConversationMessageDto> messages;
    private Instant startedAt;
    private Instant endedAt;

    public static ConversationDetailDto from(Conversation c, List<ConversationMessageDto> messages) {
        int count = (messages != null && !messages.isEmpty())
                ? messages.size()
                : (c.getMessages() != null ? c.getMessages().size() : 0);
        return ConversationDetailDto.builder()
                .id(c.getId())
                .topicId(c.getTopic() != null ? c.getTopic().getId() : null)
                .topicNameVi(c.getTopic() != null ? c.getTopic().getNameVi() : null)
                .jlptLevel(c.getJlptLevel())
                .tutorMode(c.getTutorMode() != null ? c.getTutorMode() : "ROLEPLAY")
                .chatMode(c.getChatMode() != null ? c.getChatMode() : "CHAT")
                .title(c.getTitle())
                .status(c.getStatus())
                .summary(c.getSummary())
                .messageCount(count)
                .messages(messages)
                .startedAt(c.getStartedAt())
                .endedAt(c.getEndedAt())
                .build();
    }

    public String getTopicTitle() {
        return this.topicNameVi != null ? this.topicNameVi : this.title;
    }

    public Instant getCreatedAt() {
        return this.startedAt;
    }
}
