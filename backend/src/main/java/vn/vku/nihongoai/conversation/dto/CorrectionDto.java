package vn.vku.nihongoai.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.conversation.ConversationCorrection;
import vn.vku.nihongoai.conversation.CorrectionCategory;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrectionDto {
    private String original;
    private String corrected;
    private CorrectionCategory category;
    private String explanationVi;

    public static CorrectionDto from(ConversationCorrection c) {
        return CorrectionDto.builder()
                .original(c.getOriginalText())
                .corrected(c.getCorrectedText())
                .category(c.getCategory())
                .explanationVi(c.getExplanationVi())
                .build();
    }

    public String getOriginalText() {
        return this.original;
    }

    public String getCorrectedText() {
        return this.corrected;
    }

    public String getExplanation() {
        return this.explanationVi;
    }
}
