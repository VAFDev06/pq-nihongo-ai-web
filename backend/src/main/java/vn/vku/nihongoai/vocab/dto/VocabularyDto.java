package vn.vku.nihongoai.vocab.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.vocab.Vocabulary;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VocabularyDto {
    private Long id;

    @JsonAlias({"word", "japaneseText"})
    private String word;

    private String reading;
    private String romaji;

    @JsonAlias({"meaningVi", "vietnameseMeaning"})
    private String meaningVi;

    private String partOfSpeech;

    @JsonAlias({"hanViet", "sinoVietnamese", "han_viet"})
    private String hanViet;

    private JlptLevel jlptLevel;
    private Long topicId;
    private String topicNameVi;

    @JsonAlias({"exampleJa", "exampleSentence"})
    private String exampleJa;

    @JsonAlias({"exampleVi", "exampleMeaning"})
    private String exampleVi;

    @JsonAlias({"exampleReading", "exampleHiragana"})
    private String exampleReading;

    private String imageUrl;

    public String getJapaneseText() {
        return this.word;
    }

    public String getVietnameseMeaning() {
        return this.meaningVi;
    }

    public String getExampleSentence() {
        return this.exampleJa;
    }

    public String getExampleMeaning() {
        return this.exampleVi;
    }

    public static VocabularyDto from(Vocabulary v) {
        return VocabularyDto.builder()
                .id(v.getId())
                .word(v.getWord())
                .reading(v.getReading())
                .romaji(v.getRomaji())
                .meaningVi(v.getMeaningVi())
                .partOfSpeech(v.getPartOfSpeech())
                .hanViet(v.getHanViet())
                .jlptLevel(v.getJlptLevel())
                .topicId(v.getTopic() != null ? v.getTopic().getId() : null)
                .topicNameVi(v.getTopic() != null ? v.getTopic().getNameVi() : null)
                .exampleJa(v.getExampleJa())
                .exampleVi(v.getExampleVi())
                .exampleReading(v.getExampleReading())
                .imageUrl(v.getImageUrl())
                .build();
    }
}
