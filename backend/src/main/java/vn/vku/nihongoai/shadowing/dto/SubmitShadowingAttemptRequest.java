package vn.vku.nihongoai.shadowing.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SubmitShadowingAttemptRequest {
    @NotBlank(message = "Nội dung nhận diện không được để trống")
    @com.fasterxml.jackson.annotation.JsonAlias({"recognizedText", "transcriptUser", "userText", "transcript"})
    private String recognizedText;

    private Long lineId;
    private String expectedTextJa;
    private String audioBase64;
    private BigDecimal playbackSpeed = new BigDecimal("1.00");
}
