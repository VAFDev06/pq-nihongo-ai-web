package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.flashcard.Flashcard;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlashcardDto {
    private Long id;
    private Long deckId;
    private Long userVocabularyId;
    private String front;
    private String reading;
    private String back;
    private String partOfSpeech;
    private String hanViet;
    private String exampleJa;
    private String exampleVi;
    private String exampleReading;
    private String imageUrl;
    private String note;
    private Integer position;

    public static FlashcardDto from(Flashcard f) {
        return FlashcardDto.builder()
                .id(f.getId())
                .deckId(f.getDeck().getId())
                .userVocabularyId(f.getUserVocabulary() != null ? f.getUserVocabulary().getId() : null)
                .front(f.getFront())
                .reading(f.getReading())
                .back(f.getBack())
                .partOfSpeech(f.getPartOfSpeech())
                .hanViet(f.getHanViet())
                .exampleJa(f.getExampleJa())
                .exampleVi(f.getExampleVi())
                .exampleReading(f.getExampleReading())
                .imageUrl(f.getImageUrl())
                .note(f.getNote())
                .position(f.getPosition())
                .build();
    }

    public String getJapaneseText() {
        return this.front;
    }

    public String getVietnameseMeaning() {
        return this.back;
    }

    public String getExampleSentence() {
        return this.exampleJa;
    }

    public String getExampleMeaning() {
        return this.exampleVi;
    }

    public String getNotes() {
        return this.note;
    }
}
