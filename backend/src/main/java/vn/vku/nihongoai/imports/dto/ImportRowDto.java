package vn.vku.nihongoai.imports.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportRowDto {
    private int rowNumber;
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
    private String note;
    private boolean valid;
    private boolean duplicate;
    private String errorMessage;

    public int getRowIndex() {
        return this.rowNumber;
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

    public boolean getIsValid() {
        return this.valid;
    }
}
