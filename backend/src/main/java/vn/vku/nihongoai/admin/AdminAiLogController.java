package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vku.nihongoai.ai.AiCallLog;
import vn.vku.nihongoai.ai.AiCallLogRepository;
import vn.vku.nihongoai.ai.AiCallStatus;
import vn.vku.nihongoai.ai.AiFeature;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.PageMeta;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/ai-logs")
@RequiredArgsConstructor
@Tag(name = "Admin AI Logs", description = "Giám sát nhật ký gọi Gemini AI, độ trễ và tỉ lệ lỗi")
public class AdminAiLogController {

    private final AiCallLogRepository aiCallLogRepository;

    @GetMapping
    @Operation(summary = "Tra cứu và lọc danh sách log gọi AI")
    public ApiResponse<List<AiCallLog>> getLogs(
            @RequestParam(required = false) AiFeature feature,
            @RequestParam(required = false) AiCallStatus status,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Instant fromTime = from != null ? from : Instant.EPOCH;
        Instant toTime = to != null ? to : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS);
        Page<AiCallLog> page = aiCallLogRepository.searchLogs(feature, status, fromTime, toTime, pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @GetMapping("/summary")
    @Operation(summary = "Lấy thống kê tóm tắt: tổng lượt gọi, độ trễ trung bình, tỷ lệ lỗi")
    public ApiResponse<Map<String, Object>> getSummary() {
        long total = aiCallLogRepository.count();
        Double avgLatency = aiCallLogRepository.getAverageLatency();
        double latency = avgLatency != null ? Math.round(avgLatency) : 0.0;

        return ApiResponse.ok(Map.of(
                "totalCalls", total,
                "averageLatencyMs", latency,
                "status", "ACTIVE"
        ));
    }
}
