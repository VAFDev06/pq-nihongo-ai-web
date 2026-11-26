package vn.vku.nihongoai.flashcard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.flashcard.dto.AnswerQuizRequest;
import vn.vku.nihongoai.flashcard.dto.QuizSessionResultDto;
import vn.vku.nihongoai.flashcard.dto.StartQuizRequest;
import vn.vku.nihongoai.security.UserDetailsImpl;

import java.util.Map;

@RestController
@RequestMapping({"/api/v1/quiz", "/api/v1"})
@RequiredArgsConstructor
@Tag(name = "Quiz", description = "Kiểm tra trắc nghiệm, điền từ và nghe chọn từ")
public class QuizController {

    private final QuizService quizService;

    @PostMapping({"/start", "/quiz/start", "/decks/{deckId}/quiz/start"})
    @Operation(summary = "Khởi tạo một phiên làm quiz")
    public ApiResponse<QuizSessionResultDto> startQuiz(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable(required = false) Long deckId,
            @Valid @RequestBody StartQuizRequest request
    ) {
        if (request.getDeckId() == null && deckId != null) {
            request.setDeckId(deckId);
        }
        return ApiResponse.ok(quizService.startQuiz(userDetails.getId(), request));
    }

    @PostMapping("/{sessionId}/answer")
    @Operation(summary = "Gửi câu trả lời cho một câu hỏi trong phiên Quiz")
    public ApiResponse<Map<String, Boolean>> answerQuestion(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long sessionId,
            @Valid @RequestBody AnswerQuizRequest request
    ) {
        boolean correct = quizService.submitAnswer(userDetails.getId(), sessionId, request);
        return ApiResponse.ok(Map.of("isCorrect", correct));
    }

    @PostMapping("/{sessionId}/finish")
    @Operation(summary = "Kết thúc phiên Quiz và xem tổng kết điểm")
    public ApiResponse<QuizSessionResultDto> finishQuiz(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long sessionId
    ) {
        return ApiResponse.ok(quizService.finishQuiz(userDetails.getId(), sessionId));
    }
}
