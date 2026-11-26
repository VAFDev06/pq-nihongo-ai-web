package vn.vku.nihongoai.vocab.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BulkSaveVocabRequest {
    @NotEmpty(message = "Danh sách từ cần lưu không được để trống")
    @Valid
    private List<CreateUserVocabRequest> items;
}
