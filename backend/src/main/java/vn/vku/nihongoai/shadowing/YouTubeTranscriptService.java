package vn.vku.nihongoai.shadowing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.ai.GeminiClient;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.furigana.FuriganaService;
import vn.vku.nihongoai.user.User;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bộ xử lý transcript YouTube đa phương án + Dịch ngữ cảnh tiếng Việt qua Gemini AI + Lưu trữ PostgreSQL:
 * - Bước 0: Kiểm tra PostgreSQL (youtube_video_transcripts + youtube_video_sentences). Nếu đã có thì trả về ngay, không gọi lại AI dịch!
 * - Phương án 1: Phụ đề tiếng Nhật có sẵn (Manual Japanese captions .ja / ja / ja-JP qua Innertube Player API)
 * - Phương án 2: Phụ đề tiếng Nhật tự động (Auto-generated ASR a.ja qua Innertube Player API) hoặc file SRT/VTT
 * - Phương án 3: Speech-to-Text cho video tiếng Nhật không có phụ đề công khai qua Google Gemini Multimodal YouTube URI
 * - Dịch thuật AI theo ngữ cảnh tiếng Việt (lô 45 câu) và lưu trực tiếp cùng từng câu trong PostgreSQL.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class YouTubeTranscriptService {

    private static final String ANDROID_CLIENT_VERSION = "20.10.38";
    private static final String ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip";
    private static final String WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final int DEFAULT_TRANSLATION_BATCH_SIZE = 45;

    private static final String TRANSLATION_SYSTEM_PROMPT = """
            Bạn là biên dịch viên tiếng Nhật - tiếng Việt chuyên nghiệp cho nền tảng học tiếng Nhật PQ Nihongo.
            Nhiệm vụ: Dịch danh sách các câu tiếng Nhật trích xuất theo trình tự thời gian từ một video YouTube sang tiếng Việt.
            Quy tắc bắt buộc:
            1. Dịch tự nhiên, đúng ngữ cảnh mạch truyện giữa các câu liền kề trong video.
            2. Không dịch máy móc từng từ, không bỏ sót ý và tuyệt đối KHÔNG tự bịa thêm nội dung không có trong câu gốc.
            3. Giữ đúng sắc thái thân mật / lịch sự của người nói trong video.
            4. Xử lý gọn gàng cả câu ngắn (cảm thán, nối ý) lẫn câu dài.
            5. Trả về đúng JSON thuần với đầy đủ số thứ tự (order) khớp đầu vào:
            {
              "translations": [
                { "order": 1, "vi": "Bản dịch tiếng Việt tự nhiên của câu 1" }
              ]
            }
            """;

    private final FuriganaService furiganaService;
    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;
    private final YouTubeVideoTranscriptRepository transcriptRepository;
    private final YouTubeVideoSentenceRepository sentenceRepository;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @Transactional
    public Map<String, Object> processVideoTranscript(User user, String videoIdOrUrl) {
        String videoId = extractVideoId(videoIdOrUrl);
        if (videoId == null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "URL hoặc mã Video YouTube không hợp lệ. Vui lòng kiểm tra lại đường dẫn.");
        }

        // Bước 0: Nếu video đã được trích xuất và lưu trong PostgreSQL -> Tải trực tiếp từ DB!
        Optional<YouTubeVideoTranscript> cachedOpt = transcriptRepository.findById(videoId);
        if (cachedOpt.isPresent()) {
            List<YouTubeVideoSentence> cachedSentences = sentenceRepository.findAllByVideoIdOrderBySentenceOrderAsc(videoId);
            if (!cachedSentences.isEmpty()) {
                YouTubeVideoTranscript cached = cachedOpt.get();
                // Nếu vẫn còn câu PENDING chưa dịch (ví dụ lô đầu), dịch ngay 1 lô nhỏ nếu chưa có câu nào dịch
                long translatedSoFar = cachedSentences.stream().filter(s -> "TRANSLATED".equalsIgnoreCase(s.getTranslationStatus())).count();
                if (translatedSoFar == 0) {
                    translatePendingSentencesInternal(user, cached, cachedSentences, DEFAULT_TRANSLATION_BATCH_SIZE);
                }
                return buildResponseFromEntities(cached, cachedSentences, true);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("videoId", videoId);

        // Bước 1: Kiểm tra trạng thái video và danh sách captionTracks qua YouTube Innertube API
        JsonNode playerRoot = fetchInnertubePlayerJson(videoId);
        if (playerRoot == null) {
            result.put("status", "ERROR");
            result.put("hasAutoCaptions", false);
            result.put("segments", List.of());
            result.put("message", "Không thể kết nối tới máy chủ YouTube để kiểm tra thông tin video. Bạn có thể tải lên file SRT/VTT thủ công.");
            return result;
        }

        String playStatus = playerRoot.path("playabilityStatus").path("status").asText("");
        String playReason = playerRoot.path("playabilityStatus").path("reason").asText("");
        if ("ERROR".equalsIgnoreCase(playStatus) || "LOGIN_REQUIRED".equalsIgnoreCase(playStatus) || "UNPLAYABLE".equalsIgnoreCase(playStatus)) {
            result.put("status", "UNAVAILABLE");
            result.put("hasAutoCaptions", false);
            result.put("segments", List.of());
            result.put("reason", playStatus);
            result.put("message", "Video này không tồn tại, đã bị đặt ở chế độ riêng tư hoặc bị giới hạn quyền truy cập trên YouTube (" + (playReason.isEmpty() ? playStatus : playReason) + ").");
            return result;
        }

        String videoTitle = playerRoot.path("videoDetails").path("title").asText("");
        String author = playerRoot.path("videoDetails").path("author").asText("");
        int lengthSeconds = playerRoot.path("videoDetails").path("lengthSeconds").asInt(0);

        JsonNode tracksNode = playerRoot.path("captions")
                .path("playerCaptionsTracklistRenderer")
                .path("captionTracks");

        JsonNode manualJaTrack = null;
        JsonNode autoJaTrack = null;
        List<String> availableLangs = new ArrayList<>();

        if (tracksNode.isArray()) {
            for (JsonNode t : tracksNode) {
                String lang = t.path("languageCode").asText("");
                String vssId = t.path("vssId").asText("");
                String kind = t.path("kind").asText("");
                availableLangs.add(lang + ("asr".equalsIgnoreCase(kind) ? " (auto)" : ""));

                if (lang.toLowerCase().startsWith("ja") || vssId.contains(".ja")) {
                    if ("asr".equalsIgnoreCase(kind) || vssId.startsWith("a.")) {
                        if (autoJaTrack == null) autoJaTrack = t;
                    } else {
                        if (manualJaTrack == null) manualJaTrack = t;
                    }
                }
            }
        }

        List<Map<String, Object>> extractedSegments = List.of();
        String method = null;
        String methodLabel = null;
        String language = null;

        // PHƯƠNG ÁN 1: Phụ đề tiếng Nhật chuẩn (Manual Japanese Subtitles)
        if (manualJaTrack != null) {
            String baseUrl = manualJaTrack.path("baseUrl").asText("");
            extractedSegments = downloadAndParseCaptionUrl(baseUrl, false);
            if (!extractedSegments.isEmpty()) {
                method = "METHOD_1_MANUAL_SUBTITLE";
                methodLabel = "Phụ đề tiếng Nhật chuẩn của video";
                language = "ja";
            }
        }

        // PHƯƠNG ÁN 2: Phụ đề tiếng Nhật tự động (Auto-generated ASR Japanese Subtitles)
        if (extractedSegments.isEmpty() && autoJaTrack != null) {
            String baseUrl = autoJaTrack.path("baseUrl").asText("");
            extractedSegments = downloadAndParseCaptionUrl(baseUrl, true);
            if (!extractedSegments.isEmpty()) {
                method = "METHOD_2_AUTO_ASR_SUBTITLE";
                methodLabel = "Phụ đề tiếng Nhật tự động (YouTube ASR)";
                language = "ja (ASR)";
            }
        }

        // PHƯƠNG ÁN 3: Speech-to-Text qua Google Gemini Multimodal
        if (extractedSegments.isEmpty()) {
            try {
                extractedSegments = transcribeYoutubeVideoWithGemini(videoId, videoTitle, lengthSeconds);
                if (!extractedSegments.isEmpty()) {
                    method = "METHOD_3_GEMINI_STT";
                    methodLabel = "Nhận diện giọng nói AI (Speech-to-Text)";
                    language = "ja (AI Speech-to-Text)";
                }
            } catch (Exception e) {
                log.warn("Gemini Speech-to-Text fallback for YouTube video {} failed: {}", videoId, e.getMessage());
            }
        }

        if (!extractedSegments.isEmpty()) {
            // Lưu toàn bộ metadata + câu vào PostgreSQL, sau đó dịch lô đầu tiên bằng Gemini AI
            YouTubeVideoTranscript transcriptEntity = saveTranscriptAndSentences(
                    videoId, videoTitle, author, lengthSeconds, method, methodLabel, language, extractedSegments
            );
            List<YouTubeVideoSentence> savedSentences = sentenceRepository.findAllByVideoIdOrderBySentenceOrderAsc(videoId);
            translatePendingSentencesInternal(user, transcriptEntity, savedSentences, DEFAULT_TRANSLATION_BATCH_SIZE);
            return buildResponseFromEntities(transcriptEntity, savedSentences, false);
        }

        // Không có tiếng Nhật -> hướng dẫn nhập SRT/VTT thủ công
        String langNote = availableLangs.isEmpty()
                ? "Video này không có phụ đề công khai."
                : "Video này chỉ có phụ đề ngôn ngữ khác (" + String.join(", ", availableLangs) + "), không có phụ đề tiếng Nhật.";
        result.put("title", videoTitle);
        result.put("author", author);
        result.put("durationSeconds", lengthSeconds);
        result.put("availableLanguages", availableLangs);
        result.put("status", "NO_JAPANESE_TRANSCRIPT");
        result.put("method", "MANUAL_FALLBACK");
        result.put("hasAutoCaptions", false);
        result.put("segments", List.of());
        result.put("message", langNote + " Bạn có thể tải lên file phụ đề (.SRT / .VTT) hoặc dán transcript tiếng Nhật vào khung bên dưới.");
        return result;
    }

    /**
     * Lưu danh sách câu từ phụ đề thủ công (.SRT/.VTT) vào PostgreSQL và tự động dịch sang tiếng Việt.
     */
    @Transactional
    public Map<String, Object> saveManualSubtitlesAndTranslate(User user, String videoIdOrUrl, List<Map<String, Object>> parsedSegments) {
        String videoId = extractVideoId(videoIdOrUrl);
        if (videoId == null) {
            // Không gắn với videoId YouTube cụ thể -> dịch trực tiếp không lưu DB
            translateAdHocSegments(user, parsedSegments);
            Map<String, Object> adhoc = new LinkedHashMap<>();
            adhoc.put("segments", parsedSegments);
            adhoc.put("translatedCount", parsedSegments.stream().filter(s -> "TRANSLATED".equals(s.get("translationStatus"))).count());
            adhoc.put("totalCount", parsedSegments.size());
            adhoc.put("pendingCount", 0);
            return adhoc;
        }

        YouTubeVideoTranscript transcript = saveTranscriptAndSentences(
                videoId,
                "Video YouTube (" + videoId + ")",
                "",
                0,
                "MANUAL_SRT_VTT",
                "Phụ đề .SRT / .VTT tải lên",
                "ja",
                parsedSegments
        );
        List<YouTubeVideoSentence> saved = sentenceRepository.findAllByVideoIdOrderBySentenceOrderAsc(videoId);
        translatePendingSentencesInternal(user, transcript, saved, DEFAULT_TRANSLATION_BATCH_SIZE);
        return buildResponseFromEntities(transcript, saved, false);
    }

    /**
     * Dịch tiếp các câu còn ở trạng thái PENDING hoặc FAILED của video và lưu vào PostgreSQL.
     */
    @Transactional
    public Map<String, Object> translatePendingBatch(User user, String videoIdOrUrl, int batchSize) {
        String videoId = extractVideoId(videoIdOrUrl);
        if (videoId == null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Mã video YouTube không hợp lệ");
        }
        YouTubeVideoTranscript transcript = transcriptRepository.findById(videoId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Chưa tìm thấy transcript của video này trong cơ sở dữ liệu"));

        List<YouTubeVideoSentence> allSentences = sentenceRepository.findAllByVideoIdOrderBySentenceOrderAsc(videoId);
        int limit = (batchSize > 0 && batchSize <= 60) ? batchSize : DEFAULT_TRANSLATION_BATCH_SIZE;
        translatePendingSentencesInternal(user, transcript, allSentences, limit);
        return buildResponseFromEntities(transcript, allSentences, false);
    }

    /**
     * Dịch lại 1 câu duy nhất (kèm 2 câu lân cận làm ngữ cảnh) khi câu đó bị lỗi hoặc người dùng bấm "Dịch lại".
     */
    @Transactional
    public Map<String, Object> retranslateSingleSentence(User user, String videoIdOrUrl, Long sentenceId) {
        String videoId = extractVideoId(videoIdOrUrl);
        if (videoId == null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Mã video YouTube không hợp lệ");
        }
        YouTubeVideoTranscript transcript = transcriptRepository.findById(videoId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy video trong cơ sở dữ liệu"));
        YouTubeVideoSentence target = sentenceRepository.findByIdAndVideoId(sentenceId, videoId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy câu cần dịch lại"));

        List<YouTubeVideoSentence> all = sentenceRepository.findAllByVideoIdOrderBySentenceOrderAsc(videoId);
        int idx = -1;
        for (int i = 0; i < all.size(); i++) {
            if (all.get(i).getId().equals(sentenceId)) {
                idx = i;
                break;
            }
        }
        String prevJa = (idx > 0) ? all.get(idx - 1).getJapaneseText() : "";
        String nextJa = (idx >= 0 && idx + 1 < all.size()) ? all.get(idx + 1).getJapaneseText() : "";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("videoTitle", transcript.getTitle() != null ? transcript.getTitle() : "");
        payload.put("contextBefore", prevJa);
        payload.put("contextAfter", nextJa);
        payload.put("sentences", List.of(Map.of("order", target.getSentenceOrder(), "ja", target.getJapaneseText())));

        try {
            String jsonPrompt = objectMapper.writeValueAsString(payload);
            JsonNode node = geminiClient.translateJapaneseBatch(user, TRANSLATION_SYSTEM_PROMPT, jsonPrompt);
            JsonNode arr = node.path("translations");
            String translatedVi = null;
            if (arr.isArray()) {
                for (JsonNode item : arr) {
                    if (item.path("order").asInt(-1) == target.getSentenceOrder() || arr.size() == 1) {
                        translatedVi = item.path("vi").asText("").trim();
                        break;
                    }
                }
            }
            if (translatedVi != null && !translatedVi.isBlank()) {
                target.setVietnameseTranslation(translatedVi);
                target.setTranslationStatus("TRANSLATED");
            } else {
                target.setTranslationStatus("FAILED");
            }
            sentenceRepository.save(target);
        } catch (Exception e) {
            log.warn("Retranslate single sentence {} failed: {}", sentenceId, e.getMessage());
            target.setTranslationStatus("FAILED");
            sentenceRepository.save(target);
            throw new AppException(ErrorCode.AI_UNAVAILABLE, "Dịch lại câu thất bại: " + e.getMessage());
        }

        return sentenceToMap(target);
    }

    private YouTubeVideoTranscript saveTranscriptAndSentences(
            String videoId,
            String title,
            String author,
            int durationSeconds,
            String method,
            String methodLabel,
            String language,
            List<Map<String, Object>> segments
    ) {
        YouTubeVideoTranscript entity = transcriptRepository.findById(videoId).orElseGet(YouTubeVideoTranscript::new);
        entity.setVideoId(videoId);
        entity.setTitle(title != null && title.length() > 300 ? title.substring(0, 300) : title);
        entity.setAuthor(author != null && author.length() > 200 ? author.substring(0, 200) : author);
        entity.setDurationSeconds(durationSeconds);
        entity.setExtractMethod(method);
        entity.setMethodLabel(methodLabel);
        entity.setLanguage(language);
        entity = transcriptRepository.save(entity);

        sentenceRepository.deleteAllByVideoId(videoId);
        sentenceRepository.flush();

        List<YouTubeVideoSentence> toSave = new ArrayList<>();
        int order = 1;
        for (Map<String, Object> seg : segments) {
            String ja = String.valueOf(seg.getOrDefault("textJa", "")).trim();
            if (ja.isEmpty()) continue;
            String hira = seg.get("reading") != null ? seg.get("reading").toString() : furiganaService.toFullHiragana(ja);
            double start = seg.get("startTime") instanceof Number n ? n.doubleValue() : 0.0;
            double end = seg.get("endTime") instanceof Number n ? n.doubleValue() : start + 3.5;

            toSave.add(YouTubeVideoSentence.builder()
                    .videoId(videoId)
                    .sentenceOrder(order++)
                    .japaneseText(ja)
                    .hiraganaText(hira)
                    .vietnameseTranslation(null)
                    .translationStatus("PENDING")
                    .startTime(start)
                    .endTime(end)
                    .build());
        }
        sentenceRepository.saveAll(toSave);
        return entity;
    }

    private void translatePendingSentencesInternal(User user, YouTubeVideoTranscript transcript, List<YouTubeVideoSentence> allSentences, int maxCount) {
        List<YouTubeVideoSentence> batch = new ArrayList<>();
        for (YouTubeVideoSentence s : allSentences) {
            if (!"TRANSLATED".equalsIgnoreCase(s.getTranslationStatus())
                    || s.getVietnameseTranslation() == null
                    || s.getVietnameseTranslation().isBlank()) {
                batch.add(s);
                if (batch.size() >= maxCount) break;
            }
        }
        if (batch.isEmpty()) return;

        List<Map<String, Object>> promptItems = new ArrayList<>();
        for (YouTubeVideoSentence s : batch) {
            promptItems.add(Map.of("order", s.getSentenceOrder(), "ja", s.getJapaneseText()));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("videoTitle", transcript.getTitle() != null ? transcript.getTitle() : "");
        payload.put("sentences", promptItems);

        try {
            String jsonPrompt = objectMapper.writeValueAsString(payload);
            JsonNode node = geminiClient.translateJapaneseBatch(user, TRANSLATION_SYSTEM_PROMPT, jsonPrompt);
            JsonNode translationsArr = node.path("translations");

            Map<Integer, String> orderToVi = new HashMap<>();
            if (translationsArr.isArray()) {
                for (JsonNode item : translationsArr) {
                    int ord = item.path("order").asInt(-1);
                    String vi = item.path("vi").asText("").trim();
                    if (ord > 0 && !vi.isEmpty()) {
                        orderToVi.put(ord, vi);
                    }
                }
            }

            for (YouTubeVideoSentence s : batch) {
                String vi = orderToVi.get(s.getSentenceOrder());
                if (vi != null && !vi.isBlank()) {
                    s.setVietnameseTranslation(vi);
                    s.setTranslationStatus("TRANSLATED");
                } else {
                    s.setTranslationStatus("FAILED");
                }
            }
            sentenceRepository.saveAll(batch);
        } catch (Exception e) {
            log.warn("Batch Vietnamese translation failed for video {}: {}", transcript.getVideoId(), e.getMessage());
            // Không làm hỏng toàn bộ video — chỉ đánh dấu FAILED cho lô này để người dùng bấm "Dịch lại"
            for (YouTubeVideoSentence s : batch) {
                if (!"TRANSLATED".equalsIgnoreCase(s.getTranslationStatus())) {
                    s.setTranslationStatus("FAILED");
                }
            }
            sentenceRepository.saveAll(batch);
        }
    }

    private void translateAdHocSegments(User user, List<Map<String, Object>> segments) {
        if (segments.isEmpty()) return;
        int limit = Math.min(segments.size(), DEFAULT_TRANSLATION_BATCH_SIZE);
        List<Map<String, Object>> promptItems = new ArrayList<>();
        for (int i = 0; i < limit; i++) {
            Map<String, Object> seg = segments.get(i);
            promptItems.add(Map.of("order", i + 1, "ja", String.valueOf(seg.getOrDefault("textJa", ""))));
        }
        try {
            String jsonPrompt = objectMapper.writeValueAsString(Map.of("sentences", promptItems));
            JsonNode node = geminiClient.translateJapaneseBatch(user, TRANSLATION_SYSTEM_PROMPT, jsonPrompt);
            Map<Integer, String> orderToVi = new HashMap<>();
            JsonNode arr = node.path("translations");
            if (arr.isArray()) {
                for (JsonNode item : arr) {
                    int ord = item.path("order").asInt(-1);
                    String vi = item.path("vi").asText("").trim();
                    if (ord > 0 && !vi.isEmpty()) orderToVi.put(ord, vi);
                }
            }
            for (int i = 0; i < segments.size(); i++) {
                String vi = orderToVi.get(i + 1);
                if (vi != null && !vi.isBlank()) {
                    segments.get(i).put("textVi", vi);
                    segments.get(i).put("vietnameseTranslation", vi);
                    segments.get(i).put("translationStatus", "TRANSLATED");
                } else {
                    segments.get(i).put("textVi", "");
                    segments.get(i).put("vietnameseTranslation", "");
                    segments.get(i).put("translationStatus", i < limit ? "FAILED" : "PENDING");
                }
            }
        } catch (Exception e) {
            log.warn("Ad-hoc subtitle translation failed: {}", e.getMessage());
            for (Map<String, Object> seg : segments) {
                seg.put("textVi", "");
                seg.put("vietnameseTranslation", "");
                seg.put("translationStatus", "FAILED");
            }
        }
    }

    private Map<String, Object> buildResponseFromEntities(YouTubeVideoTranscript t, List<YouTubeVideoSentence> sentences, boolean fromCache) {
        long translatedCount = sentences.stream().filter(s -> "TRANSLATED".equalsIgnoreCase(s.getTranslationStatus())).count();
        long pendingCount = sentences.stream().filter(s -> "PENDING".equalsIgnoreCase(s.getTranslationStatus())).count();
        long failedCount = sentences.stream().filter(s -> "FAILED".equalsIgnoreCase(s.getTranslationStatus())).count();

        List<Map<String, Object>> segList = sentences.stream().map(this::sentenceToMap).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("videoId", t.getVideoId());
        result.put("title", t.getTitle());
        result.put("author", t.getAuthor());
        result.put("durationSeconds", t.getDurationSeconds());
        result.put("status", "SUCCESS");
        result.put("method", t.getExtractMethod());
        result.put("methodLabel", t.getMethodLabel());
        result.put("language", t.getLanguage());
        result.put("hasAutoCaptions", true);
        result.put("fromCache", fromCache);
        result.put("totalCount", sentences.size());
        result.put("translatedCount", translatedCount);
        result.put("pendingCount", pendingCount);
        result.put("failedCount", failedCount);
        result.put("segments", segList);

        String cacheNote = fromCache ? " (Tải từ cơ sở dữ liệu đã lưu)" : "";
        result.put("message", String.format(
                "Đã tải thành công %d câu tiếng Nhật kèm Hiragana (%d/%d câu đã có bản dịch tiếng Việt)%s.",
                sentences.size(), translatedCount, sentences.size(), cacheNote
        ));
        return result;
    }

    private Map<String, Object> sentenceToMap(YouTubeVideoSentence s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("sentenceId", s.getId());
        m.put("sentenceOrder", s.getSentenceOrder());
        m.put("startTime", s.getStartTime());
        m.put("endTime", s.getEndTime());
        m.put("textJa", s.getJapaneseText());
        m.put("japaneseText", s.getJapaneseText());
        m.put("reading", s.getHiraganaText() != null ? s.getHiraganaText() : "");
        m.put("hiraganaText", s.getHiraganaText() != null ? s.getHiraganaText() : "");
        m.put("textVi", s.getVietnameseTranslation() != null ? s.getVietnameseTranslation() : "");
        m.put("vietnameseTranslation", s.getVietnameseTranslation() != null ? s.getVietnameseTranslation() : "");
        m.put("translationStatus", s.getTranslationStatus());
        return m;
    }

    private JsonNode fetchInnertubePlayerJson(String videoId) {
        try {
            String apiKey = fetchInnertubeApiKey(videoId);
            String endpoint = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"
                    + (apiKey != null && !apiKey.isBlank() ? "&key=" + apiKey : "");

            Map<String, Object> payload = Map.of(
                    "context", Map.of(
                            "client", Map.of(
                                    "clientName", "ANDROID",
                                    "clientVersion", ANDROID_CLIENT_VERSION,
                                    "androidSdkVersion", 34,
                                    "hl", "ja",
                                    "gl", "JP"
                            )
                    ),
                    "videoId", videoId
            );

            String jsonBody = objectMapper.writeValueAsString(payload);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("User-Agent", ANDROID_UA)
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200 && resp.body() != null) {
                return objectMapper.readTree(resp.body());
            }
        } catch (Exception e) {
            log.warn("Innertube player request failed for {}: {}", videoId, e.getMessage());
        }
        return null;
    }

    private String fetchInnertubeApiKey(String videoId) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://www.youtube.com/watch?v=" + videoId))
                    .header("User-Agent", WEB_UA)
                    .header("Accept-Language", "ja-JP,ja;q=0.9")
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200 && resp.body() != null) {
                Matcher m = Pattern.compile("\"INNERTUBE_API_KEY\":\"([^\"]+)\"").matcher(resp.body());
                if (m.find()) {
                    return m.group(1);
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private List<Map<String, Object>> downloadAndParseCaptionUrl(String baseUrl, boolean isAsr) {
        if (baseUrl == null || baseUrl.isBlank()) return List.of();
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl))
                    .header("User-Agent", ANDROID_UA)
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200 && resp.body() != null && !resp.body().isBlank()) {
                return parseTimedTextXml(resp.body(), isAsr);
            }
        } catch (Exception e) {
            log.warn("Failed to download caption track {}: {}", baseUrl, e.getMessage());
        }
        return List.of();
    }

    public List<Map<String, Object>> parseTimedTextXml(String xml, boolean isAsr) {
        List<RawSegment> rawList = new ArrayList<>();

        Pattern pFormat3 = Pattern.compile("<p\\s+[^>]*?t=\"(\\d+)\"(?:\\s+[^>]*?d=\"(\\d+)\")?[^>]*>(.*?)</p>", Pattern.DOTALL);
        Matcher m3 = pFormat3.matcher(xml);
        while (m3.find()) {
            double startSec = Double.parseDouble(m3.group(1)) / 1000.0;
            double durSec = m3.group(2) != null ? Double.parseDouble(m3.group(2)) / 1000.0 : 3.5;
            String text = cleanXmlText(m3.group(3));
            if (!text.isEmpty()) {
                rawList.add(new RawSegment(startSec, startSec + durSec, text));
            }
        }

        if (rawList.isEmpty()) {
            Pattern pFormat1 = Pattern.compile("<text\\s+[^>]*?start=\"([0-9.]+)\"(?:\\s+[^>]*?dur=\"([0-9.]+)\")?[^>]*>(.*?)</text>", Pattern.DOTALL);
            Matcher m1 = pFormat1.matcher(xml);
            while (m1.find()) {
                double startSec = Double.parseDouble(m1.group(1));
                double durSec = m1.group(2) != null ? Double.parseDouble(m1.group(2)) : 3.5;
                String text = cleanXmlText(m1.group(3));
                if (!text.isEmpty()) {
                    rawList.add(new RawSegment(startSec, startSec + durSec, text));
                }
            }
        }

        if (rawList.isEmpty()) return List.of();

        List<RawSegment> normalized = normalizeAndMergeSegments(rawList, isAsr);

        List<Map<String, Object>> result = new ArrayList<>();
        int idx = 1;
        for (RawSegment seg : normalized) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", idx++);
            item.put("startTime", Math.round(seg.start * 100.0) / 100.0);
            item.put("endTime", Math.round(seg.end * 100.0) / 100.0);
            item.put("textJa", seg.text);
            item.put("reading", furiganaService.toFullHiragana(seg.text));
            result.add(item);
        }
        return result;
    }

    private List<RawSegment> normalizeAndMergeSegments(List<RawSegment> rawList, boolean isAsr) {
        List<RawSegment> cleaned = new ArrayList<>();
        for (RawSegment r : rawList) {
            if (!cleaned.isEmpty() && cleaned.get(cleaned.size() - 1).text.equals(r.text)) {
                continue;
            }
            cleaned.add(r);
        }

        for (int i = 0; i < cleaned.size() - 1; i++) {
            RawSegment curr = cleaned.get(i);
            RawSegment next = cleaned.get(i + 1);
            if (curr.end > next.start && next.start > curr.start) {
                curr.end = next.start;
            }
        }

        if (!isAsr) {
            return cleaned;
        }

        List<RawSegment> merged = new ArrayList<>();
        RawSegment buffer = null;
        for (RawSegment seg : cleaned) {
            if (buffer == null) {
                buffer = new RawSegment(seg.start, seg.end, seg.text);
            } else {
                buffer.text = buffer.text + seg.text;
                buffer.end = seg.end;
            }
            boolean endsSentence = buffer.text.endsWith("。") || buffer.text.endsWith("！") || buffer.text.endsWith("？")
                    || buffer.text.endsWith("!") || buffer.text.endsWith("?");
            if (endsSentence || buffer.text.length() >= 22 || (buffer.end - buffer.start) >= 6.5) {
                merged.add(buffer);
                buffer = null;
            }
        }
        if (buffer != null) {
            merged.add(buffer);
        }
        return merged;
    }

    private List<Map<String, Object>> transcribeYoutubeVideoWithGemini(String videoId, String title, int durationSec) {
        String youtubeUrl = "https://www.youtube.com/watch?v=" + videoId;
        String prompt = """
                Hãy nghe âm thanh tiếng Nhật trong video YouTube này và trích xuất transcript tiếng Nhật theo từng câu kèm mốc thời gian thực tế (tính bằng giây).
                Chỉ trích xuất những câu tiếng Nhật thực sự được nói trong video. Không tự bịa đặt nội dung nếu video không nói tiếng Nhật.
                Trả về định dạng JSON thuần:
                {
                  "isJapanese": true,
                  "segments": [
                    { "startTime": 0.0, "endTime": 3.7, "textJa": "câu tiếng Nhật" }
                  ]
                }
                """;

        JsonNode node = geminiClient.transcribeYoutubeVideo(youtubeUrl, prompt);
        if (node == null || !node.path("isJapanese").asBoolean(false)) {
            return List.of();
        }
        JsonNode segsNode = node.path("segments");
        if (!segsNode.isArray()) return List.of();

        List<Map<String, Object>> list = new ArrayList<>();
        int idx = 1;
        for (JsonNode s : segsNode) {
            String ja = s.path("textJa").asText("").trim();
            double start = s.path("startTime").asDouble(-1);
            double end = s.path("endTime").asDouble(-1);
            if (!ja.isEmpty() && start >= 0 && end > start && (durationSec <= 0 || start < durationSec)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", idx++);
                item.put("startTime", Math.round(start * 100.0) / 100.0);
                item.put("endTime", Math.round(end * 100.0) / 100.0);
                item.put("textJa", ja);
                item.put("reading", furiganaService.toFullHiragana(ja));
                list.add(item);
            }
        }
        return list;
    }

    private String cleanXmlText(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("<[^>]+>", "")
                .replaceAll("&amp;", "&")
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&quot;", "\"")
                .replaceAll("&#39;", "'")
                .replaceAll("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    public static String extractVideoId(String urlOrId) {
        if (urlOrId == null || urlOrId.isBlank()) return null;
        String trimmed = urlOrId.trim();
        if (trimmed.matches("^[a-zA-Z0-9_-]{11}$")) {
            return trimmed;
        }
        Matcher m = Pattern.compile("(?:youtube\\.com/(?:[^/]+/.+/|(?:v|e(?:mbed)?|shorts)/|.*[?&]v=)|youtu\\.be/)([a-zA-Z0-9_-]{11})").matcher(trimmed);
        return m.find() ? m.group(1) : null;
    }

    private static class RawSegment {
        double start;
        double end;
        String text;

        RawSegment(double start, double end, String text) {
            this.start = start;
            this.end = end;
            this.text = text;
        }
    }
}
