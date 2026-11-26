package vn.vku.nihongoai.flashcard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AnswerQuizRequest {
    @NotNull(message = "flashcardId không được để trống")
    @com.fasterxml.jackson.annotation.JsonAlias({"flashcardId", "questionId", "cardId"})
    private Long flashcardId;

    @NotBlank(message = "userAnswer không được để trống")
    @com.fasterxml.jackson.annotation.JsonAlias({"answer", "userAnswer", "selectedAnswer"})
    private String answer;
}
