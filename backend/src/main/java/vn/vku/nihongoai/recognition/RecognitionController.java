package vn.vku.nihongoai.recognition;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.common.PageMeta;
import vn.vku.nihongoai.recognition.dto.RecognitionResponse;
import vn.vku.nihongoai.security.UserDetailsImpl;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/recognitions")
@RequiredArgsConstructor
@Tag(name = "Image Recognition", description = "Nhận diện đồ vật qua ảnh và sinh từ vựng tiếng Nhật bằng Gemini AI")
public class RecognitionController {

    private final RecognitionService recognitionService;

    @PostMapping(value = {"", "/upload"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải ảnh lên để nhận diện từ vựng tiếng Nhật bằng Gemini AI")
    public ApiResponse<RecognitionResponse> recognize(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "jlptLevel", required = false) String jlptLevel,
            @RequestParam(value = "topicHint", required = false) String topicHint
    ) {
        MultipartFile uploadFile = file != null ? file : image;
        if (uploadFile == null || uploadFile.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng chọn tệp ảnh tải lên");
        }
        return ApiResponse.ok(recognitionService.recognizeImage(userDetails.getId(), uploadFile, jlptLevel, topicHint));
    }

    @GetMapping
    @Operation(summary = "Lấy lịch sử các lần nhận diện ảnh của người dùng")
    public ApiResponse<List<RecognitionResponse>> getHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<RecognitionResponse> page = recognitionService.getHistory(userDetails.getId(), pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @PatchMapping("/{id}/feedback")
    @Operation(summary = "Gửi đánh giá đúng/sai cho kết quả AI nhận diện")
    public ApiResponse<Void> submitFeedback(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        boolean isCorrect = body.getOrDefault("isCorrect", true);
        recognitionService.submitFeedback(userDetails.getId(), id, isCorrect);
        return ApiResponse.ok(null, "Cảm ơn bạn đã đóng góp đánh giá");
    }
}
