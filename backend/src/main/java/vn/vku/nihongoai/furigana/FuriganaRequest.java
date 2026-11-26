package vn.vku.nihongoai.furigana;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FuriganaRequest {
    @NotBlank(message = "Nội dung tiếng Nhật không được để trống")
    private String text;
}
