package vn.vku.nihongoai.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import vn.vku.nihongoai.admin.SystemSettingRepository;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.Constants;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.user.User;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiClient {

    private static final String DEFAULT_MODEL = "gemini-3-flash-preview";
    private static final String FALLBACK_MODEL_25 = "gemini-2.5-flash";
    private static final String BACKUP_MODEL = "gemini-3.1-flash-lite";

    private final WebClient geminiWebClient;
    private final SystemSettingRepository systemSettingRepository;
    private final AiCallLogRepository aiCallLogRepository;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-3-flash-preview}")
    private String configuredModel;

    public JsonNode generateVisionJson(User user, String base64Image, String mimeType, String level) {
        return generateVisionJson(user, base64Image, mimeType, level, null);
    }

    public JsonNode generateVisionJson(User user, String base64Image, String mimeType, String level, String topicHint) {
        String model = resolveActiveModel(Constants.SETTING_AI_MODEL_VISION);
        String prompt = String.format(PromptTemplates.VISION_SYSTEM_PROMPT, level != null ? level : "N5");
        if (topicHint != null && !topicHint.isBlank()) {
            prompt = prompt + "\nNgữ cảnh/chủ đề gợi ý từ người dùng: " + topicHint.trim();
        }

        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(
                                Map.of("text", prompt),
                                Map.of("inlineData", Map.of(
                                        "mimeType", mimeType != null ? mimeType : "image/jpeg",
                                        "data", base64Image
                                ))
                        ))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json"
                )
        );

        return callGeminiWithLog(user, AiFeature.RECOGNITION, model, body);
    }

    public JsonNode generateChatJson(User user, String systemInstruction, List<Map<String, Object>> contents) {
        String model = resolveActiveModel(Constants.SETTING_AI_MODEL_CHAT);

        Map<String, Object> body = new HashMap<>();
        body.put("contents", contents);
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))));
        body.put("generationConfig", Map.of("responseMimeType", "application/json"));

        return callGeminiWithLog(user, AiFeature.CONVERSATION, model, body);
    }

    public JsonNode translateJapaneseBatch(User user, String systemInstruction, String userPromptJson) {
        String model = resolveActiveModel(Constants.SETTING_AI_MODEL_CHAT);
        Map<String, Object> body = new HashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))));
        body.put("contents", List.of(
                Map.of("role", "user", "parts", List.of(Map.of("text", userPromptJson)))
        ));
        body.put("generationConfig", Map.of("responseMimeType", "application/json"));
        return callGeminiWithLog(user, AiFeature.SHADOWING, model, body);
    }

    public JsonNode transcribeYoutubeVideo(String youtubeUrl, String prompt) {
        String model = resolveActiveModel(Constants.SETTING_AI_MODEL_VISION);
        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(
                                Map.of("fileData", Map.of(
                                        "mimeType", "video/mp4",
                                        "fileUri", youtubeUrl
                                )),
                                Map.of("text", prompt)
                        ))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json"
                )
        );
        return callGeminiWithLog(null, AiFeature.SHADOWING, model, body);
    }

    public String generateSummary(User user, List<Map<String, Object>> conversationHistory) {
        String model = resolveActiveModel(Constants.SETTING_AI_MODEL_CHAT);

        List<Map<String, Object>> contents = new ArrayList<>(conversationHistory);
        contents.add(Map.of("role", "user", "parts", List.of(Map.of("text", PromptTemplates.CONVERSATION_SUMMARY_PROMPT))));

        Map<String, Object> body = Map.of(
                "contents", contents,
                "generationConfig", Map.of("responseMimeType", "application/json")
        );
        try {
            JsonNode node = callGeminiWithLog(user, AiFeature.CONVERSATION, model, body);
            if (node.isTextual()) {
                return node.asText();
            }
            if (node.has("summary")) {
                return node.path("summary").asText();
            }
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            return "Hoàn thành buổi luyện tập hội thoại. Hãy tiếp tục ôn tập các mẫu câu và từ vựng đã trao đổi!";
        }
    }

    public String resolveActiveModel(String settingKey) {
        String dbModel = systemSettingRepository.getSettingValue(settingKey, configuredModel != null ? configuredModel : DEFAULT_MODEL);
        if (dbModel == null || dbModel.isBlank()
                || "gemini-1.5-flash".equalsIgnoreCase(dbModel.trim())
                || "gemini-2.5-flash".equalsIgnoreCase(dbModel.trim())
                || "gemini-1.5-pro".equalsIgnoreCase(dbModel.trim())) {
            return DEFAULT_MODEL;
        }
        return dbModel.trim();
    }

    public String resolveActiveApiKey() {
        for (String candidate : List.of(".env", "../.env", "d:/DACS4/.env")) {
            try {
                java.nio.file.Path path = java.nio.file.Path.of(candidate);
                if (java.nio.file.Files.exists(path)) {
                    for (String rawLine : java.nio.file.Files.readAllLines(path)) {
                        String line = rawLine.trim();
                        if (line.startsWith("GEMINI_API_KEY=")) {
                            String val = line.substring("GEMINI_API_KEY=".length()).trim();
                            if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                                val = val.substring(1, val.length() - 1);
                            }
                            if (!val.isBlank() && !val.startsWith("YOUR_")) {
                                return val;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return apiKey != null ? apiKey.trim() : "";
    }

    private JsonNode callGeminiWithLog(User user, AiFeature feature, String primaryModel, Map<String, Object> body) {
        String activeKey = resolveActiveApiKey();
        if (activeKey == null || activeKey.isBlank() || activeKey.startsWith("YOUR_")) {
            throw new AppException(
                    ErrorCode.AI_UNAVAILABLE,
                    "Dịch vụ Gemini AI chưa được cấu hình GEMINI_API_KEY trong môi trường (.env). Vui lòng cấu hình API Key để sử dụng tính năng AI."
            );
        }

        List<String> candidateModels = new ArrayList<>();
        candidateModels.add(primaryModel);
        if (!DEFAULT_MODEL.equals(primaryModel)) {
            candidateModels.add(DEFAULT_MODEL);
        }
        if (!FALLBACK_MODEL_25.equals(primaryModel)) {
            candidateModels.add(FALLBACK_MODEL_25);
        }
        if (!BACKUP_MODEL.equals(primaryModel)) {
            candidateModels.add(BACKUP_MODEL);
        }

        Exception lastException = null;
        String lastFriendlyError = null;
        for (String modelToTry : candidateModels) {
            long startTime = System.currentTimeMillis();
            AiCallLog.AiCallLogBuilder logBuilder = AiCallLog.builder()
                    .user(user)
                    .feature(feature)
                    .model(modelToTry);

            try {
                String uri = String.format("/v1beta/models/%s:generateContent?key=%s", modelToTry, activeKey);

                String responseBody = geminiWebClient.post()
                        .uri(uri)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();

                long latency = System.currentTimeMillis() - startTime;
                logBuilder.latencyMs((int) latency);

                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode usage = root.path("usageMetadata");
                if (!usage.isMissingNode()) {
                    if (usage.has("promptTokenCount")) {
                        logBuilder.promptTokens(usage.path("promptTokenCount").asInt());
                    }
                    if (usage.has("candidatesTokenCount")) {
                        logBuilder.completionTokens(usage.path("candidatesTokenCount").asInt());
                    }
                }

                String rawText = root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText();
                if (rawText == null || rawText.isBlank()) {
                    throw new AppException(ErrorCode.AI_BAD_RESPONSE, "Phản hồi từ Gemini AI rỗng");
                }

                // Clean optional markdown code fences if present
                String cleanedJson = cleanJsonFence(rawText);

                logBuilder.status(AiCallStatus.SUCCESS);
                aiCallLogRepository.save(logBuilder.build());

                try {
                    return objectMapper.readTree(cleanedJson);
                } catch (Exception parseEx) {
                    return objectMapper.getNodeFactory().textNode(rawText.trim());
                }
            } catch (Exception e) {
                lastException = e;
                long latency = System.currentTimeMillis() - startTime;
                String detailBody = "";
                if (e instanceof org.springframework.web.reactive.function.client.WebClientResponseException wcre) {
                    detailBody = wcre.getResponseBodyAsString();
                    lastFriendlyError = buildFriendlyGeminiError(wcre.getStatusCode().value(), detailBody);
                }
                String errMsg = (!detailBody.isBlank() ? detailBody : (e.getMessage() != null ? e.getMessage() : "Unknown Gemini error"));
                if (errMsg.length() > 950) {
                    errMsg = errMsg.substring(0, 950);
                }

                log.warn("Gemini API call with model [{}] failed after {}ms: {}", modelToTry, latency, errMsg);
                logBuilder.status(AiCallStatus.ERROR)
                        .latencyMs((int) latency)
                        .errorMessage(errMsg);
                aiCallLogRepository.save(logBuilder.build());

                // Nếu lỗi do API key bị từ chối quyền (403 free tier unavailable / 401 / invalid key) thì dừng ngay không cần retry các model khác
                if (lastFriendlyError != null && (detailBody.contains("free tier is not available") || detailBody.contains("API_KEY_INVALID"))) {
                    break;
                }
            }
        }

        if (lastFriendlyError != null) {
            throw new AppException(ErrorCode.AI_UNAVAILABLE, lastFriendlyError);
        }
        String finalMsg = lastException != null && lastException.getMessage() != null
                ? lastException.getMessage()
                : "Không thể kết nối đến máy chủ Google Gemini";
        throw new AppException(ErrorCode.AI_UNAVAILABLE, "Dịch vụ Gemini AI tạm thời không khả dụng: " + finalMsg);
    }

    private String buildFriendlyGeminiError(int statusCode, String responseBody) {
        String lower = responseBody != null ? responseBody.toLowerCase() : "";
        if (statusCode == 403 && lower.contains("free tier is not available")) {
            return "API Key hiện tại trong file .env không hỗ trợ gói miễn phí của Gemini API (Google báo 403: The Gemini API free tier is not available for this project). Vui lòng tạo API Key mới miễn phí trên Google AI Studio (https://aistudio.google.com/apikey — khóa bắt đầu bằng AIzaSy...) bằng tài khoản/project mới rồi dán vào GEMINI_API_KEY trong file .env.";
        }
        if (statusCode == 403 && lower.contains("leaked")) {
            return "Google đã vô hiệu hóa API Key này do phát hiện bị lộ (403 Leaked Key). Vui lòng tạo API Key mới tại https://aistudio.google.com/apikey và cập nhật vào file .env.";
        }
        if (statusCode == 400 && lower.contains("api key not valid")) {
            return "GEMINI_API_KEY trong file .env không hợp lệ. Vui lòng kiểm tra lại API Key tại https://aistudio.google.com/apikey.";
        }
        if (statusCode == 429) {
            return "API Key Gemini đã vượt quá giới hạn lượt gọi miễn phí (429 Too Many Requests). Vui lòng đợi khoảng 1 phút rồi thử lại hoặc đổi API Key khác.";
        }
        return null;
    }

    private String cleanJsonFence(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline != -1) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
        }
        return trimmed.trim();
    }
}
