package vn.vku.nihongoai.recognition;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.ai.AiQuotaService;
import vn.vku.nihongoai.ai.GeminiClient;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.recognition.dto.RecognitionResponse;
import vn.vku.nihongoai.recognition.dto.RecognizedItemDto;
import vn.vku.nihongoai.storage.StorageService;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;

import java.io.IOException;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecognitionService {

    private final ImageRecognitionRepository imageRecognitionRepository;
    private final GeminiClient geminiClient;
    private final AiQuotaService aiQuotaService;
    private final StorageService storageService;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    @org.springframework.context.annotation.Lazy
    private final vn.vku.nihongoai.progress.ProgressService progressService;

    @Transactional
    public RecognitionResponse recognizeImage(Long userId, MultipartFile file) {
        return recognizeImage(userId, file, null, null);
    }

    @Transactional
    public RecognitionResponse recognizeImage(Long userId, MultipartFile file, String requestedLevel, String topicHint) {
        if (file.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tệp ảnh tải lên rỗng");
        }
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new AppException(ErrorCode.FILE_TOO_LARGE, "Dung lượng ảnh tối đa 10MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !(contentType.equalsIgnoreCase("image/jpeg") ||
                                     contentType.equalsIgnoreCase("image/jpg") ||
                                     contentType.equalsIgnoreCase("image/png") ||
                                     contentType.equalsIgnoreCase("image/webp"))) {
            throw new AppException(ErrorCode.UNSUPPORTED_FILE_TYPE, "Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WEBP");
        }

        // 1. Kiểm tra hạn mức AI của người dùng
        aiQuotaService.checkQuota(userId);
        User user = userService.getUserOrThrow(userId);

        // 2. Lưu ảnh vào thư mục local
        String imageUrl = storageService.storeFile(file, "recog");

        // 3. Chuyển ảnh sang Base64 để gửi Gemini
        String base64Image;
        try {
            base64Image = Base64.getEncoder().encodeToString(file.getBytes());
        } catch (IOException e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Không thể xử lý dữ liệu tệp ảnh");
        }

        String targetLevel = (requestedLevel != null && !requestedLevel.isBlank())
                ? requestedLevel.trim().toUpperCase()
                : user.getJlptLevel().name();

        // 4. Gọi Gemini Vision API
        long start = System.currentTimeMillis();
        JsonNode resultNode = geminiClient.generateVisionJson(
                user, base64Image, contentType, targetLevel, topicHint);
        int latency = (int) (System.currentTimeMillis() - start);

        String rawOcrText = resultNode.path("rawOcrText").asText(null);
        List<RecognizedItemDto> items = List.of();
        String resultJson = "[]";
        try {
            JsonNode itemsNode = resultNode.path("items");
            if (itemsNode.isArray()) {
                items = objectMapper.convertValue(itemsNode, new TypeReference<List<RecognizedItemDto>>() {});
                resultJson = objectMapper.writeValueAsString(items);
            }
        } catch (Exception e) {
            log.warn("Failed to parse recognized items: {}", e.getMessage());
        }

        // 5. Lưu kết quả nhận diện vào DB
        String activeModel = geminiClient.resolveActiveModel(vn.vku.nihongoai.common.Constants.SETTING_AI_MODEL_VISION);
        ImageRecognition recognition = ImageRecognition.builder()
                .user(user)
                .imageUrl(imageUrl)
                .resultJson(resultJson)
                .model(activeModel)
                .latencyMs(latency)
                .build();

        recognition = imageRecognitionRepository.save(recognition);

        if (progressService != null) {
            progressService.recordActivity(userId, "RECOGNITION", 1);
        }

        return RecognitionResponse.builder()
                .recognitionId(recognition.getId())
                .imageUrl(recognition.getImageUrl())
                .rawOcrText(rawOcrText)
                .items(items)
                .isCorrect(recognition.getIsCorrect())
                .createdAt(recognition.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<RecognitionResponse> getHistory(Long userId, Pageable pageable) {
        return imageRecognitionRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public void submitFeedback(Long userId, Long id, boolean isCorrect) {
        ImageRecognition recognition = imageRecognitionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bản ghi nhận diện"));
        recognition.setIsCorrect(isCorrect);
        imageRecognitionRepository.save(recognition);
    }

    private RecognitionResponse toResponse(ImageRecognition r) {
        List<RecognizedItemDto> items = List.of();
        try {
            items = objectMapper.readValue(r.getResultJson(), new TypeReference<List<RecognizedItemDto>>() {});
        } catch (Exception ignored) {}

        return RecognitionResponse.builder()
                .recognitionId(r.getId())
                .imageUrl(r.getImageUrl())
                .items(items)
                .isCorrect(r.getIsCorrect())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
