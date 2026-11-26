package vn.vku.nihongoai.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMessageResponse {
    private Long id;
    private String contentJa;
    private String contentVi;
    private String messageType;
    private List<CorrectionDto> corrections;
    private List<NewWordDto> newWords;
    private List<SuggestedReplyDto> suggestedReplies;
    private TutorAnswerDto tutorAnswer;
}
