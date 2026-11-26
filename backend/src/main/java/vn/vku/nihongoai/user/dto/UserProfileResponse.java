package vn.vku.nihongoai.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.user.Role;
import vn.vku.nihongoai.user.Status;
import vn.vku.nihongoai.user.User;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    private Long id;
    private String email;
    private String fullName;
    private String avatarUrl;
    private Role role;
    private JlptLevel jlptLevel;
    private Status status;
    private Integer dailyGoalCards;
    private java.math.BigDecimal ttsSpeed;
    private Integer aiDailyLimit;
    private Instant lastLoginAt;
    private Instant createdAt;

    public static UserProfileResponse from(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole())
                .jlptLevel(user.getJlptLevel())
                .status(user.getStatus())
                .dailyGoalCards(user.getDailyGoalCards())
                .ttsSpeed(user.getTtsSpeed() != null ? user.getTtsSpeed() : new java.math.BigDecimal("1.15"))
                .aiDailyLimit(user.getAiDailyLimit())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }

    public JlptLevel getTargetJlptLevel() {
        return this.jlptLevel;
    }

    public Integer getDailyTargetCards() {
        return this.dailyGoalCards;
    }
}
