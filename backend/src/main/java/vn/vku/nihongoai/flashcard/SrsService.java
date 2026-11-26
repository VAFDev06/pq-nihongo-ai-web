package vn.vku.nihongoai.flashcard;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.Constants;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.dto.*;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Slf4j
public class SrsService {

    private final CardProgressRepository cardProgressRepository;
    private final FlashcardRepository flashcardRepository;
    private final ReviewLogRepository reviewLogRepository;
    private final UserService userService;
    private final vn.vku.nihongoai.progress.ProgressService progressService;

    public SrsService(
            CardProgressRepository cardProgressRepository,
            FlashcardRepository flashcardRepository,
            ReviewLogRepository reviewLogRepository,
            UserService userService
    ) {
        this(cardProgressRepository, flashcardRepository, reviewLogRepository, userService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SrsService(
            CardProgressRepository cardProgressRepository,
            FlashcardRepository flashcardRepository,
            ReviewLogRepository reviewLogRepository,
            UserService userService,
            @org.springframework.context.annotation.Lazy vn.vku.nihongoai.progress.ProgressService progressService
    ) {
        this.cardProgressRepository = cardProgressRepository;
        this.flashcardRepository = flashcardRepository;
        this.reviewLogRepository = reviewLogRepository;
        this.userService = userService;
        this.progressService = progressService;
    }

    public static final BigDecimal DEFAULT_EASE_FACTOR = new BigDecimal("2.50");

    /**
     * Thuật toán SRS 6 cấp độ chuẩn:
     * - Level 0: Từ mới (dueAt = null)
     * - Level 1: Đang học -> ôn lại sau 4 giờ
     * - Level 2: Đang ghi nhớ -> ôn lại sau 3 ngày
     * - Level 3: Ghi nhớ tốt -> ôn lại sau 7 ngày
     * - Level 4: Ghi nhớ rất tốt -> ôn lại sau 14 ngày
     * - Level 5: Đã thuộc -> vĩnh viễn (dueAt = null), không quay lại danh sách đến hạn
     *
     * Cho phép chọn thẳng bất kỳ cấp độ 1..5 (không ép tăng tuần tự) và ghi đè cấp độ khi học lại bộ thẻ.
     */
    public CardProgress applyLevel(CardProgress p, int targetLevel, Instant now) {
        if (targetLevel < 0 || targetLevel > 5) {
            throw new IllegalArgumentException("Cấp độ SRS phải nằm trong khoảng 0 đến 5");
        }

        int prevLevel = p.getSrsLevel() != null ? p.getSrsLevel() : 0;
        if (targetLevel >= 1) {
            int currentReviews = p.getReviewCount() != null ? p.getReviewCount() : 0;
            p.setReviewCount(currentReviews + 1);
            p.setLastReviewedAt(now);
        }

        if (prevLevel >= 2 && targetLevel == 1) {
            p.setLapses((p.getLapses() != null ? p.getLapses() : 0) + 1);
        }

        p.setSrsLevel(targetLevel);
        p.setUpdatedAt(now);

        switch (targetLevel) {
            case 0 -> {
                p.setState(CardState.NEW);
                p.setIntervalDays(0);
                p.setRepetitions(0);
                p.setDueAt(null);
            }
            case 1 -> {
                p.setState(CardState.LEARNING);
                p.setIntervalDays(0);
                p.setRepetitions(1);
                p.setDueAt(now.plus(4, ChronoUnit.HOURS));
            }
            case 2 -> {
                p.setState(CardState.REVIEW);
                p.setIntervalDays(3);
                p.setRepetitions(2);
                p.setDueAt(now.plus(3, ChronoUnit.DAYS));
            }
            case 3 -> {
                p.setState(CardState.REVIEW);
                p.setIntervalDays(7);
                p.setRepetitions(3);
                p.setDueAt(now.plus(7, ChronoUnit.DAYS));
            }
            case 4 -> {
                p.setState(CardState.REVIEW);
                p.setIntervalDays(14);
                p.setRepetitions(4);
                p.setDueAt(now.plus(14, ChronoUnit.DAYS));
            }
            case 5 -> {
                p.setState(CardState.REVIEW);
                p.setIntervalDays(9999);
                p.setRepetitions(5);
                p.setDueAt(null); // Vĩnh viễn - không còn đến hạn
            }
        }
        return p;
    }

    /** Giữ tương thích với các unit test gọi review(p, level, now) */
    public CardProgress review(CardProgress p, int targetLevel, Instant now) {
        if (targetLevel < 1 || targetLevel > 5) {
            throw new IllegalArgumentException("Đánh giá SRS phải từ Level 1 đến Level 5");
        }
        return applyLevel(p, targetLevel, now);
    }

    @Transactional
    public void ensureUserCardsSynced(Long userId, Long deckId) {
        List<Flashcard> missingCards = (deckId != null)
                ? flashcardRepository.findNewCardsByDeckForUser(userId, deckId)
                : flashcardRepository.findAllNewCardsInUserDecks(userId);
        if (missingCards.isEmpty()) {
            return;
        }
        User user = userService.getUserOrThrow(userId);
        Instant now = Instant.now();
        for (Flashcard fc : missingCards) {
            if (cardProgressRepository.findByUserIdAndFlashcardId(userId, fc.getId()).isEmpty()) {
                CardProgress cp = CardProgress.builder()
                        .user(user)
                        .flashcard(fc)
                        .state(CardState.NEW)
                        .srsLevel(0)
                        .easeFactor(DEFAULT_EASE_FACTOR)
                        .intervalDays(0)
                        .repetitions(0)
                        .lapses(0)
                        .reviewCount(0)
                        .dueAt(null) // Level 0: Từ mới, chưa có due_at
                        .updatedAt(now)
                        .build();
                cardProgressRepository.save(cp);
            }
        }
    }

    @Transactional
    public SrsStatsDto getStats(Long userId, Long deckId) {
        ensureUserCardsSynced(userId, deckId);
        Instant now = Instant.now();
        ZoneId zone = ZoneId.of(Constants.TIME_ZONE_VN);
        Instant startOfTodayVn = LocalDate.now(zone).atStartOfDay(zone).toInstant();

        long[] levelCounts = new long[6];
        List<Object[]> grouped = cardProgressRepository.countGroupByLevel(userId, deckId);
        for (Object[] row : grouped) {
            if (row[0] != null && row[1] != null) {
                int lvl = ((Number) row[0]).intValue();
                long cnt = ((Number) row[1]).longValue();
                if (lvl >= 0 && lvl <= 5) {
                    levelCounts[lvl] = cnt;
                }
            }
        }

        long totalSrsCards = levelCounts[0] + levelCounts[1] + levelCounts[2] + levelCounts[3] + levelCounts[4] + levelCounts[5];
        long rememberedCards = levelCounts[5]; // CHỈ Level 5
        long dueTodayCards = cardProgressRepository.countDueActiveSrsCards(userId, deckId, now); // CHỈ Level 1..4 & dueAt <= now
        long learningCards = levelCounts[1] + levelCounts[2] + levelCounts[3] + levelCounts[4];
        long reviewedTodayCards = reviewLogRepository.countDistinctCardsReviewedSince(userId, deckId, startOfTodayVn);
        long reviewsTodayCount = reviewLogRepository.countReviewsSince(userId, deckId, startOfTodayVn);

        return SrsStatsDto.builder()
                .deckId(deckId)
                .totalSrsCards(totalSrsCards)
                .rememberedCards(rememberedCards)
                .dueTodayCards(dueTodayCards)
                .level0Count(levelCounts[0])
                .level1Count(levelCounts[1])
                .level2Count(levelCounts[2])
                .level3Count(levelCounts[3])
                .level4Count(levelCounts[4])
                .level5Count(levelCounts[5])
                .newCards(levelCounts[0])
                .learningCards(learningCards)
                .reviewedTodayCards(reviewedTodayCards)
                .reviewsTodayCount(reviewsTodayCount)
                .relearningCards(levelCounts[1])
                .build();
    }

    @Transactional
    public SrsOverviewDto getOverview(Long userId, Long deckId, String filter) {
        ensureUserCardsSynced(userId, deckId);
        Instant now = Instant.now();
        SrsStatsDto stats = getStats(userId, deckId);

        List<CardProgress> allForScope = cardProgressRepository.findAllActiveForUser(userId, deckId, now);
        List<CardProgress> allForUser = (deckId == null)
                ? allForScope
                : cardProgressRepository.findAllActiveForUser(userId, null, now);

        // Gom danh sách các bộ thẻ đang có trong SRS
        Map<Long, SrsOverviewDto.DeckOptionDto> deckMap = new LinkedHashMap<>();
        for (CardProgress cp : allForUser) {
            Deck d = cp.getFlashcard().getDeck();
            SrsOverviewDto.DeckOptionDto opt = deckMap.computeIfAbsent(d.getId(), id ->
                    SrsOverviewDto.DeckOptionDto.builder()
                            .id(id)
                            .name(d.getName())
                            .totalCards(0)
                            .dueCards(0)
                            .level0Count(0)
                            .masteredCount(0)
                            .build()
            );
            int lvl = cp.getSrsLevel() != null ? cp.getSrsLevel() : 0;
            opt.setTotalCards(opt.getTotalCards() + 1);
            if (lvl == 0) opt.setLevel0Count(opt.getLevel0Count() + 1);
            if (lvl == 5) opt.setMasteredCount(opt.getMasteredCount() + 1);
            if (lvl >= 1 && lvl <= 4 && cp.getDueAt() != null && !cp.getDueAt().isAfter(now)) {
                opt.setDueCards(opt.getDueCards() + 1);
            }
        }

        String f = (filter != null && !filter.isBlank()) ? filter.trim().toUpperCase() : "ALL";
        List<SrsDueCardDto> filteredCards = allForScope.stream()
                .filter(cp -> {
                    int lvl = cp.getSrsLevel() != null ? cp.getSrsLevel() : 0;
                    boolean isDue = lvl >= 1 && lvl <= 4 && cp.getDueAt() != null && !cp.getDueAt().isAfter(now);
                    return switch (f) {
                        case "DUE" -> isDue;
                        case "0", "LVL0", "LEVEL_0" -> lvl == 0;
                        case "1", "LVL1", "LEVEL_1" -> lvl == 1;
                        case "2", "LVL2", "LEVEL_2" -> lvl == 2;
                        case "3", "LVL3", "LEVEL_3" -> lvl == 3;
                        case "4", "LVL4", "LEVEL_4" -> lvl == 4;
                        case "5", "LVL5", "LEVEL_5" -> lvl == 5;
                        default -> true;
                    };
                })
                .map(cp -> SrsDueCardDto.from(cp, now))
                .toList();

        return SrsOverviewDto.builder()
                .stats(stats)
                .decks(new ArrayList<>(deckMap.values()))
                .cards(filteredCards)
                .build();
    }

    @Transactional(readOnly = true)
    public List<ReviewLogDto> getReviewHistory(Long userId, Long deckId, Integer rating, String range, String q) {
        ZoneId zone = ZoneId.of(Constants.TIME_ZONE_VN);
        Instant since = null;
        if (range != null && !range.isBlank()) {
            since = switch (range.toLowerCase()) {
                case "today", "1d" -> LocalDate.now(zone).atStartOfDay(zone).toInstant();
                case "7d", "week" -> LocalDate.now(zone).minusDays(6).atStartOfDay(zone).toInstant();
                case "30d", "month" -> LocalDate.now(zone).minusDays(29).atStartOfDay(zone).toInstant();
                default -> null;
            };
        }
        String query = (q != null && !q.isBlank()) ? q.trim() : "";
        return reviewLogRepository.searchReviewHistory(userId, deckId, rating, since, query)
                .stream()
                .limit(200)
                .map(ReviewLogDto::from)
                .toList();
    }

    /**
     * Chế độ 1: Ôn thẻ đến hạn (DUE_REVIEW).
     * - Mặc định (includeNew = false): CHỈ trả về thẻ Level 1..4 đã đến hạn (dueAt <= now).
     * - Nếu includeNew = true (hoặc filter = DUE_AND_NEW): ưu tiên thẻ đến hạn trước, sau đó bổ sung thẻ Level 0 (Từ mới).
     * - Nếu filter = NEW: chỉ trả về thẻ Level 0.
     * - TUYỆT ĐỐI KHÔNG bao giờ trả về thẻ Level 5 hoặc thẻ Level 1..4 chưa đến hạn!
     */
    @Transactional
    public List<SrsDueCardDto> getDueCards(Long userId, Long deckId, Integer limit, boolean includeNew, String filter) {
        ensureUserCardsSynced(userId, deckId);
        int max = (limit != null && limit > 0) ? limit : 100;
        Instant now = Instant.now();

        List<SrsDueCardDto> result = new ArrayList<>();
        String f = (filter != null && !filter.isBlank()) ? filter.trim().toUpperCase() : "";

        if ("NEW".equals(f) || "0".equals(f)) {
            for (CardProgress cp : cardProgressRepository.findNewLevel0Cards(userId, deckId)) {
                if (result.size() >= max) break;
                result.add(SrsDueCardDto.from(cp, now));
            }
            return result;
        }

        List<CardProgress> dueList = cardProgressRepository.findDueCards(userId, deckId, now);
        for (CardProgress cp : dueList) {
            if (result.size() >= max) break;
            result.add(SrsDueCardDto.from(cp, now));
        }

        if ((includeNew || "DUE_AND_NEW".equals(f)) && result.size() < max) {
            List<CardProgress> newList = cardProgressRepository.findNewLevel0Cards(userId, deckId);
            for (CardProgress cp : newList) {
                if (result.size() >= max) break;
                result.add(SrsDueCardDto.from(cp, now));
            }
        }

        return result;
    }

    /**
     * Chế độ 2: Học lại bộ thẻ (SET_RELEARN).
     * - Trả về TOÀN BỘ thẻ trong bộ thẻ (kể cả thẻ đang ở Level 5 và thẻ chưa đến hạn).
     * - KHÔNG tạo trùng flashcard, KHÔNG tạo trùng card_progress.
     * - KHÔNG tự động hạ cấp Level 5 khi mới mở chế độ học lại; chỉ cập nhật khi user bấm đánh giá.
     */
    @Transactional
    public List<SrsDueCardDto> getRelearnDeckCards(Long userId, Long deckId) {
        ensureUserCardsSynced(userId, deckId);
        Instant now = Instant.now();
        return cardProgressRepository.findAllByUserAndDeckOrderByPosition(userId, deckId)
                .stream()
                .map(cp -> SrsDueCardDto.from(cp, now))
                .toList();
    }

    @Transactional
    public SrsDueCardDto processReview(Long userId, ReviewCardRequest request) {
        User user = userService.getUserOrThrow(userId);
        Flashcard flashcard = flashcardRepository.findById(request.getFlashcardId())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy flashcard"));

        Instant now = Instant.now();
        CardProgress progress = cardProgressRepository.findByUserIdAndFlashcardId(userId, flashcard.getId())
                .orElseGet(() -> CardProgress.builder()
                        .user(user)
                        .flashcard(flashcard)
                        .state(CardState.NEW)
                        .srsLevel(0)
                        .easeFactor(DEFAULT_EASE_FACTOR)
                        .intervalDays(0)
                        .repetitions(0)
                        .lapses(0)
                        .reviewCount(0)
                        .dueAt(null)
                        .updatedAt(now)
                        .build());

        int prevLevel = progress.getSrsLevel() != null ? progress.getSrsLevel() : 0;
        int prevInterval = progress.getIntervalDays() != null ? progress.getIntervalDays() : 0;
        Instant prevDueAt = progress.getDueAt();
        int targetLevel = request.getTargetLevel();

        String mode = (request.getReviewMode() != null && !request.getReviewMode().isBlank())
                ? request.getReviewMode().trim().toUpperCase()
                : "DUE_REVIEW";
        if (!mode.equals("DUE_REVIEW") && !mode.equals("SET_RELEARN") && !mode.equals("MANUAL_LEVEL")) {
            mode = "DUE_REVIEW";
        }

        progress = applyLevel(progress, targetLevel, now);
        progress = cardProgressRepository.save(progress);

        // Ghi thêm bản ghi lịch sử mới (không ghi đè, không xóa lịch sử cũ)
        ReviewLog logEntry = ReviewLog.builder()
                .user(user)
                .flashcard(flashcard)
                .rating(targetLevel)
                .previousLevel(prevLevel)
                .newLevel(targetLevel)
                .reviewMode(mode)
                .prevIntervalDays(prevInterval)
                .newIntervalDays(progress.getIntervalDays())
                .easeFactor(progress.getEaseFactor())
                .durationMs(request.getDurationMs())
                .prevDueAt(prevDueAt)
                .nextDueAt(progress.getDueAt())
                .build();
        reviewLogRepository.save(logEntry);

        if (progressService != null && !"MANUAL_LEVEL".equals(mode)) {
            progressService.recordActivity(userId, "CARD_REVIEWED", 1);
        }

        return SrsDueCardDto.from(progress, now);
    }

    @Transactional
    public SrsDueCardDto updateCardLevelManually(Long userId, Long flashcardId, int targetLevel) {
        if (targetLevel < 0 || targetLevel > 5) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Cấp độ SRS phải từ 0 đến 5");
        }
        User user = userService.getUserOrThrow(userId);
        Flashcard flashcard = flashcardRepository.findById(flashcardId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy flashcard"));

        Instant now = Instant.now();
        CardProgress progress = cardProgressRepository.findByUserIdAndFlashcardId(userId, flashcard.getId())
                .orElseGet(() -> CardProgress.builder()
                        .user(user)
                        .flashcard(flashcard)
                        .state(CardState.NEW)
                        .srsLevel(0)
                        .easeFactor(DEFAULT_EASE_FACTOR)
                        .intervalDays(0)
                        .repetitions(0)
                        .lapses(0)
                        .reviewCount(0)
                        .dueAt(null)
                        .updatedAt(now)
                        .build());

        int prevLevel = progress.getSrsLevel() != null ? progress.getSrsLevel() : 0;
        int prevInterval = progress.getIntervalDays() != null ? progress.getIntervalDays() : 0;
        Instant prevDueAt = progress.getDueAt();

        progress = applyLevel(progress, targetLevel, now);
        progress = cardProgressRepository.save(progress);

        ReviewLog logEntry = ReviewLog.builder()
                .user(user)
                .flashcard(flashcard)
                .rating(targetLevel)
                .previousLevel(prevLevel)
                .newLevel(targetLevel)
                .reviewMode("MANUAL_LEVEL")
                .prevIntervalDays(prevInterval)
                .newIntervalDays(progress.getIntervalDays())
                .easeFactor(progress.getEaseFactor())
                .prevDueAt(prevDueAt)
                .nextDueAt(progress.getDueAt())
                .build();
        reviewLogRepository.save(logEntry);

        return SrsDueCardDto.from(progress, now);
    }
}
