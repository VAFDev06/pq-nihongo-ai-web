package vn.vku.nihongoai.vocab;

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
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.vocab.dto.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/vocab")
@RequiredArgsConstructor
@Tag(name = "Vocabulary Notebook", description = "Quản lý sổ từ vựng cá nhân và tra cứu từ vựng hệ thống")
public class VocabController {

    private final UserVocabularyService userVocabularyService;
    private final VocabularyService vocabularyService;

    @GetMapping({"/mine", "/my"})
    @Operation(summary = "Lấy danh sách từ trong sổ từ vựng cá nhân")
    public ApiResponse<List<UserVocabularyDto>> getMyVocab(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean isMastered,
            @RequestParam(required = false) VocabSource source,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<UserVocabularyDto> page = userVocabularyService.searchMyVocab(userDetails.getId(), q, isMastered, source, pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @GetMapping({"/mine/saved-keys", "/my/saved-keys"})
    @Operation(summary = "Lấy danh sách ID và từ vựng đã lưu trong sổ cá nhân để đồng bộ trạng thái nút Lưu")
    public ApiResponse<Map<String, Object>> getSavedVocabKeys(
            @AuthenticationPrincipal UserDetailsImpl userDetails
    ) {
        return ApiResponse.ok(userVocabularyService.getSavedSystemVocabKeys(userDetails.getId()));
    }

    @PostMapping({"/mine", "/my"})
    @Operation(summary = "Thêm một từ vào sổ từ cá nhân (thủ công)")
    public ApiResponse<UserVocabularyDto> addMyVocab(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody CreateUserVocabRequest request
    ) {
        return ApiResponse.ok(userVocabularyService.addVocab(userDetails.getId(), request), "Thêm từ thành công");
    }

    @PostMapping({"/mine/bulk", "/my/bulk"})
    @Operation(summary = "Lưu nhiều từ vào sổ từ cá nhân (từ nhận diện AI hoặc import)")
    public ApiResponse<List<UserVocabularyDto>> addBulkMyVocab(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody BulkSaveVocabRequest request
    ) {
        int requested = request.getItems() != null ? request.getItems().size() : 0;
        List<UserVocabularyDto> saved = userVocabularyService.addBulk(userDetails.getId(), request);
        int duplicate = Math.max(0, requested - saved.size());
        String msg = duplicate > 0
                ? String.format("Đã lưu thành công %d từ mới (%d từ đã tồn tại trong sổ)", saved.size(), duplicate)
                : String.format("Đã lưu thành công %d từ vào sổ từ vựng cá nhân", saved.size());
        return ApiResponse.ok(saved, msg);
    }

    @PostMapping({"/mine/add-to-srs", "/my/add-to-srs"})
    @Operation(summary = "Thêm các từ đã chọn hoặc toàn bộ sổ từ vựng cá nhân vào hệ thống ôn tập SRS")
    public ApiResponse<Map<String, Object>> addVocabToSrs(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody Map<String, Object> body
    ) {
        Map<String, Object> result = userVocabularyService.addToSrs(userDetails.getId(), body);
        int added = (int) result.getOrDefault("addedCount", 0);
        int existing = (int) result.getOrDefault("existingCount", 0);
        String msg = existing > 0
                ? String.format("Đã thêm %d từ mới vào SRS (%d từ đã tồn tại trong SRS)", added, existing)
                : String.format("Đã thêm thành công %d từ vào hệ thống ôn tập SRS", added);
        return ApiResponse.ok(result, msg);
    }

    @PutMapping({"/mine/{id}", "/my/{id}"})
    @Operation(summary = "Chỉnh sửa thông tin từ trong sổ cá nhân")
    public ApiResponse<UserVocabularyDto> updateMyVocab(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserVocabRequest request
    ) {
        return ApiResponse.ok(userVocabularyService.updateVocab(userDetails.getId(), id, request), "Cập nhật từ thành công");
    }

    @PatchMapping({"/mine/{id}/mastered", "/my/{id}/mastered"})
    @Operation(summary = "Đánh dấu từ đã thuộc hoặc chưa thuộc")
    public ApiResponse<UserVocabularyDto> setMastered(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        Boolean isMastered = body.getOrDefault("isMastered", true);
        return ApiResponse.ok(userVocabularyService.setMastered(userDetails.getId(), id, isMastered), "Cập nhật trạng thái thành công");
    }

    @DeleteMapping({"/mine/{id}", "/my/{id}"})
    @Operation(summary = "Xóa từ khỏi sổ từ vựng cá nhân")
    public ApiResponse<Void> deleteMyVocab(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        userVocabularyService.deleteVocab(userDetails.getId(), id);
        return ApiResponse.ok(null, "Xóa từ thành công");
    }

    @GetMapping({"", "/system"})
    @Operation(summary = "Tra cứu danh sách từ vựng hệ thống (chuẩn JLPT)")
    public ApiResponse<List<VocabularyDto>> searchSystemVocab(
            @RequestParam(required = false) JlptLevel level,
            @RequestParam(required = false) Long topicId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "word", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        Page<VocabularyDto> page = vocabularyService.searchSystemVocab(level, topicId, q, pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @PostMapping("/system/{id}/save")
    @Operation(summary = "Sao chép một từ hệ thống vào sổ từ cá nhân")
    public ApiResponse<UserVocabularyDto> copyToMyVocab(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(userVocabularyService.copyFromSystem(userDetails.getId(), id), "Đã lưu từ vào sổ từ cá nhân");
    }
}
