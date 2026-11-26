package vn.vku.nihongoai.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;
import vn.vku.nihongoai.user.JlptLevel;

@Data
public class UpdateProfileRequest {
    @Size(min = 2, max = 100, message = "Họ tên từ 2 đến 100 ký tự")
    private String fullName;

    @Size(max = 500, message = "URL ảnh đại diện tối đa 500 ký tự")
    private String avatarUrl;

    @JsonAlias({"targetJlptLevel", "jlptLevel"})
    private JlptLevel jlptLevel;

    @Min(value = 5, message = "Mục tiêu tối thiểu 5 thẻ mỗi ngày")
    @Max(value = 200, message = "Mục tiêu tối đa 200 thẻ mỗi ngày")
    @JsonAlias({"dailyTargetCards", "dailyGoalCards"})
    private Integer dailyGoalCards;

    private java.math.BigDecimal ttsSpeed;
}
