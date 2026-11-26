package vn.vku.nihongoai.flashcard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.flashcard.QuizType;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizQuestionDto {
    private Long flashcardId;
    private QuizType quizType;
    private String questionText;      // từ tiếng Nhật hoặc câu hỏi
    private String questionAudio;     // từ cần phát âm cho LISTENING
    private String reading;
    private String correctAnswer;
    private List<String> options;     // 4 lựa chọn (cho MULTIPLE_CHOICE và LISTENING)
    private String hint;

    public String getReadingHint() {
        return this.reading;
    }

    public Long getId() {
        return this.flashcardId;
    }
}
