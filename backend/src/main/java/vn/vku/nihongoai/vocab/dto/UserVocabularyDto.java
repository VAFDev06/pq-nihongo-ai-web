package vn.vku.nihongoai.vocab.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.vocab.UserVocabulary;
import vn.vku.nihongoai.vocab.VocabSource;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserVocabularyDto {
    private Long id;
    private Long vocabularyId;
    private String word;
    private String reading;
    private String romaji;
    private String meaningVi;
    private String partOfSpeech;
    private String hanViet;
    private String jlptLevel;
    private String exampleJa;
    private String exampleVi;
    private String exampleReading;
    private String imageUrl;
    private String note;
    private VocabSource source;
    private Boolean isMastered;
    private Instant createdAt;

    public static UserVocabularyDto from(UserVocabulary uv) {
        return UserVocabularyDto.builder()
                .id(uv.getId())
                .vocabularyId(uv.getVocabulary() != null ? uv.getVocabulary().getId() : null)
                .word(uv.getWord())
                .reading(uv.getReading())
                .romaji(uv.getRomaji())
                .meaningVi(uv.getMeaningVi())
                .partOfSpeech(uv.getPartOfSpeech())
                .hanViet(uv.getHanViet())
                .jlptLevel(uv.getJlptLevel())
                .exampleJa(uv.getExampleJa())
                .exampleVi(uv.getExampleVi())
                .exampleReading(uv.getExampleReading())
                .imageUrl(uv.getImageUrl())
                .note(uv.getNote())
                .source(uv.getSource())
                .isMastered(uv.getIsMastered())
                .createdAt(uv.getCreatedAt())
                .build();
    }

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
}
