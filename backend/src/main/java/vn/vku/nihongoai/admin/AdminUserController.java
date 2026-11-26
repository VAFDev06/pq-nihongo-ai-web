package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.common.PageMeta;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.user.Role;
import vn.vku.nihongoai.user.Status;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserRepository;
import vn.vku.nihongoai.user.dto.UserProfileResponse;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin Users", description = "Quản lý người dùng, khóa tài khoản, phân quyền và cấp hạn mức AI")
public class AdminUserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    @GetMapping
    @Operation(summary = "Tìm kiếm và phân trang danh sách người dùng")
    public ApiResponse<List<UserProfileResponse>> getUsers(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) Status status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        String raw = (q != null && !q.isBlank()) ? q : search;
        String query = (raw != null && !raw.isBlank()) ? raw.trim() : "";
        Page<UserProfileResponse> page = userRepository.searchUsers(query, role, status, pageable)
                .map(UserProfileResponse::from);
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy thông tin chi tiết một người dùng")
    public ApiResponse<UserProfileResponse> getUserDetail(@PathVariable Long id) {
        User user = getUserOrThrow(id);
        return ApiResponse.ok(UserProfileResponse.from(user));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Khóa hoặc mở khóa tài khoản người dùng")
    public ApiResponse<UserProfileResponse> updateStatus(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        if (admin.getId().equals(id)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Không thể tự khóa tài khoản quản trị viên đang đăng nhập");
        }
        User user = getUserOrThrow(id);
        String statusStr = body.getOrDefault("status", "ACTIVE");
        Status status = Status.valueOf(statusStr);
        user.setStatus(status);
        user = userRepository.save(user);

        auditService.log(admin.getId(), status == Status.LOCKED ? "LOCK_USER" : "UNLOCK_USER", "USER", user.getId(), body);
        return ApiResponse.ok(UserProfileResponse.from(user), "Cập nhật trạng thái thành công");
    }

    @PatchMapping("/{id}/role")
    @Operation(summary = "Thay đổi quyền hạn tài khoản (USER hoặc ADMIN)")
    public ApiResponse<UserProfileResponse> updateRole(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        if (admin.getId().equals(id)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Không thể tự thay đổi quyền của chính mình");
        }
        User user = getUserOrThrow(id);
        String roleStr = body.getOrDefault("role", "USER");
        Role role = Role.valueOf(roleStr);
        user.setRole(role);
        user = userRepository.save(user);

        auditService.log(admin.getId(), "CHANGE_USER_ROLE", "USER", user.getId(), body);
        return ApiResponse.ok(UserProfileResponse.from(user), "Cập nhật quyền thành công");
    }

    @PostMapping("/{id}/reset-password")
    @Operation(summary = "Quản trị viên đặt lại mật khẩu mới cho người dùng")
    public ApiResponse<Void> resetPassword(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        User user = getUserOrThrow(id);
        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.length() < 8) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Mật khẩu mới tối thiểu 8 ký tự");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        auditService.log(admin.getId(), "ADMIN_RESET_PASSWORD", "USER", user.getId(), null);
        return ApiResponse.ok(null, "Đặt lại mật khẩu thành công");
    }

    @PatchMapping("/{id}/ai-limit")
    @Operation(summary = "Cấp hạn mức lượt gọi AI tùy chỉnh cho người dùng")
    public ApiResponse<UserProfileResponse> updateAiLimit(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, Integer> body
    ) {
        User user = getUserOrThrow(id);
        Integer limit = body.get("aiDailyLimit");
        user.setAiDailyLimit(limit);
        user = userRepository.save(user);

        auditService.log(admin.getId(), "UPDATE_AI_LIMIT", "USER", user.getId(), body);
        return ApiResponse.ok(UserProfileResponse.from(user), "Cập nhật hạn mức AI thành công");
    }

    private User getUserOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy người dùng với ID: " + id));
    }
}
