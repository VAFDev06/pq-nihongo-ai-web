package vn.vku.nihongoai.flashcard.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class AddCardsFromVocabRequest {
    @NotEmpty(message = "Danh sách ID từ vựng không được để trống")
    private List<Long> userVocabularyIds;
}
