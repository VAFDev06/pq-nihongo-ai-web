package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.flashcard.QuizType;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizSessionResultDto {
    private Long sessionId;
    private Long deckId;
    private String deckName;
    private QuizType quizType;
    private int totalQuestions;
    private int correctCount;
    private double accuracyPercentage;
    private List<QuizQuestionDto> questions;
    private Instant startedAt;
    private Instant finishedAt;

    public Long getAttemptId() {
        return this.sessionId;
    }
}
