package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.conversation.ConversationTopic;
import vn.vku.nihongoai.conversation.ConversationTopicRepository;
import vn.vku.nihongoai.security.UserDetailsImpl;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/v1/admin/conversation-topics", "/api/v1/admin/conversations/topics"})
@RequiredArgsConstructor
@Tag(name = "Admin Conversation Topics", description = "Quản lý chủ đề và kịch bản System Prompt cho AI hội thoại")
public class AdminConversationTopicController {

    private final ConversationTopicRepository topicRepository;
    private final AuditService auditService;

    @GetMapping
    @Operation(summary = "Lấy tất cả các chủ đề hội thoại và prompt hệ thống")
    public ApiResponse<List<ConversationTopic>> getAll() {
        return ApiResponse.ok(topicRepository.findAll());
    }

    @PostMapping
    @Operation(summary = "Tạo chủ đề hội thoại kèm kịch bản AI mới")
    public ApiResponse<ConversationTopic> create(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @Valid @RequestBody ConversationTopic topic
    ) {
        topic.setIsActive(true);
        topic = topicRepository.save(topic);
        auditService.log(admin.getId(), "CREATE_CONV_TOPIC", "CONVERSATION_TOPIC", topic.getId(), topic.getNameVi());
        return ApiResponse.ok(topic, "Tạo chủ đề hội thoại thành công");
    }

    @PutMapping("/{id}")
    @Operation(summary = "Chỉnh sửa chủ đề hoặc sửa kịch bản System Prompt của AI")
    public ApiResponse<ConversationTopic> update(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @Valid @RequestBody ConversationTopic updated
    ) {
        ConversationTopic topic = topicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề hội thoại"));

        topic.setNameVi(updated.getNameVi());
        topic.setNameJa(updated.getNameJa());
        topic.setDescription(updated.getDescription());
        topic.setIcon(updated.getIcon());
        topic.setJlptLevel(updated.getJlptLevel());
        topic.setSystemPrompt(updated.getSystemPrompt());
        if (updated.getIsActive() != null) topic.setIsActive(updated.getIsActive());

        topic = topicRepository.save(topic);
        auditService.log(admin.getId(), "UPDATE_CONV_TOPIC", "CONVERSATION_TOPIC", topic.getId(), topic.getNameVi());
        return ApiResponse.ok(topic, "Cập nhật chủ đề hội thoại thành công");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa chủ đề hội thoại")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id
    ) {
        ConversationTopic topic = topicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề hội thoại"));

        topicRepository.delete(topic);
        auditService.log(admin.getId(), "DELETE_CONV_TOPIC", "CONVERSATION_TOPIC", id, null);
        return ApiResponse.ok(null, "Xóa chủ đề thành công");
    }

    @PatchMapping("/{id}/active")
    @Operation(summary = "Bật hoặc tắt trạng thái chủ đề hội thoại")
    public ApiResponse<ConversationTopic> toggleActive(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        ConversationTopic topic = topicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề hội thoại"));

        boolean active = body.getOrDefault("isActive", true);
        topic.setIsActive(active);
        topic = topicRepository.save(topic);

        auditService.log(admin.getId(), "TOGGLE_CONV_TOPIC_ACTIVE", "CONVERSATION_TOPIC", id, body);
        return ApiResponse.ok(topic, "Cập nhật trạng thái thành công");
    }
}
