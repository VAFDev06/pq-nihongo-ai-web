package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vku.nihongoai.ai.AiCallLogRepository;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.flashcard.DeckRepository;
import vn.vku.nihongoai.shadowing.ShadowingLessonRepository;
import vn.vku.nihongoai.user.UserRepository;
import vn.vku.nihongoai.vocab.VocabularyRepository;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/stats")
@RequiredArgsConstructor
@Tag(name = "Admin Stats", description = "Thống kê tổng quan hệ thống dành cho ban quản trị")
public class AdminStatsController {

    private final UserRepository userRepository;
    private final VocabularyRepository vocabularyRepository;
    private final DeckRepository deckRepository;
    private final vn.vku.nihongoai.flashcard.FlashcardRepository flashcardRepository;
    private final ShadowingLessonRepository shadowingLessonRepository;
    private final vn.vku.nihongoai.shadowing.ShadowingAttemptRepository shadowingAttemptRepository;
    private final vn.vku.nihongoai.conversation.ConversationRepository conversationRepository;
    private final vn.vku.nihongoai.recognition.ImageRecognitionRepository imageRecognitionRepository;
    private final AiCallLogRepository aiCallLogRepository;
    private final vn.vku.nihongoai.shadowing.YouTubeVideoTranscriptRepository youTubeVideoTranscriptRepository;

    @GetMapping({"", "/overview"})
    @Operation(summary = "Lấy các số liệu thống kê tổng thể toàn hệ thống từ PostgreSQL")
    public ApiResponse<Map<String, Object>> getOverview() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByStatus(vn.vku.nihongoai.user.Status.ACTIVE);
        long totalVocab = vocabularyRepository.count();
        long totalDecks = deckRepository.count();
        long systemDecks = deckRepository.countByIsSystemTrue();
        long publishedSystemDecks = deckRepository.countByIsSystemTrueAndStatus(vn.vku.nihongoai.flashcard.DeckStatus.PUBLISHED);
        long draftSystemDecks = deckRepository.countByIsSystemTrueAndStatus(vn.vku.nihongoai.flashcard.DeckStatus.DRAFT);
        long archivedSystemDecks = deckRepository.countByIsSystemTrueAndStatus(vn.vku.nihongoai.flashcard.DeckStatus.ARCHIVED);
        long totalFlashcards = flashcardRepository.count();
        long totalLessons = shadowingLessonRepository.count();
        long totalShadowingAttempts = shadowingAttemptRepository.count();
        long totalConversations = conversationRepository.count();
        long totalRecognitions = imageRecognitionRepository.count();
        long totalAiCalls = aiCallLogRepository.count();
        long totalYoutubeVideos = youTubeVideoTranscriptRepository.count();

        java.time.ZoneId zone = java.time.ZoneId.of(vn.vku.nihongoai.common.Constants.TIME_ZONE_VN);
        java.time.Instant startOfDay = java.time.LocalDate.now(zone).atStartOfDay(zone).toInstant();
        long aiCallsToday = aiCallLogRepository.countCallsSince(startOfDay);
        long aiTokensToday = aiCallLogRepository.sumTokensSince(startOfDay);

        java.util.Map<String, Object> stats = new java.util.LinkedHashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("activeUsers", activeUsers);
        stats.put("totalSystemVocab", totalVocab);
        stats.put("totalDecks", totalDecks);
        stats.put("systemDecks", systemDecks);
        stats.put("publishedSystemDecks", publishedSystemDecks);
        stats.put("draftSystemDecks", draftSystemDecks);
        stats.put("archivedSystemDecks", archivedSystemDecks);
        stats.put("totalFlashcards", totalFlashcards);
        stats.put("totalShadowingLessons", totalLessons);
        stats.put("totalShadowingAttempts", totalShadowingAttempts);
        stats.put("totalYoutubeVideos", totalYoutubeVideos);
        stats.put("totalConversations", totalConversations);
        stats.put("totalRecognitions", totalRecognitions);
        stats.put("totalAiCalls", totalAiCalls);
        stats.put("aiCallsToday", aiCallsToday);
        stats.put("aiTokensToday", aiTokensToday);
        stats.put("aiStatus", "OPERATIONAL");

        return ApiResponse.ok(stats);
    }
}
