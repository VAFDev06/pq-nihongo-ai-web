package vn.vku.nihongoai.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.auth.dto.*;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.security.JwtService;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.user.Role;
import vn.vku.nihongoai.user.Status;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserRepository;
import vn.vku.nihongoai.user.dto.UserProfileResponse;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new AppException(ErrorCode.DUPLICATE_RESOURCE, "Email đã được đăng ký trong hệ thống");
        }

        User user = User.builder()
                .email(request.getEmail().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .jlptLevel(request.getTargetJlptLevel() != null ? request.getTargetJlptLevel() : vn.vku.nihongoai.user.JlptLevel.N5)
                .role(Role.USER)
                .status(Status.ACTIVE)
                .build();

        user = userRepository.save(user);

        UserDetailsImpl userDetails = UserDetailsImpl.fromUser(user);
        String accessToken = jwtService.generateAccessToken(userDetails);
        String refreshToken = createAndSaveRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(UserProfileResponse.from(user))
                .build();
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS, "Email hoặc mật khẩu không chính xác"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS, "Email hoặc mật khẩu không chính xác");
        }

        if (user.getStatus() == Status.LOCKED) {
            throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED, "Tài khoản của bạn đã bị khóa");
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        UserDetailsImpl userDetails = UserDetailsImpl.fromUser(user);
        String accessToken = jwtService.generateAccessToken(userDetails);
        String refreshToken = createAndSaveRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(UserProfileResponse.from(user))
                .build();
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String tokenHash = JwtService.hashToken(request.getRefreshToken());
        RefreshToken rt = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new AppException(ErrorCode.AUTH_TOKEN_EXPIRED, "Refresh token không hợp lệ hoặc đã hết hạn"));

        if (Boolean.TRUE.equals(rt.getRevoked()) || rt.getExpiresAt().isBefore(Instant.now())) {
            throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED, "Refresh token đã hết hạn hoặc bị thu hồi");
        }

        User user = rt.getUser();
        if (user.getStatus() == Status.LOCKED) {
            throw new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED, "Tài khoản của bạn đã bị khóa");
        }

        // Xoay vòng token: thu hồi token cũ, cấp mới cặp token
        rt.setRevoked(true);
        refreshTokenRepository.save(rt);

        UserDetailsImpl userDetails = UserDetailsImpl.fromUser(user);
        String newAccessToken = jwtService.generateAccessToken(userDetails);
        String newRefreshToken = createAndSaveRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .user(UserProfileResponse.from(user))
                .build();
    }

    @Transactional
    public void logout(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByEmail(request.getEmail().trim().toLowerCase()).ifPresent(user -> {
            String rawToken = UUID.randomUUID().toString();
            String tokenHash = JwtService.hashToken(rawToken);

            PasswordResetToken prt = PasswordResetToken.builder()
                    .user(user)
                    .tokenHash(tokenHash)
                    .expiresAt(Instant.now().plus(30, ChronoUnit.MINUTES))
                    .used(false)
                    .build();

            passwordResetTokenRepository.save(prt);
            // Trong môi trường dev in ra log console
            log.info(">>> [FORGOT PASSWORD] Đặt lại mật khẩu cho {}: Token = {}", user.getEmail(), rawToken);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String tokenHash = JwtService.hashToken(request.getToken());
        PasswordResetToken prt = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new AppException(ErrorCode.VALIDATION_ERROR, "Mã đặt lại mật khẩu không hợp lệ"));

        if (Boolean.TRUE.equals(prt.getUsed()) || prt.getExpiresAt().isBefore(Instant.now())) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Mã đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng");
        }

        User user = prt.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        prt.setUsed(true);
        passwordResetTokenRepository.save(prt);

        // Thu hồi toàn bộ refresh token khi đổi mật khẩu
        refreshTokenRepository.revokeAllByUserId(user.getId());
    }

    private String createAndSaveRefreshToken(User user) {
        String rawToken = UUID.randomUUID().toString() + UUID.randomUUID().toString();
        String tokenHash = JwtService.hashToken(rawToken);

        RefreshToken token = RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(Instant.now().plus(jwtService.getRefreshTokenDays(), ChronoUnit.DAYS))
                .revoked(false)
                .build();

        refreshTokenRepository.save(token);
        return rawToken;
    }
}
