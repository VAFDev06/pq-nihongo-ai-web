package vn.vku.nihongoai.conversation;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.PageMeta;
import vn.vku.nihongoai.conversation.dto.*;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.vocab.dto.CreateUserVocabRequest;
import vn.vku.nihongoai.vocab.dto.UserVocabularyDto;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "AI Conversation", description = "Luyện hội thoại giọng nói 1-1 với Gemini AI theo chủ đề và sửa lỗi ngữ pháp")
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping({"/conversation/topics", "/conversations/topics"})
    @Operation(summary = "Lấy danh sách các chủ đề hội thoại (hỗ trợ lọc theo trình độ JLPT N5..N1 hoặc ALL)")
    public ApiResponse<List<ConversationTopicDto>> getTopics(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) String level
    ) {
        if (userDetails != null) {
            return ApiResponse.ok(conversationService.getTopicsForUser(userDetails.getId(), level));
        }
        return ApiResponse.ok(conversationService.getActiveTopics(level));
    }

    @PostMapping({"/conversation/topics", "/conversations/topics", "/conversations/topics/custom"})
    @Operation(summary = "Tạo chủ đề hội thoại cá nhân mới")
    public ApiResponse<ConversationTopicDto> createPersonalTopic(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody java.util.Map<String, Object> body
    ) {
        return ApiResponse.ok(conversationService.createPersonalTopic(userDetails.getId(), body), "Đã tạo chủ đề hội thoại cá nhân");
    }

    @DeleteMapping({"/conversation/topics/{id}", "/conversations/topics/{id}", "/conversations/topics/custom/{id}"})
    @Operation(summary = "Xóa chủ đề hội thoại cá nhân")
    public ApiResponse<Void> deletePersonalTopic(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        conversationService.deletePersonalTopic(userDetails.getId(), id);
        return ApiResponse.ok(null, "Đã xóa chủ đề hội thoại cá nhân");
    }

    @PostMapping({"/conversations", "/conversations/start"})
    @Operation(summary = "Khởi tạo phòng hội thoại mới với AI (AI gửi câu mở đầu)")
    public ApiResponse<ConversationDetailDto> startConversation(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody StartConversationRequest request
    ) {
        return ApiResponse.ok(conversationService.createConversation(userDetails.getId(), request), "Bắt đầu hội thoại thành công");
    }

    @PostMapping("/conversations/{id}/messages")
    @Operation(summary = "Gửi tin nhắn của người học đến AI, nhận câu trả lời, sửa lỗi ngữ pháp và 2-3 câu gợi ý trả lời tiếp theo")
    public ApiResponse<AiMessageResponse> sendMessage(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody SendConversationMessageRequest request
    ) {
        return ApiResponse.ok(conversationService.sendMessage(userDetails.getId(), id, request));
    }

    @PostMapping("/conversations/{id}/ask-tutor")
    @Operation(summary = "Hỏi Gia sư AI bằng tiếng Việt ngay trong lúc hội thoại (cách diễn đạt, từ vựng, ngữ pháp)")
    public ApiResponse<AiMessageResponse> askTutor(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body
    ) {
        String question = body.getOrDefault("question", body.getOrDefault("text", ""));
        return ApiResponse.ok(conversationService.askTutorInVietnamese(userDetails.getId(), id, question));
    }

    @PatchMapping("/conversations/{id}/settings")
    @Operation(summary = "Thay đổi trình độ JLPT hoặc chế độ Gia sư ngay trong khi đang hội thoại")
    public ApiResponse<ConversationDetailDto> updateSettings(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> body
    ) {
        return ApiResponse.ok(conversationService.updateConversationSettings(userDetails.getId(), id, body), "Đã cập nhật chế độ hội thoại");
    }

    @PostMapping("/conversations/{id}/end")
    @Operation(summary = "Kết thúc cuộc hội thoại và nhận nhận xét, tóm tắt tổng thể từ AI")
    public ApiResponse<ConversationDetailDto> endConversation(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(conversationService.endConversation(userDetails.getId(), id), "Đã kết thúc cuộc hội thoại");
    }

    @GetMapping({"/conversations", "/conversations/my"})
    @Operation(summary = "Lấy danh sách lịch sử các cuộc hội thoại của người dùng")
    public ApiResponse<List<ConversationDetailDto>> getHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PageableDefault(size = 20, sort = "startedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<ConversationDetailDto> page = conversationService.getHistory(userDetails.getId(), pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @GetMapping("/conversations/{id}")
    @Operation(summary = "Lấy toàn bộ tin nhắn và phân tích lỗi của một cuộc hội thoại")
    public ApiResponse<ConversationDetailDto> getDetail(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(conversationService.getConversationDetail(userDetails.getId(), id));
    }

    @DeleteMapping("/conversations/{id}")
    @Operation(summary = "Xóa một cuộc hội thoại")
    public ApiResponse<Void> deleteConversation(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        conversationService.deleteConversation(userDetails.getId(), id);
        return ApiResponse.ok(null, "Xóa cuộc hội thoại thành công");
    }

    @GetMapping("/conversations/weak-points")
    @Operation(summary = "Thống kê các lỗi ngữ pháp lặp lại nhiều lần của người dùng")
    public ApiResponse<List<WeakPointDto>> getWeakPoints(
            @AuthenticationPrincipal UserDetailsImpl userDetails
    ) {
        return ApiResponse.ok(conversationService.getWeakPoints(userDetails.getId()));
    }

    @PostMapping("/conversations/{id}/messages/{msgId}/save-word")
    @Operation(summary = "Lưu từ vựng xuất hiện trong tin nhắn vào sổ từ cá nhân")
    public ApiResponse<UserVocabularyDto> saveWord(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @PathVariable Long msgId,
            @Valid @RequestBody CreateUserVocabRequest request
    ) {
        return ApiResponse.ok(conversationService.saveWordFromMessage(userDetails.getId(), msgId, request), "Đã lưu từ vào sổ");
    }
}
