package vn.vku.nihongoai.admin;

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
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.common.PageMeta;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.vocab.Topic;
import vn.vku.nihongoai.vocab.TopicRepository;
import vn.vku.nihongoai.vocab.Vocabulary;
import vn.vku.nihongoai.vocab.VocabularyRepository;
import vn.vku.nihongoai.vocab.dto.VocabularyDto;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/vocab")
@RequiredArgsConstructor
@Tag(name = "Admin Vocabulary", description = "Quản lý từ vựng hệ thống dành cho quản trị viên")
public class AdminVocabController {

    private final VocabularyRepository vocabularyRepository;
    private final TopicRepository topicRepository;
    private final AuditService auditService;

    @GetMapping
    @Operation(summary = "Danh sách từ vựng hệ thống")
    public ApiResponse<List<VocabularyDto>> getVocab(
            @RequestParam(required = false) JlptLevel level,
            @RequestParam(required = false) JlptLevel jlptLevel,
            @RequestParam(required = false) Long topicId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        JlptLevel targetLevel = level != null ? level : jlptLevel;
        String raw = (q != null && !q.isBlank()) ? q : search;
        String query = (raw != null && !raw.isBlank()) ? raw.trim() : "";
        Page<VocabularyDto> page = vocabularyRepository.searchAllSystemVocabForAdmin(targetLevel, topicId, query, pageable)
                .map(VocabularyDto::from);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @PostMapping
    @Operation(summary = "Thêm từ vựng mới vào hệ thống")
    public ApiResponse<VocabularyDto> createVocab(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @Valid @RequestBody VocabularyDto dto
    ) {
        Topic topic = dto.getTopicId() != null ? topicRepository.findById(dto.getTopicId()).orElse(null) : null;

        Vocabulary v = Vocabulary.builder()
                .word(dto.getWord().trim())
                .reading(dto.getReading() != null ? dto.getReading().trim() : null)
                .romaji(dto.getRomaji() != null ? dto.getRomaji().trim() : null)
                .meaningVi(dto.getMeaningVi().trim())
                .partOfSpeech(dto.getPartOfSpeech())
                .hanViet(dto.getHanViet() != null ? dto.getHanViet().trim() : null)
                .jlptLevel(dto.getJlptLevel())
                .topic(topic)
                .exampleJa(dto.getExampleJa())
                .exampleVi(dto.getExampleVi())
                .exampleReading(dto.getExampleReading())
                .imageUrl(dto.getImageUrl())
                .isActive(true)
                .build();

        v = vocabularyRepository.save(v);
        auditService.log(admin.getId(), "CREATE_SYSTEM_VOCAB", "VOCABULARY", v.getId(), dto);
        return ApiResponse.ok(VocabularyDto.from(v), "Thêm từ vựng hệ thống thành công");
    }

    @PutMapping("/{id}")
    @Operation(summary = "Chỉnh sửa từ vựng hệ thống")
    public ApiResponse<VocabularyDto> updateVocab(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @Valid @RequestBody VocabularyDto dto
    ) {
        Vocabulary v = vocabularyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy từ vựng"));

        v.setWord(dto.getWord().trim());
        v.setReading(dto.getReading() != null ? dto.getReading().trim() : null);
        v.setRomaji(dto.getRomaji() != null ? dto.getRomaji().trim() : null);
        v.setMeaningVi(dto.getMeaningVi().trim());
        v.setPartOfSpeech(dto.getPartOfSpeech());
        v.setHanViet(dto.getHanViet() != null ? dto.getHanViet().trim() : null);
        v.setJlptLevel(dto.getJlptLevel());
        if (dto.getTopicId() != null) {
            Topic topic = topicRepository.findById(dto.getTopicId()).orElse(null);
            v.setTopic(topic);
        }
        v.setExampleJa(dto.getExampleJa());
        v.setExampleVi(dto.getExampleVi());
        v.setExampleReading(dto.getExampleReading());
        v.setImageUrl(dto.getImageUrl());

        v = vocabularyRepository.save(v);
        auditService.log(admin.getId(), "UPDATE_SYSTEM_VOCAB", "VOCABULARY", v.getId(), dto);
        return ApiResponse.ok(VocabularyDto.from(v), "Cập nhật từ vựng thành công");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa từ vựng hệ thống")
    public ApiResponse<Void> deleteVocab(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id
    ) {
        Vocabulary v = vocabularyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy từ vựng"));

        vocabularyRepository.delete(v);
        auditService.log(admin.getId(), "DELETE_SYSTEM_VOCAB", "VOCABULARY", id, null);
        return ApiResponse.ok(null, "Xóa từ vựng thành công");
    }

    @PatchMapping("/{id}/active")
    @Operation(summary = "Bật hoặc tắt trạng thái hoạt động của từ vựng")
    public ApiResponse<VocabularyDto> toggleActive(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        Vocabulary v = vocabularyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy từ vựng"));

        boolean active = body.getOrDefault("isActive", true);
        v.setIsActive(active);
        v = vocabularyRepository.save(v);

        auditService.log(admin.getId(), "TOGGLE_VOCAB_ACTIVE", "VOCABULARY", id, body);
        return ApiResponse.ok(VocabularyDto.from(v), "Cập nhật trạng thái thành công");
    }
}
