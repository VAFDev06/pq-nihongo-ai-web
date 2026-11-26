package vn.vku.nihongoai.furigana;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vku.nihongoai.common.ApiResponse;

import java.util.List;

@RestController
@RequestMapping("/api/v1/furigana")
@RequiredArgsConstructor
@Tag(name = "Furigana", description = "Tách từ và sinh cách đọc Furigana cho văn bản tiếng Nhật bằng Kuromoji")
public class FuriganaController {

    private final FuriganaService furiganaService;

    @PostMapping
    @Operation(summary = "Sinh furigana cho chuỗi tiếng Nhật (trả về mảng token surface, reading, hasKanji)")
    public ApiResponse<List<FuriganaToken>> generate(@Valid @RequestBody FuriganaRequest request) {
        return ApiResponse.ok(furiganaService.generateFurigana(request.getText()));
    }
}
