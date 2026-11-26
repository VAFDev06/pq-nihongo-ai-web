package vn.vku.nihongoai.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.conversation.CorrectionCategory;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeakPointDto {
    private CorrectionCategory category;
    private long count;
    private String descriptionVi;
}
