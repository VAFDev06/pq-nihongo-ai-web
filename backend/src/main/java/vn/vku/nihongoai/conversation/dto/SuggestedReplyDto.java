package vn.vku.nihongoai.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SuggestedReplyDto {
    private String japanese;
    private String reading;
    private String vietnamese;
}
