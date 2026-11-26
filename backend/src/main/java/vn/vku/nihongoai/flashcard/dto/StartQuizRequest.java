package vn.vku.nihongoai.flashcard.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import vn.vku.nihongoai.flashcard.QuizType;

@Data
public class StartQuizRequest {
    private Long deckId;

    @NotNull(message = "quizType không được để trống")
    @JsonAlias({"quizType", "type"})
    private QuizType quizType;

    @Min(value = 3, message = "Tối thiểu 3 câu hỏi")
    @Max(value = 50, message = "Tối đa 50 câu hỏi")
    @JsonAlias({"count", "questionCount"})
    private Integer count = 10;
}
