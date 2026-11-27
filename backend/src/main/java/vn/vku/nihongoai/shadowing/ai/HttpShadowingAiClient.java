package vn.vku.nihongoai.shadowing.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.shadowing.dto.ShadowingAiStatusDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;

/**
 * Internal HTTP adapter communicating with the Private Shadowing AI Model Server.
 * Never logs raw audio bytes and never exposes internal base URLs to clients.
 */
@Component
@Slf4j
public class HttpShadowingAiClient implements ShadowingAiServerClient {

    private final WebClient webClient;
    private final ShadowingAiProperties properties;
    private final ObjectMapper objectMapper;

    public HttpShadowingAiClient(
            @Qualifier("shadowingAiWebClient") WebClient webClient,
            ShadowingAiProperties properties,
            ObjectMapper objectMapper
    ) {
        this.webClient = webClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public ShadowingEvaluationResultDto evaluateShadowing(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText,
            byte[] referenceAudioBytes,
            String referenceFilename,
            String referenceContentType,
            String jlptLevel
    ) {
        ensureEnabled();
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        addAudioPart(builder, "audio", audioBytes, filename, contentType);
        builder.part("referenceText", referenceText != null ? referenceText : "");
        if (jlptLevel != null && !jlptLevel.isBlank()) {
            builder.part("jlptLevel", jlptLevel.trim());
        }
        if (referenceAudioBytes != null && referenceAudioBytes.length > 0) {
            addAudioPart(builder, "referenceAudio", referenceAudioBytes, referenceFilename, referenceContentType);
        }

        return postMultipart("/shadowing/evaluate", builder, ShadowingEvaluationResultDto.class);
    }

    @Override
    public ShadowingEvaluationResultDto.AsrSection transcribe(
            byte[] audioBytes, String filename, String contentType, String referenceText
    ) {
        ensureEnabled();
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        addAudioPart(builder, "audio", audioBytes, filename, contentType);
        if (referenceText != null && !referenceText.isBlank()) {
            builder.part("referenceText", referenceText);
        }
        builder.part("language", "ja");
        return postMultipart("/asr/transcribe", builder, ShadowingEvaluationResultDto.AsrSection.class);
    }

    @Override
    public ShadowingEvaluationResultDto.AlignmentSection align(
            byte[] audioBytes, String filename, String contentType, String referenceText
    ) {
        ensureEnabled();
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        addAudioPart(builder, "audio", audioBytes, filename, contentType);
        builder.part("referenceText", referenceText != null ? referenceText : "");
        builder.part("language", "ja");
        return postMultipart("/alignment/align", builder, ShadowingEvaluationResultDto.AlignmentSection.class);
    }

    @Override
    public JsonNode scorePronunciation(
            byte[] audioBytes, String filename, String contentType, String referenceText
    ) {
        ensureEnabled();
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        addAudioPart(builder, "audio", audioBytes, filename, contentType);
        builder.part("referenceText", referenceText != null ? referenceText : "");
        return postMultipart("/pronunciation/score", builder, JsonNode.class);
    }

    @Override
    public JsonNode analyzeIntonation(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText,
            byte[] referenceAudioBytes,
            String referenceFilename,
            String referenceContentType
    ) {
        ensureEnabled();
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        addAudioPart(builder, "audio", audioBytes, filename, contentType);
        builder.part("referenceText", referenceText != null ? referenceText : "");
        if (referenceAudioBytes != null && referenceAudioBytes.length > 0) {
            addAudioPart(builder, "referenceAudio", referenceAudioBytes, referenceFilename, referenceContentType);
        }
        return postMultipart("/intonation/analyze", builder, JsonNode.class);
    }

    @Override
    public ShadowingAiStatusDto checkHealth() {
        if (!properties.isEnabled()) {
            return ShadowingAiStatusDto.builder()
                    .enabled(false)
                    .available(false)
                    .status("DISABLED")
                    .geminiUsed(false)
                    .message("Local Shadowing AI đang bị tắt trong cấu hình server.")
                    .build();
        }
        try {
            JsonNode root = webClient.get()
                    .uri("/health")
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofSeconds(4));

            if (root == null) {
                return unavailableStatus("AI Model Server không trả về phản hồi trạng thái.");
            }
            String status = root.path("status").asText("UP");
            String device = root.path("device").asText("cpu");
            Map<String, Object> components = new LinkedHashMap<>();
            JsonNode compNode = root.path("components");
            if (compNode.isObject()) {
                compNode.fields().forEachRemaining(e -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("enabled", e.getValue().path("enabled").asBoolean(false));
                    item.put("loaded", e.getValue().path("loaded").asBoolean(false));
                    item.put("ready", e.getValue().path("ready").asBoolean(false));
                    item.put("model", e.getValue().path("model").asText(""));
                    components.put(e.getKey(), item);
                });
            }

            return ShadowingAiStatusDto.builder()
                    .enabled(true)
                    .available(true)
                    .status(status)
                    .device(device)
                    .geminiUsed(false)
                    .components(components)
                    .message("Local Shadowing AI sẵn sàng (" + device + ").")
                    .build();
        } catch (Exception ex) {
            log.debug("Shadowing AI health check unreachable: {}", ex.getMessage());
            return unavailableStatus("Không thể kết nối tới Local Shadowing AI server.");
        }
    }

    private void ensureEnabled() {
        if (!properties.isEnabled()) {
            throw new AppException(
                    ErrorCode.AI_UNAVAILABLE,
                    "Dịch vụ Local Shadowing AI đang bị tắt trong cấu hình hệ thống."
            );
        }
    }

    private void addAudioPart(
            MultipartBodyBuilder builder, String partName, byte[] bytes, String filename, String contentType
    ) {
        String safeName = (filename != null && !filename.isBlank()) ? filename : "recording.webm";
        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (contentType != null && !contentType.isBlank()) {
            try {
                mediaType = MediaType.parseMediaType(contentType.split(";")[0].trim());
            } catch (Exception ignored) {
            }
        }
        ByteArrayResource resource = new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return safeName;
            }
        };
        builder.part(partName, resource).contentType(mediaType);
    }

    private <T> T postMultipart(String uri, MultipartBodyBuilder builder, Class<T> responseType) {
        int timeoutSec = Math.max(10, properties.getTimeoutSeconds());
        try {
            T result = webClient.post()
                    .uri(uri)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(builder.build()))
                    .retrieve()
                    .bodyToMono(responseType)
                    .block(Duration.ofSeconds(timeoutSec));

            if (result == null) {
                throw new AppException(ErrorCode.AI_BAD_RESPONSE, "AI Shadowing Server không trả về dữ liệu đánh giá.");
            }
            return result;
        } catch (AppException e) {
            throw e;
        } catch (WebClientResponseException e) {
            throw mapServerError(e);
        } catch (WebClientRequestException e) {
            log.warn("Shadowing AI server unreachable on {}: {}", uri, e.getMessage());
            throw new AppException(
                    ErrorCode.AI_UNAVAILABLE,
                    "Không thể kết nối tới máy chủ Shadowing AI cục bộ. Vui lòng khởi động dịch vụ AI hoặc thử lại sau."
            );
        } catch (Exception e) {
            if (hasTimeoutCause(e)) {
                log.warn("Shadowing AI request timed out on {} after {}s", uri, timeoutSec);
                throw new AppException(
                        ErrorCode.AI_UNAVAILABLE,
                        "Máy chủ Shadowing AI xử lý quá thời gian cho phép (" + timeoutSec + " giây). Vui lòng thử câu ngắn hơn hoặc thử lại."
                );
            }
            log.error("Unexpected Shadowing AI client error on {}: {}", uri, e.getMessage());
            throw new AppException(
                    ErrorCode.AI_UNAVAILABLE,
                    "Lỗi kết nối khi phân tích phát âm bằng Local AI."
            );
        }
    }

    private AppException mapServerError(WebClientResponseException e) {
        int status = e.getStatusCode().value();
        String msg = null;
        try {
            String body = e.getResponseBodyAsString();
            if (body != null && !body.isBlank()) {
                JsonNode node = objectMapper.readTree(body);
                msg = node.path("message").asText(node.path("detail").asText(null));
            }
        } catch (Exception ignored) {
        }

        if (status == 413) {
            return new AppException(ErrorCode.FILE_TOO_LARGE, msg != null ? msg : "File âm thanh vượt quá dung lượng cho phép.");
        }
        if (status == 415) {
            return new AppException(ErrorCode.UNSUPPORTED_FILE_TYPE, msg != null ? msg : "Định dạng file âm thanh không được hỗ trợ.");
        }
        if (status >= 400 && status < 500) {
            return new AppException(ErrorCode.VALIDATION_ERROR, msg != null ? msg : "Dữ liệu ghi âm không hợp lệ.");
        }
        log.warn("Shadowing AI server returned HTTP {}: {}", status, msg);
        return new AppException(ErrorCode.AI_UNAVAILABLE, msg != null ? msg : "Máy chủ Shadowing AI gặp lỗi xử lý nội bộ.");
    }

    private boolean hasTimeoutCause(Throwable t) {
        Throwable cur = t;
        while (cur != null) {
            if (cur instanceof TimeoutException
                    || cur.getClass().getSimpleName().toLowerCase().contains("timeout")) {
                return true;
            }
            cur = cur.getCause();
        }
        return false;
    }

    private ShadowingAiStatusDto unavailableStatus(String message) {
        return ShadowingAiStatusDto.builder()
                .enabled(true)
                .available(false)
                .status("UNAVAILABLE")
                .geminiUsed(false)
                .message(message)
                .build();
    }
}
