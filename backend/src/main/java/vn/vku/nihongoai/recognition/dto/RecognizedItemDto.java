package vn.vku.nihongoai.recognition.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.user.JlptLevel;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecognizedItemDto {
    private String word;
    private String reading;
    private String romaji;
    private String meaningVi;
    private String partOfSpeech;
    private String hanViet;
    private JlptLevel jlptLevel;
    private String exampleJa;
    private String exampleVi;
    private String exampleReading;
    private Double confidence;

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
