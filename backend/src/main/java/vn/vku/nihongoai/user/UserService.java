package vn.vku.nihongoai.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.storage.StorageService;
import vn.vku.nihongoai.user.dto.ChangePasswordRequest;
import vn.vku.nihongoai.user.dto.UpdateProfileRequest;
import vn.vku.nihongoai.user.dto.UserProfileResponse;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final StorageService storageService;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(Long userId) {
        User user = getUserOrThrow(userId);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = getUserOrThrow(userId);

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl().trim());
        }
        if (request.getJlptLevel() != null) {
            user.setJlptLevel(request.getJlptLevel());
        }
        if (request.getDailyGoalCards() != null) {
            user.setDailyGoalCards(request.getDailyGoalCards());
        }
        if (request.getTtsSpeed() != null) {
            double spd = request.getTtsSpeed().doubleValue();
            if (spd >= 0.5 && spd <= 2.0) {
                user.setTtsSpeed(request.getTtsSpeed());
            }
        }

        user = userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = getUserOrThrow(userId);

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS, "Mật khẩu cũ không chính xác");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public UserProfileResponse uploadAvatar(Long userId, MultipartFile file) {
        User user = getUserOrThrow(userId);
        if (file.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tệp ảnh tải lên trống");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new AppException(ErrorCode.FILE_TOO_LARGE, "Ảnh đại diện không được vượt quá 5MB");
        }
        String ct = file.getContentType();
        if (ct == null || !(ct.equalsIgnoreCase("image/jpeg") || ct.equalsIgnoreCase("image/jpg")
                || ct.equalsIgnoreCase("image/png") || ct.equalsIgnoreCase("image/webp"))) {
            throw new AppException(ErrorCode.UNSUPPORTED_FILE_TYPE, "Chỉ hỗ trợ định dạng ảnh JPG, PNG hoặc WEBP");
        }

        String path = storageService.storeFile(file, "avatars");
        user.setAvatarUrl(path);
        user = userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    public User getUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy người dùng với ID: " + userId));
    }
}
