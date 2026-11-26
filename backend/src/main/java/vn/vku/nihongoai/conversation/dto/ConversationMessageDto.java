package vn.vku.nihongoai.conversation.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.conversation.ConversationMessage;
import vn.vku.nihongoai.conversation.MessageRole;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationMessageDto {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Long id;
    private MessageRole role;
    private String contentJa;
    private String contentVi;
    private String messageType;
    private List<CorrectionDto> corrections;
    private List<SuggestedReplyDto> suggestedReplies;
    private TutorAnswerDto tutorAnswer;
    private Instant createdAt;

    public static ConversationMessageDto from(ConversationMessage m) {
        List<SuggestedReplyDto> suggestions = List.of();
        if (m.getSuggestedRepliesJson() != null && !m.getSuggestedRepliesJson().isBlank()) {
            try {
                suggestions = MAPPER.readValue(m.getSuggestedRepliesJson(), new TypeReference<List<SuggestedReplyDto>>() {});
            } catch (Exception ignored) {
            }
        }
        TutorAnswerDto tutorAns = null;
        if (m.getTutorAnswerJson() != null && !m.getTutorAnswerJson().isBlank()) {
            try {
                tutorAns = MAPPER.readValue(m.getTutorAnswerJson(), TutorAnswerDto.class);
            } catch (Exception ignored) {
            }
        }
        return ConversationMessageDto.builder()
                .id(m.getId())
                .role(m.getRole())
                .contentJa(m.getContentJa())
                .contentVi(m.getContentVi())
                .messageType(m.getMessageType() != null ? m.getMessageType() : "CHAT")
                .corrections(m.getCorrections() != null ? m.getCorrections().stream().map(CorrectionDto::from).toList() : List.of())
                .suggestedReplies(suggestions)
                .tutorAnswer(tutorAns)
                .createdAt(m.getCreatedAt())
                .build();
    }

    public String getContent() {
        return this.contentJa;
    }

    public String getVietnameseTranslation() {
        return this.contentVi;
    }
}
