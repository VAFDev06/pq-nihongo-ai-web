package vn.vku.nihongoai.shadowing;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
import vn.vku.nihongoai.common.PageMeta;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.shadowing.ai.ShadowingAiService;
import vn.vku.nihongoai.shadowing.dto.ShadowingAiStatusDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingAttemptDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingLessonDto;
import vn.vku.nihongoai.shadowing.dto.SubmitShadowingAttemptRequest;
import vn.vku.nihongoai.user.JlptLevel;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/shadowing")
@RequiredArgsConstructor
@Tag(name = "Shadowing Practice", description = "Luyện nói lặp lại Shadowing với câu mẫu và chấm điểm tự động")
public class ShadowingController {

    private final ShadowingService shadowingService;
    private final ShadowingAiService shadowingAiService;

    @GetMapping("/ai-status")
    @Operation(summary = "Kiểm tra trạng thái máy chủ Local Shadowing AI (không sử dụng Gemini)")
    public ApiResponse<ShadowingAiStatusDto> getAiStatus() {
        return ApiResponse.ok(shadowingAiService.getStatus());
    }

    @PostMapping(value = "/evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Đánh giá file ghi âm Shadowing bằng Local AI (Qwen3-ASR, ForcedAligner, hatsuon, F0 Intonation + Kuromoji)")
    public ApiResponse<ShadowingEvaluationResultDto> evaluateAudio(
            @RequestPart("audio") MultipartFile audio,
            @RequestParam("referenceText") String referenceText,
            @RequestPart(value = "referenceAudio", required = false) MultipartFile referenceAudio,
            @RequestParam(value = "jlptLevel", required = false) String jlptLevel,
            @RequestParam(value = "fallbackTranscript", required = false) String fallbackTranscript
    ) {
        return ApiResponse.ok(
                shadowingAiService.evaluateAudioOnly(audio, referenceText, referenceAudio, jlptLevel, fallbackTranscript),
                "Đánh giá phát âm Shadowing bằng Local AI thành công"
        );
    }

    @PostMapping(value = "/lessons/{id}/evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Gửi file ghi âm bài luyện Shadowing để chấm điểm phát âm, mora, trọng âm và ngữ điệu bằng Local AI")
    public ApiResponse<ShadowingAttemptDto> evaluateLessonAudio(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @RequestPart("audio") MultipartFile audio,
            @RequestPart(value = "referenceAudio", required = false) MultipartFile referenceAudio,
            @RequestParam(value = "lineId", required = false) Long lineId,
            @RequestParam(value = "expectedTextJa", required = false) String expectedTextJa,
            @RequestParam(value = "playbackSpeed", required = false, defaultValue = "1.00") BigDecimal playbackSpeed,
            @RequestParam(value = "fallbackTranscript", required = false) String fallbackTranscript
    ) {
        return ApiResponse.ok(
                shadowingAiService.evaluateLessonAttempt(
                        userDetails.getId(), id, audio, referenceAudio, lineId, expectedTextJa, playbackSpeed, fallbackTranscript
                ),
                "Đánh giá phát âm bằng Local AI thành công"
        );
    }

    @PostMapping(value = "/custom/evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Gửi file ghi âm câu tự nhập / YouTube để chấm điểm phát âm chi tiết bằng Local AI")
    public ApiResponse<ShadowingAttemptDto> evaluateCustomAudio(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestPart("audio") MultipartFile audio,
            @RequestParam("textJa") String textJa,
            @RequestParam(value = "textVi", required = false) String textVi,
            @RequestPart(value = "referenceAudio", required = false) MultipartFile referenceAudio,
            @RequestParam(value = "playbackSpeed", required = false, defaultValue = "1.00") BigDecimal playbackSpeed,
            @RequestParam(value = "jlptLevel", required = false) String jlptLevel,
            @RequestParam(value = "fallbackTranscript", required = false) String fallbackTranscript
    ) {
        return ApiResponse.ok(
                shadowingAiService.evaluateCustomAttempt(
                        userDetails.getId(), audio, textJa, textVi, referenceAudio, playbackSpeed, jlptLevel, fallbackTranscript
                ),
                "Đánh giá phát âm câu tự nhập bằng Local AI thành công"
        );
    }

