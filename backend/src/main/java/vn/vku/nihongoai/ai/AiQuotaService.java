package vn.vku.nihongoai.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vku.nihongoai.admin.SystemSettingRepository;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.Constants;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserRepository;

import java.time.LocalDate;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class AiQuotaService {

    private final AiCallLogRepository aiCallLogRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final UserRepository userRepository;

    public void checkQuota(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        int limit;
        if (user != null && user.getAiDailyLimit() != null) {
            limit = user.getAiDailyLimit();
        } else {
            String defaultLimitStr = systemSettingRepository.getSettingValue(Constants.SETTING_AI_DAILY_LIMIT, "30");
            try {
                limit = Integer.parseInt(defaultLimitStr);
            } catch (NumberFormatException e) {
                limit = 30;
            }
        }

        ZoneId vnZone = ZoneId.of(Constants.TIME_ZONE_VN);
        var startOfDay = LocalDate.now(vnZone).atStartOfDay(vnZone).toInstant();
        long usedToday = aiCallLogRepository.countTodayCallsByUser(userId, startOfDay);

        if (usedToday >= limit) {
            throw new AppException(ErrorCode.AI_QUOTA_EXCEEDED,
                    String.format("Bạn đã dùng hết hạn mức %d lượt gọi AI hôm nay. Vui lòng quay lại vào ngày mai!", limit));
        }
    }
}
