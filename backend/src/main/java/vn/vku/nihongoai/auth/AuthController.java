package vn.vku.nihongoai.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.auth.dto.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.security.UserDetailsImpl;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Đăng ký, đăng nhập, làm mới token, quên và đặt lại mật khẩu")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Đăng ký tài khoản người dùng mới")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request), "Đăng ký tài khoản thành công");
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập và nhận cặp accessToken / refreshToken")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request), "Đăng nhập thành công");
    }

    @PostMapping("/refresh")
    @Operation(summary = "Làm mới access token bằng refresh token (xoay vòng token)")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok(authService.refresh(request), "Làm mới phiên đăng nhập thành công");
    }

    @PostMapping("/logout")
    @Operation(summary = "Đăng xuất và thu hồi refresh token")
    public ApiResponse<Void> logout(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        if (userDetails != null) {
            authService.logout(userDetails.getId());
        }
        return ApiResponse.ok(null, "Đăng xuất thành công");
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Yêu cầu đặt lại mật khẩu qua email")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ApiResponse.ok(null, "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi");
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Đặt lại mật khẩu mới bằng mã xác nhận")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.ok(null, "Đặt lại mật khẩu thành công");
    }
}
