package vn.vku.nihongoai.shadowing.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomShadowingRequest {

    @NotBlank(message = "Câu tiếng Nhật không được để trống")
    @JsonAlias({"textJa", "japaneseText", "originalText"})
    private String textJa;

    @JsonAlias({"textVi", "vietnameseText", "meaningVi"})
    private String textVi;

    @NotBlank(message = "Nội dung nhận diện giọng nói không được để trống")
    @JsonAlias({"recognizedText", "transcript", "userSpeech"})
    private String recognizedText;

    @Builder.Default
    private BigDecimal playbackSpeed = new BigDecimal("1.00");
}
