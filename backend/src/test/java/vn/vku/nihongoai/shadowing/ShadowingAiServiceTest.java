package vn.vku.nihongoai.shadowing;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.furigana.FuriganaService;
import vn.vku.nihongoai.progress.ProgressService;
import vn.vku.nihongoai.shadowing.ai.ShadowingAiProperties;
import vn.vku.nihongoai.shadowing.ai.ShadowingAiServerClient;
import vn.vku.nihongoai.shadowing.ai.ShadowingAiService;
import vn.vku.nihongoai.shadowing.ai.ShadowingFeedbackService;
import vn.vku.nihongoai.shadowing.dto.ShadowingAttemptDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ShadowingAiServiceTest {

    private ShadowingAiServerClient aiClient;
    private ShadowingAiProperties properties;
    private ShadowingFeedbackService feedbackService;
    private ShadowingLessonRepository lessonRepository;
    private ShadowingDialogueLineRepository dialogueLineRepository;
    private ShadowingAttemptRepository attemptRepository;
    private UserService userService;
    private ProgressService progressService;
    private ObjectMapper objectMapper;
    private ShadowingAiService aiService;

    @BeforeEach
    void setUp() {
        aiClient = mock(ShadowingAiServerClient.class);
        properties = new ShadowingAiProperties();
        properties.setEnabled(true);
        properties.setMaxAudioMb(15);

        FuriganaService furiganaService = new FuriganaService();
        ShadowingScoringService scoringService = new ShadowingScoringService(furiganaService);
        feedbackService = new ShadowingFeedbackService(furiganaService, scoringService);

        lessonRepository = mock(ShadowingLessonRepository.class);
        dialogueLineRepository = mock(ShadowingDialogueLineRepository.class);
        attemptRepository = mock(ShadowingAttemptRepository.class);
        userService = mock(UserService.class);
        progressService = mock(ProgressService.class);
        objectMapper = new ObjectMapper();

        aiService = new ShadowingAiService(
                aiClient,
                properties,
                feedbackService,
                lessonRepository,
                dialogueLineRepository,
                attemptRepository,
                userService,
                objectMapper,
                progressService
        );
    }

    @Test
    void evaluateLessonAttempt_combinesLocalAiWithKuromojiAndPersistsEvaluationJson() {
        User user = User.builder().id(10L).email("learner@test.local").jlptLevel(JlptLevel.N5).build();
        ShadowingLesson lesson = ShadowingLesson.builder()
                .id(5L)
                .title("Giới thiệu")
                .textJa("私は毎日日本語を勉強します。")
                .jlptLevel(JlptLevel.N5)
                .isActive(true)
                .build();

        when(userService.getUserOrThrow(10L)).thenReturn(user);
        when(lessonRepository.findByIdAndIsActiveTrue(5L)).thenReturn(Optional.of(lesson));
        when(attemptRepository.save(any(ShadowingAttempt.class))).thenAnswer(inv -> {
            ShadowingAttempt a = inv.getArgument(0);
            a.setId(99L);
            return a;
        });

        ShadowingEvaluationResultDto mockEval = ShadowingEvaluationResultDto.builder()
                .referenceText("私は毎日日本語を勉強します。")
                .recognizedText("私は毎日日本語勉強します。")
                .status("COMPLETED")
                .scores(ShadowingEvaluationResultDto.ScoreBreakdown.builder()
                        .overall(86.5)
                        .accuracy(91.0)
                        .completeness(90.0)
                        .pitchAccent(80.0)
                        .intonation(84.0)
                        .timing(92.0)
                        .build())
                .confidence(0.88)
                .build();

        when(aiClient.evaluateShadowing(any(), any(), any(), eq("私は毎日日本語を勉強します。"), isNull(), isNull(), isNull(), eq("N5")))
                .thenReturn(mockEval);

        MockMultipartFile audio = new MockMultipartFile("audio", "rec.webm", "audio/webm", new byte[]{1, 2, 3, 4});
        ShadowingAttemptDto dto = aiService.evaluateLessonAttempt(
                10L, 5L, audio, null, null, null, new BigDecimal("1.00"), null
        );

        assertNotNull(dto);
        assertEquals(99L, dto.getId());
        assertEquals("私は毎日日本語勉強します。", dto.getRecognizedText());
        assertEquals(new BigDecimal("86.50"), dto.getAccuracy());
        assertNotNull(dto.getEvaluation());
        assertNotNull(dto.getEvaluation().getReferenceReading());
        assertFalse(dto.getEvaluation().getKuromojiTokens().isEmpty());
        assertFalse(dto.getWordDiff().isEmpty());
        assertTrue(dto.getWordDiff().stream().anyMatch(w -> "を".equals(w.getText()) && w.getStatus().name().equals("MISSING")));
        assertNotNull(dto.getEvaluation().getFeedback().getSummary());

        ArgumentCaptor<ShadowingAttempt> savedCaptor = ArgumentCaptor.forClass(ShadowingAttempt.class);
        verify(attemptRepository).save(savedCaptor.capture());
        assertNotNull(savedCaptor.getValue().getEvaluationJson());
        verify(progressService).recordActivity(10L, "SHADOWING", 1);
    }

    @Test
    void evaluateAudioOnly_rejectsEmptyOrUnsupportedFile() {
        MockMultipartFile empty = new MockMultipartFile("audio", "empty.wav", "audio/wav", new byte[0]);
        AppException exEmpty = assertThrows(AppException.class,
                () -> aiService.evaluateAudioOnly(empty, "こんにちは。", null, "N5", null));
        assertEquals(ErrorCode.VALIDATION_ERROR, exEmpty.getErrorCode());

        MockMultipartFile pdf = new MockMultipartFile("audio", "doc.pdf", "application/pdf", new byte[]{1, 2, 3});
        AppException exPdf = assertThrows(AppException.class,
                () -> aiService.evaluateAudioOnly(pdf, "こんにちは。", null, "N5", null));
        assertEquals(ErrorCode.UNSUPPORTED_FILE_TYPE, exPdf.getErrorCode());
    }

    @Test
    void evaluateAudioOnly_degradesGracefullyWithoutFabricatingScoresWhenAiUnavailableAndFallbackProvided() {
        when(aiClient.evaluateShadowing(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new AppException(ErrorCode.AI_UNAVAILABLE, "AI server down"));

        MockMultipartFile audio = new MockMultipartFile("audio", "rec.webm", "audio/webm", new byte[]{1, 2, 3, 4});
        ShadowingEvaluationResultDto res = aiService.evaluateAudioOnly(
                audio, "東京に行きます。", null, "N5", "東京に行きます"
        );

        assertEquals("PARTIAL", res.getStatus());
        assertNull(res.getScores().getOverall(), "Must never fabricate acoustic overall score when AI server is down");
        assertNull(res.getScores().getPitchAccent(), "Must never fabricate pitch accent score when AI server is down");
        assertNull(res.getScores().getIntonation(), "Must never fabricate intonation score when AI server is down");
        assertEquals(100.0, res.getScores().getKuromojiTokenAccuracy());
        assertFalse(res.getWarnings().isEmpty());
    }

    @Test
    void shadowingAttemptDto_backwardCompatibleWhenEvaluationJsonIsNull() {
        ShadowingLesson lesson = ShadowingLesson.builder().id(1L).title("Legacy Lesson").build();
        ShadowingAttempt legacy = ShadowingAttempt.builder()
                .id(7L)
                .lesson(lesson)
                .recognizedText("こんにちは")
                .accuracy(new BigDecimal("95.00"))
                .wordDiff("[]")
                .evaluationJson(null)
                .build();

        ShadowingAttemptDto dto = ShadowingAttemptDto.from(legacy, objectMapper);
        assertEquals(7L, dto.getId());
        assertEquals(new BigDecimal("95.00"), dto.getAccuracy());
        assertNull(dto.getEvaluation());
        assertEquals(List.of(), dto.getWordDiff());
    }

    @Test
    void evaluationDto_deserializesPythonServerPayloadWithSpecialMoraCleanly() throws Exception {
        String pythonJson = """
                {
                  "referenceText": "東京に行きます。",
                  "recognizedText": "東京に行きます。",
                  "status": "COMPLETED",
                  "scores": {"overall": 95.0, "accuracy": 100.0, "completeness": 100.0, "pitchAccent": 80.0, "intonation": 91.5, "timing": 100.0},
                  "pronunciation": {
                    "available": true,
                    "engine": "hatsuon",
                    "moraResults": [
                      {"kana": "ー", "wordSurface": "東京", "phonemes": ["o"], "score": 100.0, "status": "correct", "durationStatus": "ok", "isSpecialMora": true, "specialMoraType": "LONG_VOWEL"}
                    ],
                    "wordResults": [],
                    "errors": [],
                    "insertions": []
                  },
                  "intonation": {"experimental": true, "f0Available": true, "reliability": "MEDIUM", "score": 91.5, "pitchContour": [], "pauseAnalysis": [], "feedback": []},
                  "alignment": {"available": true, "engine": "Qwen/Qwen3-ForcedAligner-0.6B", "segments": [{"unit": "東京", "startTime": 0.1, "endTime": 0.5, "duration": 0.4}]},
                  "asr": {"available": true, "engine": "Qwen/Qwen3-ASR-0.6B", "language": "ja", "recognizedText": "東京に行きます。"},
                  "feedback": {"source": "TEMPLATE", "summary": "Tốt", "explanations": [], "practiceSuggestions": [], "encouragement": "Cố lên"},
                  "warnings": [],
                  "confidence": 0.85
                }
                """;
        ShadowingEvaluationResultDto parsed = objectMapper.readValue(pythonJson, ShadowingEvaluationResultDto.class);
        assertEquals("COMPLETED", parsed.getStatus());
        assertEquals(1, parsed.getPronunciation().getMoraResults().size());
        assertTrue(parsed.getPronunciation().getMoraResults().get(0).isSpecialMora());
        assertEquals("LONG_VOWEL", parsed.getPronunciation().getMoraResults().get(0).getSpecialMoraType());
        assertEquals(1, parsed.getAlignment().getSegments().size());
    }
}
