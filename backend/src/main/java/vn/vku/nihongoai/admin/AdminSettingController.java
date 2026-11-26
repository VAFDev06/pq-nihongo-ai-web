package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserRepository;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin Settings & Audit", description = "Quản lý cấu hình hệ thống (Model AI, hạn mức) và xem nhật ký thao tác")
public class AdminSettingController {

    private final SystemSettingRepository systemSettingRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @GetMapping("/settings")
    @Operation(summary = "Lấy danh sách tất cả các cấu hình hệ thống")
    public ApiResponse<List<SystemSetting>> getSettings() {
        return ApiResponse.ok(systemSettingRepository.findAll());
    }

    @PutMapping("/settings")
    @Operation(summary = "Cập nhật hàng loạt cấu hình hệ thống")
    public ApiResponse<List<SystemSetting>> updateBulkSettings(
            @AuthenticationPrincipal UserDetailsImpl adminDetails,
            @RequestBody List<Map<String, String>> settingsList
    ) {
        User admin = userRepository.findById(adminDetails.getId()).orElse(null);
        List<SystemSetting> updated = new java.util.ArrayList<>();
        for (Map<String, String> item : settingsList) {
            String key = item.get("settingKey");
            if (key == null) key = item.get("key");
            String value = item.get("settingValue");
            if (value == null) value = item.get("value");
            if (key != null && value != null) {
                SystemSetting s = systemSettingRepository.findById(key).orElse(null);
                if (s != null) {
                    s.setValue(value);
                    s.setUpdatedBy(admin);
                    updated.add(systemSettingRepository.save(s));
                }
            }
        }
        return ApiResponse.ok(updated, "Cập nhật cấu hình thành công");
    }

    @PutMapping("/settings/{key}")
    @Operation(summary = "Cập nhật giá trị cấu hình hệ thống (Ví dụ: tên model Gemini, hạn mức ngày)")
    public ApiResponse<SystemSetting> updateSetting(
            @AuthenticationPrincipal UserDetailsImpl adminDetails,
            @PathVariable String key,
            @RequestBody Map<String, String> body
    ) {
        SystemSetting setting = systemSettingRepository.findById(key)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy khóa cấu hình: " + key));

        String value = body.get("value");
        if (value == null || value.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Giá trị cấu hình không được để trống");
        }

        User admin = userRepository.findById(adminDetails.getId()).orElse(null);
        setting.setValue(value.trim());
        setting.setUpdatedBy(admin);
        setting = systemSettingRepository.save(setting);

        auditService.log(adminDetails.getId(), "UPDATE_SYSTEM_SETTING", "SETTING", null, Map.of(key, value));
        return ApiResponse.ok(setting, "Cập nhật cấu hình thành công");
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "Xem nhật ký kiểm tra audit logs các thao tác của quản trị viên")
    public ApiResponse<List<AuditLog>> getAuditLogs(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<AuditLog> page = auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }
}
