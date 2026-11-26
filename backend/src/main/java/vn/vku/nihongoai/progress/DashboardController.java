package vn.vku.nihongoai.progress;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.progress.dto.DailyStatChartDto;
import vn.vku.nihongoai.progress.dto.DashboardProgressDto;
import vn.vku.nihongoai.progress.dto.WeakItemsSummaryDto;
import vn.vku.nihongoai.security.UserDetailsImpl;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/progress", "/api/v1/dashboard"})
@RequiredArgsConstructor
@Tag(name = "Progress Dashboard", description = "Thống kê tiến độ học tập, biểu đồ hoạt động và các điểm yếu cần cải thiện")
public class DashboardController {

    private final ProgressService progressService;

    @GetMapping({"/dashboard", "/stats"})
    @Operation(summary = "Lấy các số liệu tổng quan trên màn hình Dashboard người dùng")
    public ApiResponse<DashboardProgressDto> getDashboard(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ApiResponse.ok(progressService.getDashboard(userDetails.getId()));
    }

    @GetMapping("/chart")
    @Operation(summary = "Lấy chuỗi dữ liệu theo ngày để hiển thị biểu đồ học tập (7d, 30d, 90d)")
    public ApiResponse<List<DailyStatChartDto>> getChart(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false, defaultValue = "7d") String range
    ) {
        return ApiResponse.ok(progressService.getChart(userDetails.getId(), range));
    }

    @GetMapping("/weak-items")
    @Operation(summary = "Lấy danh sách các thẻ hay quên, bài Shadowing điểm thấp và lỗi ngữ pháp lặp lại")
    public ApiResponse<WeakItemsSummaryDto> getWeakItems(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ApiResponse.ok(progressService.getWeakItems(userDetails.getId()));
    }
}
