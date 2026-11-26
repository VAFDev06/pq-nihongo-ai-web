package vn.vku.nihongoai.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import vn.vku.nihongoai.admin.SystemSetting;
import vn.vku.nihongoai.admin.SystemSettingRepository;
import vn.vku.nihongoai.common.Constants;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.user.Role;
import vn.vku.nihongoai.user.Status;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserRepository;
import vn.vku.nihongoai.vocab.Topic;
import vn.vku.nihongoai.vocab.TopicRepository;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final TopicRepository topicRepository;
    private final PasswordEncoder passwordEncoder;

    @org.springframework.beans.factory.annotation.Value("${app.admin.email:admin@nihongoai.local}")
    private String adminEmail;

    @org.springframework.beans.factory.annotation.Value("${app.admin.password:admin123}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        String cleanAdminEmail = (adminEmail != null && !adminEmail.isBlank())
                ? adminEmail.trim().toLowerCase()
                : "admin@nihongoai.local";
        String cleanAdminPwd = (adminPassword != null && !adminPassword.isBlank())
                ? adminPassword
                : "admin123";

        // 1. Ensure default Admin user exists from environment variables
        if (!userRepository.existsByEmail(cleanAdminEmail)) {
            User admin = User.builder()
                    .email(cleanAdminEmail)
                    .passwordHash(passwordEncoder.encode(cleanAdminPwd))
                    .fullName("Quản trị viên hệ thống")
                    .role(Role.ADMIN)
                    .jlptLevel(JlptLevel.N1)
                    .status(Status.ACTIVE)
                    .dailyGoalCards(50)
                    .build();
            userRepository.save(admin);
            log.info("Initialized default admin user: {}. Please change the default password after first login.", cleanAdminEmail);
        }

        // 1b. Ensure default regular User exists for testing learning flows
        if (!userRepository.existsByEmail("user@nihongoai.local")) {
            User user = User.builder()
                    .email("user@nihongoai.local")
                    .passwordHash(passwordEncoder.encode("user1234"))
                    .fullName("Nguyễn Văn Học Viên")
                    .role(Role.USER)
                    .jlptLevel(JlptLevel.N5)
                    .status(Status.ACTIVE)
                    .dailyGoalCards(20)
                    .build();
            userRepository.save(user);
            log.info("Initialized default regular user: user@nihongoai.local");
        }

        // 2. Ensure basic system settings exist
        initSetting(Constants.SETTING_AI_MODEL_VISION, "gemini-3-flash-preview", "Model Gemini cho nhận diện ảnh");
        initSetting(Constants.SETTING_AI_MODEL_CHAT, "gemini-3-flash-preview", "Model Gemini cho hội thoại");
        initSetting(Constants.SETTING_AI_DAILY_LIMIT, "30", "Số lượt gọi AI mỗi người mỗi ngày");
        initSetting(Constants.SETTING_AI_TIMEOUT, "30", "Timeout gọi Gemini");

        // 3. Ensure default topics exist if empty
        if (topicRepository.count() == 0) {
            topicRepository.saveAll(List.of(
                    Topic.builder().nameVi("Đồ dùng trong nhà").nameJa("家の物").description("Từ vựng về các vật dụng hàng ngày trong nhà").isActive(true).build(),
                    Topic.builder().nameVi("Đồ ăn thức uống").nameJa("食べ物・飲み物").description("Ẩm thực, món ăn và đồ uống Nhật Bản").isActive(true).build(),
                    Topic.builder().nameVi("Trường học").nameJa("学校").description("Môi trường học tập và lớp học").isActive(true).build(),
                    Topic.builder().nameVi("Giao thông").nameJa("交通").description("Phương tiện di chuyển, tàu điện và đường phố").isActive(true).build(),
                    Topic.builder().nameVi("Thiên nhiên").nameJa("自然").description("Thời tiết, khí hậu và phong cảnh").isActive(true).build(),
                    Topic.builder().nameVi("Công việc").nameJa("仕事").description("Môi trường văn phòng và phỏng vấn").isActive(true).build()
            ));
            log.info("Initialized default topics");
        }
    }

    private void initSetting(String key, String defaultValue, String description) {
        if (!systemSettingRepository.existsById(key)) {
            systemSettingRepository.save(SystemSetting.builder()
                    .key(key)
                    .value(defaultValue)
                    .description(description)
                    .build());
        }
    }
}
