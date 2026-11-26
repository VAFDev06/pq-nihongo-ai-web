package vn.vku.nihongoai.shadowing.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.shadowing.ShadowingDialogueLine;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShadowingDialogueLineDto {
    private Long id;

    @JsonAlias({"lineOrder", "order"})
    private Integer lineOrder;

    private String speaker;

    @JsonAlias({"japaneseText", "japanese", "textJa"})
    private String japaneseText;

    @JsonAlias({"hiraganaText", "hiragana", "reading"})
    private String hiraganaText;

    @JsonAlias({"vietnameseTranslation", "vietnamese", "textVi"})
    private String vietnameseTranslation;

    private String audioUrl;

    public static ShadowingDialogueLineDto from(ShadowingDialogueLine line) {
        return ShadowingDialogueLineDto.builder()
                .id(line.getId())
                .lineOrder(line.getLineOrder())
                .speaker(line.getSpeaker())
                .japaneseText(line.getJapaneseText())
                .hiraganaText(line.getHiraganaText())
                .vietnameseTranslation(line.getVietnameseTranslation())
                .audioUrl(line.getAudioUrl())
                .build();
    }
}
