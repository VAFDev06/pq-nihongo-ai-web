package vn.vku.nihongoai.shadowing.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.progress.ProgressService;
import vn.vku.nihongoai.shadowing.ShadowingAttempt;
import vn.vku.nihongoai.shadowing.ShadowingAttemptRepository;
import vn.vku.nihongoai.shadowing.ShadowingDialogueLine;
import vn.vku.nihongoai.shadowing.ShadowingDialogueLineRepository;
import vn.vku.nihongoai.shadowing.ShadowingLesson;
import vn.vku.nihongoai.shadowing.ShadowingLessonRepository;
import vn.vku.nihongoai.shadowing.dto.ShadowingAiStatusDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingAttemptDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;

/**
 * Orchestrates local AI Shadowing evaluation (Spring Boot -> Private AI Model Server + Kuromoji).
 *
 * Strictly zero Gemini API calls and zero AiQuotaService deductions for Shadowing speech evaluation.
 * Raw learner audio is forwarded in memory to the private AI server and never stored permanently.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ShadowingAiService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".wav", ".webm", ".ogg", ".opus", ".mp3", ".m4a", ".mp4", ".flac", ".aac"
    );

    private final ShadowingAiServerClient aiClient;
    private final ShadowingAiProperties properties;
    private final ShadowingFeedbackService feedbackService;
    private final ShadowingLessonRepository lessonRepository;
    private final ShadowingDialogueLineRepository dialogueLineRepository;
    private final ShadowingAttemptRepository attemptRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    @Lazy
    private final ProgressService progressService;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    public ShadowingAiStatusDto getStatus() {
        return aiClient.checkHealth();
    }

    public ShadowingEvaluationResultDto evaluateAudioOnly(
            MultipartFile audioFile,
            String referenceText,
            MultipartFile referenceAudioFile,
            String jlptLevel,
            String fallbackTranscript
    ) {
        if (referenceText == null || referenceText.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng cung cấp câu tiếng Nhật mẫu (referenceText).");
        }
        byte[] audioBytes = readAndValidateAudio(audioFile, true);
        byte[] refBytes = (referenceAudioFile != null && !referenceAudioFile.isEmpty())
                ? readAndValidateAudio(referenceAudioFile, false)
                : null;

        return runEvaluationPipeline(
                audioBytes,
                audioFile.getOriginalFilename(),
                audioFile.getContentType(),
                referenceText.trim(),
                refBytes,
                referenceAudioFile != null ? referenceAudioFile.getOriginalFilename() : null,
                referenceAudioFile != null ? referenceAudioFile.getContentType() : null,
                jlptLevel,
                fallbackTranscript
        );
    }

    @Transactional
    public ShadowingAttemptDto evaluateLessonAttempt(
            Long userId,
            Long lessonId,
            MultipartFile audioFile,
            MultipartFile referenceAudioFile,
            Long lineId,
            String expectedTextJa,
            BigDecimal playbackSpeed,
            String fallbackTranscript
    ) {
        User user = userService.getUserOrThrow(userId);
        ShadowingLesson lesson = lessonRepository.findByIdAndIsActiveTrue(lessonId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài luyện Shadowing"));

        String expectedJa = lesson.getTextJa();
        String refAudioUrl = lesson.getAudioUrl();
        if (lineId != null) {
            ShadowingDialogueLine line = dialogueLineRepository.findById(lineId)
                    .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy câu hội thoại"));
            expectedJa = line.getJapaneseText();
            if (line.getAudioUrl() != null && !line.getAudioUrl().isBlank()) {
                refAudioUrl = line.getAudioUrl();
            }
        } else if (expectedTextJa != null && !expectedTextJa.isBlank()) {
            expectedJa = expectedTextJa.trim();
        }

        byte[] audioBytes = readAndValidateAudio(audioFile, true);
        LocalRefAudio localRef = resolveReferenceAudio(referenceAudioFile, refAudioUrl);

        String jlptLevel = lesson.getJlptLevel() != null
                ? lesson.getJlptLevel().name()
                : (user.getJlptLevel() != null ? user.getJlptLevel().name() : null);

        ShadowingEvaluationResultDto evaluation = runEvaluationPipeline(
                audioBytes,
                audioFile.getOriginalFilename(),
                audioFile.getContentType(),
                expectedJa,
                localRef != null ? localRef.bytes : null,
                localRef != null ? localRef.filename : null,
                localRef != null ? localRef.contentType : null,
                jlptLevel,
                fallbackTranscript
        );

        return persistAttempt(user, lesson, evaluation, playbackSpeed);
    }

    @Transactional
    public ShadowingAttemptDto evaluateCustomAttempt(
            Long userId,
            MultipartFile audioFile,
            String textJa,
            String textVi,
            MultipartFile referenceAudioFile,
            BigDecimal playbackSpeed,
            String jlptLevel,
            String fallbackTranscript
    ) {
        if (textJa == null || textJa.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng nhập câu tiếng Nhật cần luyện tập.");
        }
        User user = userService.getUserOrThrow(userId);
        String trimmedJa = textJa.trim();

        byte[] audioBytes = readAndValidateAudio(audioFile, true);
        LocalRefAudio localRef = resolveReferenceAudio(referenceAudioFile, null);

        String effectiveLevel = (jlptLevel != null && !jlptLevel.isBlank())
                ? jlptLevel.trim()
                : (user.getJlptLevel() != null ? user.getJlptLevel().name() : null);

        ShadowingEvaluationResultDto evaluation = runEvaluationPipeline(
                audioBytes,
                audioFile.getOriginalFilename(),
                audioFile.getContentType(),
                trimmedJa,
                localRef != null ? localRef.bytes : null,
                localRef != null ? localRef.filename : null,
                localRef != null ? localRef.contentType : null,
                effectiveLevel,
                fallbackTranscript
        );

        ShadowingLesson lesson = lessonRepository.findFirstByTextJa(trimmedJa)
                .orElseGet(() -> {
                    String title = (textVi != null && !textVi.isBlank())
                            ? textVi.trim()
                            : (trimmedJa.length() > 25 ? trimmedJa.substring(0, 25) + "..." : trimmedJa);
                    ShadowingLesson newLesson = ShadowingLesson.builder()
                            .title(title)
                            .textJa(trimmedJa)
                            .textVi(textVi != null ? textVi.trim() : "")
                            .jlptLevel(user.getJlptLevel() != null ? user.getJlptLevel() : JlptLevel.N5)
                            .status("ARCHIVED")
                            .isActive(false)
                            .isDialogue(false)
                            .build();
                    return lessonRepository.save(newLesson);
                });

        return persistAttempt(user, lesson, evaluation, playbackSpeed);
    }

    private ShadowingEvaluationResultDto runEvaluationPipeline(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText,
            byte[] refAudioBytes,
            String refFilename,
            String refContentType,
            String jlptLevel,
            String fallbackTranscript
    ) {
        try {
            ShadowingEvaluationResultDto raw = aiClient.evaluateShadowing(
                    audioBytes,
                    filename,
                    contentType,
                    referenceText,
                    refAudioBytes,
                    refFilename,
                    refContentType,
                    jlptLevel
            );
            return feedbackService.enrichWithKuromojiAndFeedback(raw, referenceText);
        } catch (AppException ex) {
            // Only degrade gracefully when the AI server itself is unavailable AND a browser fallback transcript exists.
            if (ex.getErrorCode() == ErrorCode.AI_UNAVAILABLE
                    && fallbackTranscript != null
                    && !fallbackTranscript.isBlank()) {
                log.warn("Shadowing AI server unavailable; degrading to Kuromoji-only evaluation with warning");
                return feedbackService.buildFallbackDegradedEvaluation(
                        referenceText,
                        fallbackTranscript,
                        "Máy chủ Local Shadowing AI hiện không khả dụng — chỉ hiển thị đối chiếu từ Kuromoji (không có điểm phát âm/ngữ điệu AI)."
                );
            }
            throw ex;
        }
    }

    private ShadowingAttemptDto persistAttempt(
            User user,
            ShadowingLesson lesson,
            ShadowingEvaluationResultDto evaluation,
            BigDecimal playbackSpeed
    ) {
        String wordDiffJson = "[]";
        String evaluationJson = null;
        try {
            wordDiffJson = objectMapper.writeValueAsString(evaluation.getWordDiff());
        } catch (Exception e) {
            log.warn("Failed to serialize shadowing word diff: {}", e.getMessage());
        }
        try {
            evaluationJson = objectMapper.writeValueAsString(evaluation);
        } catch (Exception e) {
            log.warn("Failed to serialize shadowing evaluation JSON: {}", e.getMessage());
        }

        // Preserve DB constraint accuracy NUMERIC(5,2) NOT NULL CHECK (0..100) without fabricating evaluation.scores.*
        double summaryAcc = 0.0;
        if (evaluation.getScores() != null && evaluation.getScores().getOverall() != null) {
            summaryAcc = evaluation.getScores().getOverall();
        } else if (evaluation.getScores() != null && evaluation.getScores().getKuromojiTokenAccuracy() != null) {
            summaryAcc = evaluation.getScores().getKuromojiTokenAccuracy();
        }
        summaryAcc = Math.min(100.0, Math.max(0.0, summaryAcc));

        String recognized = evaluation.getRecognizedText() != null ? evaluation.getRecognizedText().trim() : "";
        if (recognized.length() > 2000) {
            recognized = recognized.substring(0, 2000);
        }

        ShadowingAttempt attempt = ShadowingAttempt.builder()
                .user(user)
                .lesson(lesson)
                .recognizedText(recognized)
                .accuracy(BigDecimal.valueOf(summaryAcc).setScale(2, RoundingMode.HALF_UP))
                .wordDiff(wordDiffJson)
                .evaluationJson(evaluationJson)
                .playbackSpeed(playbackSpeed != null ? playbackSpeed : new BigDecimal("1.00"))
                .build();

        attempt = attemptRepository.save(attempt);
        if (progressService != null) {
            progressService.recordActivity(user.getId(), "SHADOWING", 1);
        }
        return ShadowingAttemptDto.from(attempt, objectMapper);
    }

    private byte[] readAndValidateAudio(MultipartFile file, boolean required) {
        if (file == null || file.isEmpty()) {
            if (required) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng gửi file ghi âm giọng nói.");
            }
            return null;
        }

        long maxBytes = Math.max(1L, properties.getMaxAudioMb()) * 1024L * 1024L;
        if (file.getSize() > maxBytes) {
            throw new AppException(
                    ErrorCode.FILE_TOO_LARGE,
                    "File âm thanh vượt quá giới hạn " + properties.getMaxAudioMb() + " MB."
            );
        }

        String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        String ct = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";

        boolean extOk = !name.contains(".") || ALLOWED_EXTENSIONS.stream().anyMatch(name::endsWith);
        boolean ctOk = ct.isBlank()
                || ct.startsWith("audio/")
                || ct.startsWith("video/webm")
                || ct.startsWith("video/mp4")
                || ct.equals("application/octet-stream");

        if (!extOk && !ctOk) {
            throw new AppException(
                    ErrorCode.UNSUPPORTED_FILE_TYPE,
                    "Định dạng file âm thanh không được hỗ trợ. Hãy sử dụng WAV, WebM, OGG, MP3 hoặc M4A."
            );
        }

        try {
            byte[] bytes = file.getBytes();
            if (bytes.length == 0) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "File ghi âm rỗng.");
            }
            return bytes;
        } catch (IOException e) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Không thể đọc dữ liệu file ghi âm.");
        }
    }

    private LocalRefAudio resolveReferenceAudio(MultipartFile uploadedRef, String storedAudioUrl) {
        if (uploadedRef != null && !uploadedRef.isEmpty()) {
            byte[] bytes = readAndValidateAudio(uploadedRef, false);
            if (bytes != null) {
                return new LocalRefAudio(bytes, uploadedRef.getOriginalFilename(), uploadedRef.getContentType());
            }
        }
        // Optional safe resolution of locally uploaded lesson/line reference audio under app.upload.dir
        if (storedAudioUrl != null && storedAudioUrl.startsWith("/uploads/")) {
            try {
                Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
                String relative = storedAudioUrl.substring("/uploads/".length());
                Path candidate = base.resolve(relative).normalize();
                if (candidate.startsWith(base) && Files.isRegularFile(candidate) && Files.size(candidate) <= 15L * 1024 * 1024) {
                    return new LocalRefAudio(
                            Files.readAllBytes(candidate),
                            candidate.getFileName().toString(),
                            Files.probeContentType(candidate)
                    );
                }
            } catch (Exception e) {
                log.debug("Could not load optional local reference audio {}: {}", storedAudioUrl, e.getMessage());
            }
        }
        return null;
    }

    private record LocalRefAudio(byte[] bytes, String filename, String contentType) {
    }
}
