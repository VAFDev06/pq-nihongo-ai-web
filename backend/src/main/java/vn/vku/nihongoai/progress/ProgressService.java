package vn.vku.nihongoai.progress;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.common.Constants;
import vn.vku.nihongoai.conversation.ConversationCorrectionRepository;
import vn.vku.nihongoai.conversation.ConversationRepository;
import vn.vku.nihongoai.conversation.CorrectionCategory;
import vn.vku.nihongoai.conversation.dto.WeakPointDto;
import vn.vku.nihongoai.flashcard.CardProgress;
import vn.vku.nihongoai.flashcard.CardProgressRepository;
import vn.vku.nihongoai.progress.dto.DailyStatChartDto;
import vn.vku.nihongoai.progress.dto.DashboardProgressDto;
import vn.vku.nihongoai.progress.dto.WeakItemsSummaryDto;
import vn.vku.nihongoai.recognition.ImageRecognitionRepository;
import vn.vku.nihongoai.shadowing.ShadowingAttempt;
import vn.vku.nihongoai.shadowing.ShadowingAttemptRepository;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;
import vn.vku.nihongoai.vocab.UserVocabularyRepository;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ProgressService {

    private final UserDailyStatRepository dailyStatRepository;
    private final UserVocabularyRepository userVocabularyRepository;
    private final CardProgressRepository cardProgressRepository;
    private final vn.vku.nihongoai.flashcard.FlashcardRepository flashcardRepository;
    private final vn.vku.nihongoai.flashcard.SrsService srsService;
    private final ShadowingAttemptRepository shadowingAttemptRepository;
    private final ConversationRepository conversationRepository;
    private final ImageRecognitionRepository imageRecognitionRepository;
    private final ConversationCorrectionRepository correctionRepository;
    private final UserService userService;

    @Transactional
    public void recordActivity(Long userId, String type, int delta) {
        if (delta <= 0) return;
        User user = userService.getUserOrThrow(userId);
        ZoneId zone = ZoneId.of(Constants.TIME_ZONE_VN);
        LocalDate today = LocalDate.now(zone);

        UserDailyStat stat = dailyStatRepository.findByUserIdAndStatDate(userId, today)
                .orElseGet(() -> UserDailyStat.builder()
                        .user(user)
                        .statDate(today)
                        .wordsAdded(0)
                        .cardsReviewed(0)
                        .quizCount(0)
                        .shadowingCount(0)
                        .conversationCount(0)
                        .recognitionCount(0)
                        .studyMinutes(0)
                        .build());

        switch (type) {
            case "WORD_ADDED" -> {
                stat.setWordsAdded(stat.getWordsAdded() + delta);
                stat.setStudyMinutes(stat.getStudyMinutes() + delta);
            }
            case "CARD_REVIEWED" -> {
                stat.setCardsReviewed(stat.getCardsReviewed() + delta);
                stat.setStudyMinutes(stat.getStudyMinutes() + 1);
            }
            case "QUIZ" -> {
                stat.setQuizCount(stat.getQuizCount() + delta);
                stat.setStudyMinutes(stat.getStudyMinutes() + 3);
            }
            case "SHADOWING" -> {
                stat.setShadowingCount(stat.getShadowingCount() + delta);
                stat.setStudyMinutes(stat.getStudyMinutes() + 2);
            }
            case "CONVERSATION" -> {
                stat.setConversationCount(stat.getConversationCount() + delta);
                stat.setStudyMinutes(stat.getStudyMinutes() + 5);
            }
            case "RECOGNITION" -> {
                stat.setRecognitionCount(stat.getRecognitionCount() + delta);
                stat.setStudyMinutes(stat.getStudyMinutes() + 2);
            }
        }
        dailyStatRepository.save(stat);
    }

    @Transactional
    public DashboardProgressDto getDashboard(Long userId) {
        User user = userService.getUserOrThrow(userId);

        long totalSaved = userVocabularyRepository.countByUserId(userId);
        long mastered = userVocabularyRepository.countByUserIdAndIsMastered(userId, true);

        // Lấy chỉ số SRS từ cùng một nguồn dữ liệu duy nhất với màn hình SRS
        vn.vku.nihongoai.flashcard.dto.SrsStatsDto srsStats = srsService.getStats(userId, null);
        long dueCards = srsStats.getDueTodayCards();
        int completedToday = (int) srsStats.getReviewedTodayCards();
        int goal = user.getDailyGoalCards() != null ? user.getDailyGoalCards() : 20;

        double progressPct = Math.min(100.0, Math.round(((double) completedToday / Math.max(1, goal) * 100.0) * 10.0) / 10.0);
        Double avgShadowing = shadowingAttemptRepository.findAverageAccuracyByUserId(userId);
        double avgShadowingAcc = avgShadowing != null ? Math.round(avgShadowing * 10.0) / 10.0 : 0.0;

        long totalConvs = conversationRepository.findByUserIdOrderByStartedAtDesc(userId, org.springframework.data.domain.Pageable.unpaged()).getTotalElements();
        long totalRecogs = imageRecognitionRepository.findByUserIdOrderByCreatedAtDesc(userId, org.springframework.data.domain.Pageable.unpaged()).getTotalElements();

        return DashboardProgressDto.builder()
                .totalSavedWords(totalSaved)
                .masteredWords(mastered)
                .totalSrsCards(srsStats.getTotalSrsCards())
                .dueCardsToday(dueCards)
                .newSrsCards(srsStats.getNewCards())
                .reviewedTodayCards(srsStats.getReviewedTodayCards())
                .reviewsTodayCount(srsStats.getReviewsTodayCount())
                .rememberedSrsCards(srsStats.getRememberedCards())
                .relearningSrsCards(srsStats.getRelearningCards())
                .dailyGoalCards(goal)
                .completedCardsToday(completedToday)
                .dailyGoalProgressPercentage(progressPct)
                .averageShadowingAccuracy(avgShadowingAcc)
                .totalConversations((int) totalConvs)
                .totalRecognitions((int) totalRecogs)
                .build();
    }

    @Transactional(readOnly = true)
    public List<DailyStatChartDto> getChart(Long userId, String range) {
        int days = switch (range != null ? range.toLowerCase() : "7d") {
            case "30d" -> 30;
            case "90d" -> 90;
            default -> 7;
        };

        ZoneId zone = ZoneId.of(Constants.TIME_ZONE_VN);
        LocalDate today = LocalDate.now(zone);
        LocalDate startDate = today.minusDays(days - 1);

        List<UserDailyStat> existingStats = dailyStatRepository.findStatsFromDate(userId, startDate);
        Map<LocalDate, UserDailyStat> statMap = new HashMap<>();
        for (UserDailyStat s : existingStats) {
            statMap.put(s.getStatDate(), s);
        }

        List<DailyStatChartDto> result = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate d = startDate.plusDays(i);
            UserDailyStat s = statMap.get(d);
            String dow = d.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.forLanguageTag("vi"));

            result.add(DailyStatChartDto.builder()
                    .date(d)
                    .dayOfWeek(dow)
                    .cardsReviewed(s != null ? s.getCardsReviewed() : 0)
                    .wordsAdded(s != null ? s.getWordsAdded() : 0)
                    .shadowingCount(s != null ? s.getShadowingCount() : 0)
                    .conversationCount(s != null ? s.getConversationCount() : 0)
                    .studyMinutes(s != null ? s.getStudyMinutes() : 0)
                    .build());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public WeakItemsSummaryDto getWeakItems(Long userId) {
        // 1. Thẻ hay sai (lapses cao)
        List<CardProgress> weakProgress = cardProgressRepository.findWeakCards(userId);
        List<String> weakCards = weakProgress.stream()
                .limit(5)
                .map(cp -> cp.getFlashcard().getFront() + " (" + cp.getFlashcard().getBack() + ")")
                .toList();

        // 2. Bài Shadowing điểm thấp
        List<ShadowingAttempt> weakAttempts = shadowingAttemptRepository.findWeakAttempts(userId);
        List<String> weakLessons = weakAttempts.stream()
                .map(sa -> sa.getLesson().getTitle() + " (" + sa.getAccuracy() + "%)")
                .distinct()
                .limit(5)
                .toList();

        // 3. Lỗi ngữ pháp lặp lại
        List<Object[]> rows = correctionRepository.countErrorsByCategory(userId);
        List<WeakPointDto> weakGrammar = new ArrayList<>();
        for (Object[] row : rows) {
            CorrectionCategory cat = (CorrectionCategory) row[0];
            long count = ((Number) row[1]).longValue();
            String desc = switch (cat) {
                case GRAMMAR -> "Lỗi cấu trúc ngữ pháp và chia động từ";
                case PARTICLE -> "Lỗi dùng sai trợ từ (は, が, を, に, で)";
                case VOCAB -> "Lỗi chọn từ vựng chưa phù hợp ngữ cảnh";
                case POLITENESS -> "Lỗi sắc thái lịch sự hoặc thể giao tiếp";
                default -> "Các lỗi diễn đạt khác";
            };
            weakGrammar.add(WeakPointDto.builder()
                    .category(cat)
                    .count(count)
                    .descriptionVi(desc)
                    .build());
        }

        return WeakItemsSummaryDto.builder()
                .weakCards(weakCards)
                .weakShadowingLessons(weakLessons)
                .weakGrammar(weakGrammar)
                .build();
    }
}
