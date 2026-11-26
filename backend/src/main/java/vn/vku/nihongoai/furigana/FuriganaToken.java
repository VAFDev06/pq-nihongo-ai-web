package vn.vku.nihongoai.furigana;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FuriganaToken {
    private String surface;
    private String reading;
    private boolean hasKanji;
}
