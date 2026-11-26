package vn.vku.nihongoai.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NewWordDto {
    private String word;
    private String reading;
    private String meaningVi;

    public String getJapaneseText() {
        return this.word;
    }

    public String getVietnameseMeaning() {
        return this.meaningVi;
    }
}
