package vn.vku.nihongoai.flashcard;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class SrsServiceTest {

    private SrsService srsService;

    @BeforeEach
    void setUp() {
        srsService = new SrsService(null, null, null, null);
    }

    @Test
    @DisplayName("SRS 6 Level: Level 1 (Đang học) hẹn ôn lại sau đúng 4 giờ")
    void testLevel1FourHours() {
        Instant now = Instant.parse("2026-01-01T10:00:00Z");
        CardProgress p = CardProgress.builder()
                .srsLevel(0)
                .state(CardState.NEW)
                .easeFactor(new BigDecimal("2.50"))
                .intervalDays(0)
                .repetitions(0)
                .lapses(0)
                .reviewCount(0)
                .build();

        CardProgress updated = srsService.review(p, 1, now);

        assertEquals(1, updated.getSrsLevel());
        assertEquals(CardState.LEARNING, updated.getState());
        assertEquals(0, updated.getIntervalDays());
        assertEquals(1, updated.getReviewCount());
        assertEquals(now.plus(4, ChronoUnit.HOURS), updated.getDueAt());
    }

    @Test
    @DisplayName("SRS 6 Level: Level 2 (3 ngày), Level 3 (7 ngày), Level 4 (14 ngày)")
    void testLevels2To4Intervals() {
        Instant now = Instant.parse("2026-01-01T10:00:00Z");
        CardProgress p = CardProgress.builder().srsLevel(0).easeFactor(new BigDecimal("2.50")).build();

        srsService.review(p, 2, now);
        assertEquals(2, p.getSrsLevel());
        assertEquals(3, p.getIntervalDays());
        assertEquals(now.plus(3, ChronoUnit.DAYS), p.getDueAt());

        srsService.review(p, 3, now);
        assertEquals(3, p.getSrsLevel());
        assertEquals(7, p.getIntervalDays());
        assertEquals(now.plus(7, ChronoUnit.DAYS), p.getDueAt());

        srsService.review(p, 4, now);
        assertEquals(4, p.getSrsLevel());
        assertEquals(14, p.getIntervalDays());
        assertEquals(now.plus(14, ChronoUnit.DAYS), p.getDueAt());
    }

    @Test
    @DisplayName("SRS 6 Level: Nhảy thẳng Level 1 -> Level 5 (Đã thuộc vĩnh viễn, dueAt = null)")
    void testNonLinearJumpToLevel5() {
        Instant now = Instant.parse("2026-01-01T10:00:00Z");
        CardProgress p = CardProgress.builder()
                .srsLevel(1)
                .state(CardState.LEARNING)
                .dueAt(now)
                .reviewCount(1)
                .build();

        CardProgress updated = srsService.review(p, 5, now);

        assertEquals(5, updated.getSrsLevel());
        assertNull(updated.getDueAt());
        assertEquals(2, updated.getReviewCount());
    }

    @Test
    @DisplayName("SRS 6 Level: Học lại bộ thẻ cho phép hạ từ Level 5 xuống Level 2 và đặt lịch ôn 3 ngày")
    void testRelearnOverrideFromLevel5ToLevel2() {
        Instant now = Instant.parse("2026-01-01T10:00:00Z");
        CardProgress p = CardProgress.builder()
                .srsLevel(5)
                .state(CardState.REVIEW)
                .dueAt(null)
                .reviewCount(3)
                .build();

        CardProgress updated = srsService.review(p, 2, now);

        assertEquals(2, updated.getSrsLevel());
        assertEquals(3, updated.getIntervalDays());
        assertEquals(now.plus(3, ChronoUnit.DAYS), updated.getDueAt());
        assertEquals(4, updated.getReviewCount());
    }

    @Test
    @DisplayName("SRS 6 Level: Đánh giá ngoài khoảng 1..5 phải ném lỗi")
    void testInvalidLevelThrows() {
        CardProgress p = CardProgress.builder().srsLevel(0).build();
        assertThrows(IllegalArgumentException.class, () -> srsService.review(p, 0, Instant.now()));
        assertThrows(IllegalArgumentException.class, () -> srsService.review(p, 6, Instant.now()));
    }
}
