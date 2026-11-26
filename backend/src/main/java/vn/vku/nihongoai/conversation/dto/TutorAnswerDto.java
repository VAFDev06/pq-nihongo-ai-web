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
public class TutorAnswerDto {
    private String questionVi;
    private String japaneseExpression;
    private String readingHiragana;
    private String vietnameseMeaning;
    private String explanationVi;
    private List<SuggestedReplyDto> alternativeExpressions;
}
