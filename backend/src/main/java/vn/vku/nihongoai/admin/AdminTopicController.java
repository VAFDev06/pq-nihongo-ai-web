package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.DeckRepository;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.shadowing.ShadowingLessonRepository;
import vn.vku.nihongoai.vocab.Topic;
import vn.vku.nihongoai.vocab.TopicRepository;
import vn.vku.nihongoai.vocab.dto.TopicDto;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/topics")
@RequiredArgsConstructor
@Tag(name = "Admin Topics", description = "Quản lý Chủ đề học tập độc lập cho Bộ thẻ mẫu và Shadowing")
public class AdminTopicController {

    private final TopicRepository topicRepository;
    private final DeckRepository deckRepository;
    private final ShadowingLessonRepository shadowingLessonRepository;
    private final AuditService auditService;

    @GetMapping
    @Transactional(readOnly = true)
    @Operation(summary = "Lấy tất cả chủ đề kèm số lượng bộ thẻ và bài Shadowing đang sử dụng")
    public ApiResponse<List<TopicDto>> getAll() {
        List<TopicDto> list = topicRepository.findAll().stream()
                .map(t -> TopicDto.from(
                        t,
                        deckRepository.countByTopicId(t.getId()),
                        shadowingLessonRepository.countByTopicId(t.getId())
                ))
                .toList();
        return ApiResponse.ok(list);
    }

    @PostMapping
    @Transactional
    @Operation(summary = "Tạo chủ đề mới")
    public ApiResponse<TopicDto> create(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @Valid @RequestBody TopicDto dto
    ) {
        if (dto.getNameVi() == null || dto.getNameVi().isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tên chủ đề không được để trống");
        }
        String status = (dto.getStatus() != null && !dto.getStatus().isBlank())
                ? dto.getStatus().trim().toUpperCase()
                : (Boolean.FALSE.equals(dto.getIsActive()) ? "INACTIVE" : "ACTIVE");

        Topic topic = Topic.builder()
                .nameVi(dto.getNameVi().trim())
                .nameJa(dto.getNameJa() != null ? dto.getNameJa().trim() : null)
                .description(dto.getDescription() != null ? dto.getDescription().trim() : null)
                .jlptLevel(dto.getJlptLevel())
                .status(status)
                .isActive(!"INACTIVE".equalsIgnoreCase(status))
                .build();

        topic = topicRepository.save(topic);
        auditService.log(admin.getId(), "CREATE_TOPIC", "TOPIC", topic.getId(), dto);
        return ApiResponse.ok(TopicDto.from(topic, 0, 0), "Tạo chủ đề thành công");
    }

    @PutMapping("/{id}")
    @Transactional
    @Operation(summary = "Chỉnh sửa thông tin chủ đề")
    public ApiResponse<TopicDto> update(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @Valid @RequestBody TopicDto dto
    ) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề"));

        if (dto.getNameVi() == null || dto.getNameVi().isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tên chủ đề không được để trống");
        }

        topic.setNameVi(dto.getNameVi().trim());
        topic.setNameJa(dto.getNameJa() != null ? dto.getNameJa().trim() : null);
        topic.setDescription(dto.getDescription() != null ? dto.getDescription().trim() : null);
        topic.setJlptLevel(dto.getJlptLevel());
        if (dto.getStatus() != null && !dto.getStatus().isBlank()) {
            String st = dto.getStatus().trim().toUpperCase();
            topic.setStatus(st);
            topic.setIsActive(!"INACTIVE".equalsIgnoreCase(st));
        } else if (dto.getIsActive() != null) {
            topic.setIsActive(dto.getIsActive());
            topic.setStatus(dto.getIsActive() ? "ACTIVE" : "INACTIVE");
        }

        topic = topicRepository.save(topic);
        auditService.log(admin.getId(), "UPDATE_TOPIC", "TOPIC", topic.getId(), dto);
        return ApiResponse.ok(
                TopicDto.from(topic, deckRepository.countByTopicId(id), shadowingLessonRepository.countByTopicId(id)),
                "Cập nhật chủ đề thành công"
        );
    }

    @PatchMapping("/{id}/status")
    @Transactional
    @Operation(summary = "Bật/tắt trạng thái chủ đề (ACTIVE / INACTIVE)")
    public ApiResponse<TopicDto> toggleStatus(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề"));

        String nextStatus;
        if (body.get("status") != null) {
            nextStatus = body.get("status").toString().trim().toUpperCase();
        } else if (body.get("isActive") != null) {
            boolean active = Boolean.parseBoolean(body.get("isActive").toString());
            nextStatus = active ? "ACTIVE" : "INACTIVE";
        } else {
            nextStatus = "ACTIVE".equalsIgnoreCase(topic.getStatus()) ? "INACTIVE" : "ACTIVE";
        }

        topic.setStatus(nextStatus);
        topic.setIsActive(!"INACTIVE".equalsIgnoreCase(nextStatus));
        topic = topicRepository.save(topic);
        auditService.log(admin.getId(), "UPDATE_TOPIC_STATUS", "TOPIC", id, body);
        return ApiResponse.ok(
                TopicDto.from(topic, deckRepository.countByTopicId(id), shadowingLessonRepository.countByTopicId(id)),
                "Cập nhật trạng thái chủ đề thành công"
        );
    }

    @DeleteMapping("/{id}")
    @Transactional
    @Operation(summary = "Xóa an toàn chủ đề (chặn xóa nếu đang gắn với bộ thẻ hoặc bài Shadowing)")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id
    ) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề"));

        long decksUsing = deckRepository.countByTopicId(id);
        long shadowingUsing = shadowingLessonRepository.countByTopicId(id);
        if (decksUsing > 0 || shadowingUsing > 0) {
            throw new AppException(
                    ErrorCode.VALIDATION_ERROR,
                    String.format(
                            "Không thể xóa chủ đề này vì đang được gắn với %d bộ thẻ và %d bài Shadowing. Hãy chuyển trạng thái sang Ẩn (INACTIVE) thay vì xóa.",
                            decksUsing, shadowingUsing
                    )
            );
        }

        topicRepository.delete(topic);
        auditService.log(admin.getId(), "DELETE_TOPIC", "TOPIC", id, null);
        return ApiResponse.ok(null, "Xóa chủ đề thành công");
    }
}
