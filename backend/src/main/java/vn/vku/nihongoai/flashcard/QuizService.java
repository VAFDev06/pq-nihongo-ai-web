package vn.vku.nihongoai.flashcard;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.dto.*;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class QuizService {

    private final QuizSessionRepository quizSessionRepository;
    private final QuizAnswerRepository quizAnswerRepository;
    private final FlashcardRepository flashcardRepository;
    private final DeckService deckService;
    private final SrsService srsService;
    private final UserService userService;
    @org.springframework.context.annotation.Lazy
    private final vn.vku.nihongoai.progress.ProgressService progressService;

    @Transactional
    public QuizSessionResultDto startQuiz(Long userId, StartQuizRequest request) {
        User user = userService.getUserOrThrow(userId);
        Deck deck = deckService.getAccessibleDeckOrThrow(request.getDeckId(), userId);

        List<Flashcard> cards = flashcardRepository.findAllByDeckIdOrderByPositionAsc(deck.getId());
        if (cards.size() < 3) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Bộ thẻ cần có tối thiểu 3 thẻ để tạo bài kiểm tra Quiz");
        }

        Collections.shuffle(cards);
        int count = Math.min(request.getCount(), cards.size());
        List<Flashcard> selectedCards = cards.subList(0, count);

        QuizSession session = QuizSession.builder()
                .user(user)
                .deck(deck)
                .quizType(request.getQuizType())
                .totalQuestions(count)
                .correctCount(0)
                .startedAt(Instant.now())
                .build();

        session = quizSessionRepository.save(session);

        List<QuizQuestionDto> questions = new ArrayList<>();
        for (Flashcard fc : selectedCards) {
            List<String> options = new ArrayList<>();
            options.add(fc.getBack());

            // 3 distractor choices
            List<Flashcard> distractors = new ArrayList<>(cards);
            distractors.remove(fc);
            Collections.shuffle(distractors);
            for (int i = 0; i < Math.min(3, distractors.size()); i++) {
                options.add(distractors.get(i).getBack());
            }
            Collections.shuffle(options);

            boolean isFillMode = (request.getQuizType() == QuizType.FILL_IN || request.getQuizType() == QuizType.FILL_IN_BLANK);
            questions.add(QuizQuestionDto.builder()
                    .flashcardId(fc.getId())
                    .quizType(request.getQuizType())
                    .questionText(isFillMode ? fc.getBack() : fc.getFront())
                    .questionAudio(fc.getFront())
                    .reading(fc.getReading())
                    .correctAnswer(isFillMode ? fc.getFront() : fc.getBack())
                    .options(options)
                    .hint(fc.getExampleJa())
                    .build());
        }

        return QuizSessionResultDto.builder()
                .sessionId(session.getId())
                .deckId(deck.getId())
                .deckName(deck.getName())
                .quizType(session.getQuizType())
                .totalQuestions(count)
                .correctCount(0)
                .accuracyPercentage(0.0)
                .questions(questions)
                .startedAt(session.getStartedAt())
                .build();
    }

    @Transactional
    public boolean submitAnswer(Long userId, Long sessionId, AnswerQuizRequest request) {
        QuizSession session = quizSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phiên Quiz"));

        if (!session.getUser().getId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn không sở hữu phiên Quiz này");
        }

        Flashcard card = flashcardRepository.findById(request.getFlashcardId())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy flashcard"));

        boolean isCorrect;
        String userAns = request.getAnswer().trim().toLowerCase();

        if (session.getQuizType() == QuizType.FILL_IN || session.getQuizType() == QuizType.FILL_IN_BLANK) {
            String front = card.getFront().trim().toLowerCase();
            String reading = card.getReading() != null ? card.getReading().trim().toLowerCase() : "";
            String back = card.getBack().trim().toLowerCase();
            isCorrect = userAns.equalsIgnoreCase(front) || (!reading.isEmpty() && userAns.equalsIgnoreCase(reading)) || userAns.equalsIgnoreCase(back);
        } else {
            isCorrect = userAns.equalsIgnoreCase(card.getBack().trim().toLowerCase());
        }

        if (isCorrect) {
            session.setCorrectCount(session.getCorrectCount() + 1);
        } else {
            // Khi làm sai: đẩy thẻ vào lịch ôn sớm (rating 1 Again) theo tài liệu
            try {
                ReviewCardRequest revReq = new ReviewCardRequest();
                revReq.setFlashcardId(card.getId());
                revReq.setRating(1);
                srsService.processReview(userId, revReq);
            } catch (Exception e) {
                // non-blocking
            }
        }

        QuizAnswer answer = QuizAnswer.builder()
                .session(session)
                .flashcard(card)
                .userAnswer(request.getAnswer())
                .isCorrect(isCorrect)
                .answeredAt(Instant.now())
                .build();

        quizAnswerRepository.save(answer);
        quizSessionRepository.save(session);

        return isCorrect;
    }

    @Transactional
    public QuizSessionResultDto finishQuiz(Long userId, Long sessionId) {
        QuizSession session = quizSessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phiên Quiz"));

        if (!session.getUser().getId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn không sở hữu phiên Quiz này");
        }

        session.setFinishedAt(Instant.now());
        session = quizSessionRepository.save(session);

        if (progressService != null) {
            progressService.recordActivity(userId, "QUIZ", 1);
        }

        double acc = session.getTotalQuestions() > 0 ?
                Math.round(((double) session.getCorrectCount() / session.getTotalQuestions() * 100.0) * 10.0) / 10.0 : 0.0;

        return QuizSessionResultDto.builder()
                .sessionId(session.getId())
                .deckId(session.getDeck().getId())
                .deckName(session.getDeck().getName())
                .quizType(session.getQuizType())
                .totalQuestions(session.getTotalQuestions())
                .correctCount(session.getCorrectCount())
                .accuracyPercentage(acc)
                .startedAt(session.getStartedAt())
                .finishedAt(session.getFinishedAt())
                .build();
    }
}