    @GetMapping("/lessons")
    @Operation(summary = "Lấy danh sách các bài luyện Shadowing")
    public ApiResponse<List<ShadowingLessonDto>> getLessons(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) JlptLevel level,
            @RequestParam(required = false) Long topicId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        Page<ShadowingLessonDto> page = shadowingService.searchLessons(level, topicId, q, userDetails.getId(), pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @GetMapping("/lessons/{id}")
    @Operation(summary = "Lấy chi tiết một bài luyện Shadowing")
    public ApiResponse<ShadowingLessonDto> getLessonDetail(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(shadowingService.getLessonDetail(id, userDetails.getId()));
    }

    @PostMapping({"/lessons/{id}/attempts", "/lessons/{id}/attempt"})
    @Operation(summary = "Gửi kết quả ghi âm nhận diện giọng nói để server chấm điểm và so sánh từ")
    public ApiResponse<ShadowingAttemptDto> submitAttempt(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody SubmitShadowingAttemptRequest request
    ) {
        return ApiResponse.ok(shadowingService.submitAttempt(userDetails.getId(), id, request), "Chấm điểm thành công");
    }

    @PostMapping({"/custom-score", "/custom/attempt", "/practice-custom"})
    @Operation(summary = "Luyện Shadowing với bất kỳ câu tự nhập và chấm điểm so sánh từ")
    public ApiResponse<ShadowingAttemptDto> submitCustomAttempt(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody vn.vku.nihongoai.shadowing.dto.CustomShadowingRequest request
    ) {
        return ApiResponse.ok(shadowingService.scoreCustomSentence(userDetails.getId(), request), "Chấm điểm câu tự nhập thành công");
    }

    @PostMapping({"/custom/translate", "/custom-translate"})
    @Operation(summary = "Tách câu và dịch ĐẦY ĐỦ toàn bộ nhiều câu tiếng Nhật tự nhập kèm Hiragana")
    public ApiResponse<java.util.Map<String, Object>> translateCustomSentences(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody java.util.Map<String, String> body
    ) {
        String text = body.getOrDefault("text", body.getOrDefault("textJa", ""));
        Long uid = userDetails != null ? userDetails.getId() : null;
        return ApiResponse.ok(shadowingService.translateCustomSentences(uid, text), "Đã dịch toàn bộ câu tiếng Nhật thành công");
    }

    @GetMapping("/attempts")
    @Operation(summary = "Lấy lịch sử các lần luyện Shadowing của người dùng")
    public ApiResponse<List<ShadowingAttemptDto>> getAttemptsHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) Long lessonId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<ShadowingAttemptDto> page = shadowingService.getAttemptsHistory(userDetails.getId(), lessonId, pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @GetMapping("/attempts/{id}")
    @Operation(summary = "Xem chi tiết một lần luyện tập Shadowing kèm word_diff tô màu")
    public ApiResponse<ShadowingAttemptDto> getAttemptDetail(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(shadowingService.getAttemptDetail(userDetails.getId(), id));
    }

    @GetMapping("/youtube/captions")
    @Operation(summary = "Lấy transcript tiếng Nhật kèm Hiragana & bản dịch tiếng Việt từ PostgreSQL hoặc YouTube + AI")
    public ApiResponse<java.util.Map<String, Object>> getYoutubeCaptions(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam("videoId") String videoId
    ) {
        Long uid = userDetails != null ? userDetails.getId() : null;
        return ApiResponse.ok(shadowingService.fetchYoutubeCaptions(uid, videoId));
    }

    @PostMapping("/youtube/{videoId}/translate-batch")
    @Operation(summary = "Dịch tiếp các câu chưa có bản dịch tiếng Việt của video YouTube và lưu vào PostgreSQL")
    public ApiResponse<java.util.Map<String, Object>> translateYoutubeBatch(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable String videoId,
            @RequestParam(required = false, defaultValue = "45") int batchSize
    ) {
        Long uid = userDetails != null ? userDetails.getId() : null;
        return ApiResponse.ok(shadowingService.translateYoutubePendingBatch(uid, videoId, batchSize));
    }

    @PostMapping("/youtube/{videoId}/sentences/{sentenceId}/retranslate")
    @Operation(summary = "Dịch lại một câu cụ thể trong video YouTube sang tiếng Việt theo ngữ cảnh")
    public ApiResponse<java.util.Map<String, Object>> retranslateYoutubeSentence(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable String videoId,
            @PathVariable Long sentenceId
    ) {
        Long uid = userDetails != null ? userDetails.getId() : null;
        return ApiResponse.ok(shadowingService.retranslateYoutubeSentence(uid, videoId, sentenceId), "Đã dịch lại câu thành công");
    }

    @PostMapping("/youtube/parse-subtitles")
    @Operation(summary = "Phân tích nội dung phụ đề SRT/VTT kèm timestamp, tự động sinh Hiragana & dịch tiếng Việt")
    public ApiResponse<java.util.List<java.util.Map<String, Object>>> parseSubtitles(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody java.util.Map<String, String> body
    ) {
        String content = body.getOrDefault("content", "");
        String videoId = body.getOrDefault("videoId", "");
        Long uid = userDetails != null ? userDetails.getId() : null;
        java.util.Map<String, Object> result = shadowingService.parseAndTranslateSubtitles(uid, videoId, content);
        @SuppressWarnings("unchecked")
        java.util.List<java.util.Map<String, Object>> segments = (java.util.List<java.util.Map<String, Object>>) result.get("segments");
        return ApiResponse.ok(segments, "Đã phân tích phụ đề và dịch tiếng Việt thành công");
    }
}
