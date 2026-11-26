package vn.vku.nihongoai.flashcard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import vn.vku.nihongoai.flashcard.DeckStatus;
import vn.vku.nihongoai.user.JlptLevel;

@Data
public class CreateDeckRequest {
    @NotBlank(message = "Tên bộ thẻ không được để trống")
    @Size(max = 150, message = "Tên bộ thẻ tối đa 150 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"name", "title"})
    private String name;

    @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
    private String description;

    private JlptLevel jlptLevel;
    private Long topicId;
    private String coverImageUrl;
    private DeckStatus status;
    private Boolean isPublic = false;
}
