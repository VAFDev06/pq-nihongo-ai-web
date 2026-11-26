package vn.vku.nihongoai.flashcard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.dto.*;
import vn.vku.nihongoai.security.UserDetailsImpl;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/srs")
@RequiredArgsConstructor
@Tag(name = "SRS Study", description = "Hệ thống ôn tập ngắt quãng SRS 6 cấp độ (Level 0 đến Level 5)")
public class SrsController {

    private final SrsService srsService;

    @GetMapping("/due")
    @Operation(summary = "Lấy danh sách các thẻ cần ôn (mặc định Level 1..4 đến hạn; hỗ trợ includeNew=true hoặc filter=NEW/DUE_AND_NEW)")
    public ApiResponse<List<SrsDueCardDto>> getDueCards(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) Long deckId,
            @RequestParam(required = false, defaultValue = "100") Integer limit,
            @RequestParam(required = false, defaultValue = "false") boolean includeNew,
            @RequestParam(required = false) String filter
    ) {
        return ApiResponse.ok(srsService.getDueCards(userDetails.getId(), deckId, limit, includeNew, filter));
    }

    @GetMapping("/decks/{deckId}/relearn")
    @Operation(summary = "Chế độ Học lại bộ thẻ (SET_RELEARN): lấy toàn bộ thẻ trong bộ (kể cả Level 5) mà không làm mất lịch sử hay tạo trùng")
    public ApiResponse<List<SrsDueCardDto>> getRelearnDeckCards(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long deckId
    ) {
        return ApiResponse.ok(srsService.getRelearnDeckCards(userDetails.getId(), deckId));
    }

    @GetMapping("/overview")
    @Operation(summary = "Lấy dữ liệu Tổng quan SRS: biểu đồ phân bố Level 0..5, danh sách bộ thẻ và bảng từ vựng đang học")
    public ApiResponse<SrsOverviewDto> getOverview(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) Long deckId,
            @RequestParam(required = false, defaultValue = "ALL") String filter
    ) {
        return ApiResponse.ok(srsService.getOverview(userDetails.getId(), deckId, filter));
    }

    @GetMapping({"/stats", "/summary"})
    @Operation(summary = "Lấy thống kê SRS 6 cấp độ đồng bộ 100% với Dashboard (Tổng số thẻ, Đã nhớ Level 5, Đến hạn hôm nay Level 1..4)")
    public ApiResponse<SrsStatsDto> getStats(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) Long deckId
    ) {
        return ApiResponse.ok(srsService.getStats(userDetails.getId(), deckId));
    }

    @GetMapping("/history")
    @Operation(summary = "Lấy lịch sử các lần ôn tập SRS (hỗ trợ lọc theo ngày/tuần/tháng, từ vựng và cấp độ)")
    public ApiResponse<List<ReviewLogDto>> getHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false) Long deckId,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false, defaultValue = "30d") String range,
            @RequestParam(required = false) String q
    ) {
        return ApiResponse.ok(srsService.getReviewHistory(userDetails.getId(), deckId, rating, range, q));
    }

    @PostMapping("/review")
    @Operation(summary = "Gửi đánh giá cấp độ SRS (Level 1..5) cho 1 thẻ (hỗ trợ cả DUE_REVIEW và SET_RELEARN)")
    public ApiResponse<SrsDueCardDto> reviewCard(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody ReviewCardRequest request
    ) {
        return ApiResponse.ok(srsService.processReview(userDetails.getId(), request), "Đã cập nhật cấp độ SRS");
    }

    @PatchMapping("/cards/{flashcardId}/level")
    @Operation(summary = "Cập nhật trực tiếp cấp độ SRS (Level 0..5) từ bảng Tổng quan SRS")
    public ApiResponse<SrsDueCardDto> updateCardLevel(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long flashcardId,
            @RequestBody Map<String, Integer> body
    ) {
        Integer level = body.getOrDefault("srsLevel", body.get("level"));
        if (level == null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng chọn cấp độ SRS từ 0 đến 5");
        }
        return ApiResponse.ok(srsService.updateCardLevelManually(userDetails.getId(), flashcardId, level), "Đã đổi cấp độ thẻ thành công");
    }
}
