package vn.vku.nihongoai.shadowing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.ai.AiQuotaService;
import vn.vku.nihongoai.ai.GeminiClient;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.shadowing.dto.ShadowingAttemptDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingDialogueLineDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingLessonDto;
import vn.vku.nihongoai.shadowing.dto.SubmitShadowingAttemptRequest;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShadowingService {

    private final ShadowingLessonRepository lessonRepository;
    private final ShadowingDialogueLineRepository dialogueLineRepository;
    private final ShadowingAttemptRepository attemptRepository;
    private final ShadowingScoringService scoringService;
    private final vn.vku.nihongoai.furigana.FuriganaService furiganaService;
    private final YouTubeTranscriptService youTubeTranscriptService;
    private final GeminiClient geminiClient;
    private final AiQuotaService aiQuotaService;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    @org.springframework.context.annotation.Lazy
    private final vn.vku.nihongoai.progress.ProgressService progressService;

    @Transactional(readOnly = true)
    public Page<ShadowingLessonDto> searchLessons(JlptLevel level, Long topicId, String q, Long userId, Pageable pageable) {
        String query = (q != null && !q.isBlank()) ? q.trim() : "";
        Page<ShadowingLesson> page = lessonRepository.searchLessons(level, topicId, query, pageable);
        return page.map(l -> {
            BigDecimal best = attemptRepository.findMaxAccuracyByUserAndLesson(userId, l.getId());
            int lineCount = (int) dialogueLineRepository.countByLessonId(l.getId());
            return ShadowingLessonDto.from(l, best, null, lineCount);
        });
    }

    @Transactional(readOnly = true)
    public ShadowingLessonDto getLessonDetail(Long lessonId, Long userId) {
        ShadowingLesson lesson = lessonRepository.findByIdAndIsActiveTrue(lessonId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài luyện Shadowing"));
        if (!"PUBLISHED".equalsIgnoreCase(lesson.getStatus())) {
            throw new AppException(ErrorCode.NOT_FOUND, "Bài luyện Shadowing này chưa được xuất bản");
        }
        BigDecimal best = attemptRepository.findMaxAccuracyByUserAndLesson(userId, lesson.getId());
        List<ShadowingDialogueLineDto> lines = getLessonLinesWithHiragana(lesson);
        return ShadowingLessonDto.from(lesson, best, lines, lines.size());
    }

    public List<ShadowingDialogueLineDto> getLessonLinesWithHiragana(ShadowingLesson lesson) {
        List<ShadowingDialogueLine> rawLines = dialogueLineRepository.findByLessonIdOrderByLineOrderAscIdAsc(lesson.getId());
        if (rawLines.isEmpty()) {
            String hira = furiganaService.toFullHiragana(lesson.getTextJa());
            return List.of(ShadowingDialogueLineDto.builder()
                    .id(null)
                    .lineOrder(1)
                    .speaker("A")
                    .japaneseText(lesson.getTextJa())
                    .hiraganaText(hira)
                    .vietnameseTranslation(lesson.getTextVi())
                    .audioUrl(lesson.getAudioUrl())
                    .build());
        }
        return rawLines.stream().map(line -> {
            ShadowingDialogueLineDto dto = ShadowingDialogueLineDto.from(line);
            if (dto.getHiraganaText() == null || dto.getHiraganaText().isBlank()) {
                dto.setHiraganaText(furiganaService.toFullHiragana(line.getJapaneseText()));
            }
            return dto;
        }).toList();
    }

    /**
     * Dịch toàn bộ nhiều câu tiếng Nhật trong Shadowing tự nhập (không bỏ sót câu từ câu thứ 2 trở đi).
     */
    public Map<String, Object> translateCustomSentences(Long userId, String rawText) {
        if (rawText == null || rawText.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng nhập ít nhất một câu tiếng Nhật để dịch");
        }

        List<String> sentences = splitJapaneseSentences(rawText);
        if (sentences.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Không tìm thấy câu tiếng Nhật hợp lệ để dịch");
        }

        User user = userId != null ? userService.getUserOrThrow(userId) : null;
        if (user != null) {
            aiQuotaService.checkQuota(userId);
        }

        Map<Integer, String> translations = translateSentencesBatch(user, sentences);

        // Nếu AI bỏ sót bất kỳ câu nào -> gọi dịch bù đúng những câu bị thiếu
        List<Integer> missingIndices = new ArrayList<>();
        for (int i = 0; i < sentences.size(); i++) {
            int order = i + 1;
            String vi = translations.get(order);
            if (vi == null || vi.isBlank()) {
                missingIndices.add(order);
            }
        }
        if (!missingIndices.isEmpty()) {
            List<String> retrySentences = missingIndices.stream().map(ord -> sentences.get(ord - 1)).toList();
            Map<Integer, String> retryMap = translateSentencesBatch(user, retrySentences);
            for (int k = 0; k < missingIndices.size(); k++) {
                int originalOrder = missingIndices.get(k);
                String translated = retryMap.get(k + 1);
                if (translated != null && !translated.isBlank()) {
                    translations.put(originalOrder, translated);
                }
            }
        }

        List<Map<String, Object>> resultItems = new ArrayList<>();
        List<String> allVietnamese = new ArrayList<>();
        for (int i = 0; i < sentences.size(); i++) {
            int order = i + 1;
            String ja = sentences.get(i);
            String hira = furiganaService.toFullHiragana(ja);
            String vi = translations.getOrDefault(order, "").trim();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("order", order);
            item.put("japanese", ja);
            item.put("hiragana", hira);
            item.put("vietnamese", vi);
            resultItems.add(item);
            if (!vi.isEmpty()) {
                allVietnamese.add(vi);
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("sentenceCount", resultItems.size());
        response.put("sentences", resultItems);
        response.put("fullJapanese", String.join("\n", sentences));
        response.put("fullVietnamese", String.join(" ", allVietnamese));
        return response;
    }

    /**
     * Tách toàn bộ đoạn tiếng Nhật thành danh sách câu theo xuống dòng và dấu kết thúc câu (。, ！, ？, !, ?).
     * Giữ nguyên thứ tự và dấu câu cuối mỗi câu.
     */
    public List<String> splitJapaneseSentences(String rawText) {
        String normalized = rawText.replace("\r\n", "\n").replace("\r", "\n").trim();
        if (normalized.isEmpty()) return List.of();

        List<String> result = new ArrayList<>();
        String[] lines = normalized.split("\n+");
        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;

            StringBuilder current = new StringBuilder();
            for (int i = 0; i < line.length(); i++) {
                char c = line.charAt(i);
                current.append(c);
                if (c == '。' || c == '！' || c == '？' || c == '!' || c == '?') {
                    // Nếu ký tự kế tiếp là dấu đóng ngoặc Nhật hoặc dấu chấm câu nối tiếp thì gộp chung
                    while (i + 1 < line.length()) {
                        char next = line.charAt(i + 1);
                        if (next == '」' || next == '』' || next == '）' || next == ')' || next == '！' || next == '？' || next == '!' || next == '?') {
                            current.append(next);
                            i++;
                        } else {
                            break;
                        }
                    }
                    String s = current.toString().trim();
                    if (!s.isEmpty()) {
                        result.add(s);
                    }
                    current.setLength(0);
                }
            }
            String remaining = current.toString().trim();
            if (!remaining.isEmpty()) {
                result.add(remaining);
            }
        }
        return result;
    }

    private Map<Integer, String> translateSentencesBatch(User user, List<String> sentences) {
        List<Map<String, Object>> payload = new ArrayList<>();
        for (int i = 0; i < sentences.size(); i++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("order", i + 1);
            item.put("japanese", sentences.get(i));
            payload.add(item);
        }

        String systemPrompt = """
                Bạn là chuyên gia dịch thuật Nhật - Việt tự nhiên cho ứng dụng học tiếng Nhật PQ Nihongo.
                Người dùng gửi một danh sách gồm N câu tiếng Nhật được đánh số thứ tự `order` từ 1 đến N.
                QUY TẮC BẮT BUỘC:
                1. Phải dịch ĐẦY ĐỦ TẤT CẢ mọi câu từ order 1 đến order N. Tuyệt đối KHÔNG dừng ở câu đầu tiên và KHÔNG bỏ sót bất kỳ câu nào.
                2. Giữ đúng ngữ cảnh mạch lạc giữa các câu liên tiếp, dịch tự nhiên theo văn phong tiếng Việt, không thêm nội dung ngoài câu gốc.
                3. Trả về JSON hợp lệ theo đúng cấu trúc:
                   {"translations": [{"order": 1, "vietnamese": "..."}, {"order": 2, "vietnamese": "..."}]}
                """;

        String userJson;
        try {
            userJson = objectMapper.writeValueAsString(Map.of("sentences", payload));
        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi chuẩn bị dữ liệu dịch thuật");
        }

        JsonNode root = geminiClient.translateJapaneseBatch(user, systemPrompt, userJson);
        Map<Integer, String> map = new HashMap<>();

        JsonNode arr = root.has("translations") ? root.path("translations")
                : (root.has("sentences") ? root.path("sentences") : (root.isArray() ? root : null));

        if (arr != null && arr.isArray()) {
            int fallbackOrder = 1;
            for (JsonNode node : arr) {
                int ord = node.has("order") ? node.path("order").asInt(fallbackOrder) : fallbackOrder;
                String vi = node.path("vietnamese").asText(
                        node.path("translation").asText(
                                node.path("vi").asText("")
                        )
                ).trim();
                if (!vi.isEmpty() && ord >= 1 && ord <= sentences.size()) {
                    map.put(ord, vi);
                }
                fallbackOrder++;
            }
        }
        return map;
    }

    @Transactional
    public ShadowingAttemptDto submitAttempt(Long userId, Long lessonId, SubmitShadowingAttemptRequest request) {
        User user = userService.getUserOrThrow(userId);
        ShadowingLesson lesson = lessonRepository.findByIdAndIsActiveTrue(lessonId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài luyện Shadowing"));

        String expectedJa = lesson.getTextJa();
        if (request.getLineId() != null) {
            ShadowingDialogueLine line = dialogueLineRepository.findById(request.getLineId())
                    .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy câu hội thoại"));
            expectedJa = line.getJapaneseText();
        } else if (request.getExpectedTextJa() != null && !request.getExpectedTextJa().isBlank()) {
            expectedJa = request.getExpectedTextJa().trim();
        }

        ShadowingScoringService.ScoreResult scoreResult = scoringService.score(expectedJa, request.getRecognizedText());

        String wordDiffJson = "[]";
        try {
            wordDiffJson = objectMapper.writeValueAsString(scoreResult.getWordDiff());
        } catch (Exception e) {
            log.warn("Failed to serialize word diff: {}", e.getMessage());
        }

        ShadowingAttempt attempt = ShadowingAttempt.builder()
                .user(user)
                .lesson(lesson)
                .recognizedText(request.getRecognizedText().trim())
                .accuracy(BigDecimal.valueOf(scoreResult.getAccuracy()))
                .wordDiff(wordDiffJson)
                .playbackSpeed(request.getPlaybackSpeed())
                .build();

        attempt = attemptRepository.save(attempt);
        if (progressService != null) {
            progressService.recordActivity(userId, "SHADOWING", 1);
        }
        return ShadowingAttemptDto.from(attempt, objectMapper);
    }

    @Transactional
    public ShadowingAttemptDto scoreCustomSentence(Long userId, vn.vku.nihongoai.shadowing.dto.CustomShadowingRequest request) {
        User user = userService.getUserOrThrow(userId);

        ShadowingScoringService.ScoreResult scoreResult = scoringService.score(request.getTextJa(), request.getRecognizedText());

        String wordDiffJson = "[]";
        try {
            wordDiffJson = objectMapper.writeValueAsString(scoreResult.getWordDiff());
        } catch (Exception e) {
            log.warn("Failed to serialize word diff: {}", e.getMessage());
        }

        ShadowingLesson lesson = lessonRepository.findFirstByTextJa(request.getTextJa().trim())
                .orElseGet(() -> {
                    String title = (request.getTextVi() != null && !request.getTextVi().isBlank())
                            ? request.getTextVi().trim()
                            : (request.getTextJa().length() > 25 ? request.getTextJa().substring(0, 25) + "..." : request.getTextJa().trim());
                    ShadowingLesson newLesson = ShadowingLesson.builder()
                            .title(title)
                            .textJa(request.getTextJa().trim())
                            .textVi(request.getTextVi() != null ? request.getTextVi().trim() : "")
                            .jlptLevel(user.getJlptLevel() != null ? user.getJlptLevel() : JlptLevel.N5)
                            .status("ARCHIVED") // Không làm rác danh sách bài theo chủ đề PUBLISHED
                            .isActive(false)
                            .isDialogue(false)
                            .build();
                    return lessonRepository.save(newLesson);
                });

        ShadowingAttempt attempt = ShadowingAttempt.builder()
                .user(user)
                .lesson(lesson)
                .recognizedText(request.getRecognizedText().trim())
                .accuracy(BigDecimal.valueOf(scoreResult.getAccuracy()))
                .wordDiff(wordDiffJson)
                .playbackSpeed(request.getPlaybackSpeed())
                .build();

        attempt = attemptRepository.save(attempt);
        if (progressService != null) {
            progressService.recordActivity(userId, "SHADOWING", 1);
        }
        return ShadowingAttemptDto.from(attempt, objectMapper);
    }

    @Transactional(readOnly = true)
    public Page<ShadowingAttemptDto> getAttemptsHistory(Long userId, Long lessonId, Pageable pageable) {
        Page<ShadowingAttempt> page;
        if (lessonId != null) {
            page = attemptRepository.findByUserIdAndLessonIdOrderByCreatedAtDesc(userId, lessonId, pageable);
        } else {
            page = attemptRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        }
        return page.map(a -> ShadowingAttemptDto.from(a, objectMapper));
    }

    @Transactional(readOnly = true)
    public ShadowingAttemptDto getAttemptDetail(Long userId, Long attemptId) {
        ShadowingAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bản ghi luyện tập"));

        if (!attempt.getUser().getId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn không có quyền xem bản ghi này");
        }
        return ShadowingAttemptDto.from(attempt, objectMapper);
    }

    public Map<String, Object> fetchYoutubeCaptions(Long userId, String videoId) {
        User user = userId != null ? userService.getUserOrThrow(userId) : null;
        return youTubeTranscriptService.processVideoTranscript(user, videoId);
    }

    public Map<String, Object> translateYoutubePendingBatch(Long userId, String videoId, int batchSize) {
        User user = userId != null ? userService.getUserOrThrow(userId) : null;
        return youTubeTranscriptService.translatePendingBatch(user, videoId, batchSize);
    }

    public Map<String, Object> retranslateYoutubeSentence(Long userId, String videoId, Long sentenceId) {
        User user = userId != null ? userService.getUserOrThrow(userId) : null;
        return youTubeTranscriptService.retranslateSingleSentence(user, videoId, sentenceId);
    }

    public Map<String, Object> parseAndTranslateSubtitles(Long userId, String videoId, String content) {
        List<Map<String, Object>> parsed = parseSubtitles(content);
        User user = userId != null ? userService.getUserOrThrow(userId) : null;
        return youTubeTranscriptService.saveManualSubtitlesAndTranslate(user, videoId, parsed);
    }

    public List<Map<String, Object>> parseSubtitles(String content) {
        if (content == null || content.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Nội dung phụ đề không được để trống");
        }
        List<Map<String, Object>> segments = new ArrayList<>();
        String normalized = content.replace("\r\n", "\n").replace("\r", "\n").trim();

        if (normalized.contains("-->")) {
            String[] blocks = normalized.split("\n\\s*\n");
            int idx = 1;
            java.util.regex.Pattern timePattern = java.util.regex.Pattern.compile(
                    "(?:(\\d{1,2}):)?(\\d{2}):(\\d{2})[.,](\\d{1,3})\\s*-->\\s*(?:(\\d{1,2}):)?(\\d{2}):(\\d{2})[.,](\\d{1,3})"
            );
            for (String block : blocks) {
                String[] lines = block.trim().split("\n");
                double startSec = -1;
                double endSec = -1;
                StringBuilder textBuilder = new StringBuilder();

                for (String line : lines) {
                    String trimmedLine = line.trim();
                    if (trimmedLine.isEmpty() || trimmedLine.equalsIgnoreCase("WEBVTT") || trimmedLine.matches("^\\d+$")) {
                        continue;
                    }
                    java.util.regex.Matcher tm = timePattern.matcher(trimmedLine);
                    if (tm.find()) {
                        startSec = toSeconds(tm.group(1), tm.group(2), tm.group(3), tm.group(4));
                        endSec = toSeconds(tm.group(5), tm.group(6), tm.group(7), tm.group(8));
                    } else if (startSec >= 0) {
                        if (textBuilder.length() > 0) textBuilder.append(" ");
                        textBuilder.append(trimmedLine.replaceAll("<[^>]+>", ""));
                    }
                }

                String ja = textBuilder.toString().trim();
                if (startSec >= 0 && endSec > startSec && !ja.isEmpty()) {
                    Map<String, Object> seg = new LinkedHashMap<>();
                    seg.put("id", idx++);
                    seg.put("startTime", Math.round(startSec * 100.0) / 100.0);
                    seg.put("endTime", Math.round(endSec * 100.0) / 100.0);
                    seg.put("textJa", ja);
                    seg.put("reading", furiganaService.toFullHiragana(ja));
                    segments.add(seg);
                }
            }
        } else {
            String[] lines = normalized.split("\n");
            java.util.regex.Pattern linePattern = java.util.regex.Pattern.compile(
                    "^\\[?(?:(\\d{1,2}):)?(\\d{1,2}):(\\d{2})(?:[.,](\\d{1,3}))?\\]?\\s*(?:[-–~]|-->)?\\s*(?:\\[?(?:(\\d{1,2}):)?(\\d{1,2}):(\\d{2})(?:[.,](\\d{1,3}))?\\]?)?\\s+(.+)$"
            );
            int idx = 1;
            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                java.util.regex.Matcher lm = linePattern.matcher(trimmed);
                if (lm.find()) {
                    double start = toSeconds(lm.group(1), lm.group(2), lm.group(3), lm.group(4));
                    double end = (lm.group(6) != null && lm.group(7) != null)
                            ? toSeconds(lm.group(5), lm.group(6), lm.group(7), lm.group(8))
                            : -1;
                    String ja = lm.group(9).trim();
                    Map<String, Object> seg = new LinkedHashMap<>();
                    seg.put("id", idx++);
                    seg.put("startTime", Math.round(start * 100.0) / 100.0);
                    seg.put("endTime", end > start ? Math.round(end * 100.0) / 100.0 : null);
                    seg.put("textJa", ja);
                    seg.put("reading", furiganaService.toFullHiragana(ja));
                    segments.add(seg);
                }
            }

            for (int i = 0; i < segments.size(); i++) {
                Map<String, Object> curr = segments.get(i);
                if (curr.get("endTime") == null) {
                    double s = ((Number) curr.get("startTime")).doubleValue();
                    if (i + 1 < segments.size()) {
                        double nextStart = ((Number) segments.get(i + 1).get("startTime")).doubleValue();
                        curr.put("endTime", nextStart > s ? nextStart : s + 4.0);
                    } else {
                        curr.put("endTime", s + 4.0);
                    }
                }
            }
        }

        if (segments.isEmpty()) {
            throw new AppException(
                    ErrorCode.VALIDATION_ERROR,
                    "Không tìm thấy mốc thời gian (timestamp) hợp lệ. Vui lòng sử dụng file chuẩn .SRT, .VTT hoặc định dạng 'MM:SS - MM:SS Câu tiếng Nhật'."
            );
        }
        return segments;
    }

    private double toSeconds(String h, String m, String s, String ms) {
        double hours = (h != null && !h.isEmpty()) ? Double.parseDouble(h) : 0;
        double mins = Double.parseDouble(m);
        double secs = Double.parseDouble(s);
        double millis = 0;
        if (ms != null && !ms.isEmpty()) {
            String padded = (ms + "000").substring(0, 3);
            millis = Double.parseDouble(padded) / 1000.0;
        }
        return hours * 3600.0 + mins * 60.0 + secs + millis;
    }
}
