package vn.vku.nihongoai.shadowing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.vku.nihongoai.furigana.FuriganaService;
import vn.vku.nihongoai.shadowing.dto.WordDiffStatus;

import static org.junit.jupiter.api.Assertions.*;

class ShadowingScoringServiceTest {

    private ShadowingScoringService scoringService;

    @BeforeEach
    void setUp() {
        FuriganaService furiganaService = new FuriganaService();
        scoringService = new ShadowingScoringService(furiganaService);
    }

    @Test
    @DisplayName("Shadowing: Đọc đúng hoàn toàn 100% khi câu khớp đúng")
    void testExactMatch() {
        String target = "机の上に本があります。";
        String heard = "机の上に本があります";

        ShadowingScoringService.ScoreResult result = scoringService.score(target, heard);

        assertEquals(100.0, result.getAccuracy());
        assertFalse(result.getWordDiff().isEmpty());
        assertTrue(result.getWordDiff().stream().allMatch(d -> d.getStatus() == WordDiffStatus.CORRECT));
    }

    @Test
    @DisplayName("Shadowing: Phát hiện đúng từ nói sai và gán trường heard")
    void testWrongWordDetected() {
        String target = "私は学生です。";
        String heard = "私は先生です";

        ShadowingScoringService.ScoreResult result = scoringService.score(target, heard);

        assertTrue(result.getAccuracy() > 0.0 && result.getAccuracy() < 100.0);
        boolean hasWrong = result.getWordDiff().stream().anyMatch(d ->
                d.getStatus() == WordDiffStatus.WRONG && "先生".equals(d.getHeard()));
        assertTrue(hasWrong, "Cần phát hiện từ sai '先生' tương ứng với '学生'");
    }

    @Test
    @DisplayName("Shadowing: Phát hiện từ bị thiếu khi người học đọc sót")
    void testMissingWordDetected() {
        String target = "電車で会社に行きます。";
        String heard = "電車で会社に";

        ShadowingScoringService.ScoreResult result = scoringService.score(target, heard);

        assertTrue(result.getAccuracy() < 100.0);
        boolean hasMissing = result.getWordDiff().stream().anyMatch(d -> d.getStatus() == WordDiffStatus.MISSING);
        assertTrue(hasMissing, "Cần phát hiện các từ bị thiếu ở cuối câu");
    }

    @Test
    @DisplayName("Shadowing: Bỏ qua dấu câu và khoảng trắng tiếng Nhật")
    void testPunctuationIgnored() {
        String target = "こんにちは、元気ですか？";
        String heard = "こんにちは元気ですか";

        ShadowingScoringService.ScoreResult result = scoringService.score(target, heard);
        assertEquals(100.0, result.getAccuracy());
    }
}
