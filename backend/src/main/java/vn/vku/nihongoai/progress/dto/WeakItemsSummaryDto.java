package vn.vku.nihongoai.progress.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.conversation.dto.WeakPointDto;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeakItemsSummaryDto {
    private List<String> weakCards;           // Từ hay quên (lapses cao)
    private List<String> weakShadowingLessons;// Bài Shadowing điểm thấp
    private List<WeakPointDto> weakGrammar;   // Lỗi ngữ pháp hay gặp
}
