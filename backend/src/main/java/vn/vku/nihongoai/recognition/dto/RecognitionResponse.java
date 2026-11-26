package vn.vku.nihongoai.recognition.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecognitionResponse {
    private Long recognitionId;
    private String imageUrl;
    private String rawOcrText;
    private List<RecognizedItemDto> items;
    private Boolean isCorrect;
    private Instant createdAt;

    public List<RecognizedItemDto> getVocabularies() {
        return this.items;
    }
}
