package vn.vku.nihongoai.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.user.dto.ChangePasswordRequest;
import vn.vku.nihongoai.user.dto.UpdateProfileRequest;
import vn.vku.nihongoai.user.dto.UserProfileResponse;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Profile", description = "Quản lý hồ sơ người dùng hiện tại")
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    @Operation(summary = "Lấy thông tin hồ sơ người dùng đang đăng nhập")
    public ApiResponse<UserProfileResponse> getMyProfile(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ApiResponse.ok(userService.getProfile(userDetails.getId()));
    }

    @PutMapping("/me")
    @Operation(summary = "Cập nhật thông tin hồ sơ (họ tên, trình độ JLPT, mục tiêu học)")
    public ApiResponse<UserProfileResponse> updateMyProfile(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ApiResponse.ok(userService.updateProfile(userDetails.getId(), request), "Cập nhật hồ sơ thành công");
    }

    @RequestMapping(value = {"/me/password", "/me/change-password"}, method = {RequestMethod.PUT, RequestMethod.POST})
    @Operation(summary = "Đổi mật khẩu người dùng")
    public ApiResponse<Void> changeMyPassword(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        userService.changePassword(userDetails.getId(), request);
        return ApiResponse.ok(null, "Đổi mật khẩu thành công");
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên ảnh đại diện từ máy tính")
    public ApiResponse<UserProfileResponse> uploadMyAvatar(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "avatar", required = false) MultipartFile avatar
    ) {
        MultipartFile target = file != null ? file : avatar;
        if (target == null || target.isEmpty()) {
            throw new vn.vku.nihongoai.common.AppException(vn.vku.nihongoai.common.ErrorCode.VALIDATION_ERROR, "Vui lòng chọn tệp ảnh đại diện");
        }
        return ApiResponse.ok(userService.uploadAvatar(userDetails.getId(), target), "Tải ảnh đại diện thành công");
    }

    @PatchMapping("/me/tts-speed")
    @Operation(summary = "Cập nhật tốc độ đọc tiếng Nhật (TTS) mặc định của tài khoản")
    public ApiResponse<UserProfileResponse> updateTtsSpeed(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody java.util.Map<String, Object> body
    ) {
        Object val = body.get("ttsSpeed");
        UpdateProfileRequest req = new UpdateProfileRequest();
        if (val != null) {
            req.setTtsSpeed(new java.math.BigDecimal(val.toString()));
        }
        return ApiResponse.ok(userService.updateProfile(userDetails.getId(), req), "Đã lưu tốc độ đọc tiếng Nhật");
    }
}
