package vn.vku.nihongoai.vocab.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import vn.vku.nihongoai.vocab.VocabSource;

@Data
public class CreateUserVocabRequest {
    @NotBlank(message = "Từ tiếng Nhật không được để trống")
    @Size(max = 100, message = "Từ tối đa 100 ký tự")
    @JsonAlias({"word", "japaneseText", "surface"})
    private String word;

    @Size(max = 150, message = "Cách đọc tối đa 150 ký tự")
    private String reading;

    @Size(max = 150, message = "Romaji tối đa 150 ký tự")
    private String romaji;

    @NotBlank(message = "Nghĩa tiếng Việt không được để trống")
    @Size(max = 500, message = "Nghĩa tiếng Việt tối đa 500 ký tự")
    @JsonAlias({"meaningVi", "vietnameseMeaning", "meaning"})
    private String meaningVi;

    @Size(max = 50, message = "Từ loại tối đa 50 ký tự")
    private String partOfSpeech;

    @Size(max = 150, message = "Hán Việt tối đa 150 ký tự")
    @JsonAlias({"hanViet", "sinoVietnamese", "han_viet"})
    private String hanViet;

    @Size(max = 10, message = "Cấp độ JLPT tối đa 10 ký tự")
    private String jlptLevel;

    @Size(max = 500, message = "Ví dụ tiếng Nhật tối đa 500 ký tự")
    @JsonAlias({"exampleJa", "exampleSentence", "example"})
    private String exampleJa;

    @Size(max = 500, message = "Dịch nghĩa ví dụ tối đa 500 ký tự")
    @JsonAlias({"exampleVi", "exampleMeaning"})
    private String exampleVi;

    @Size(max = 500, message = "Cách đọc ví dụ tối đa 500 ký tự")
    @JsonAlias({"exampleReading", "exampleHiragana"})
    private String exampleReading;

    @Size(max = 500, message = "URL hình ảnh tối đa 500 ký tự")
    private String imageUrl;

    @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự")
    private String note;

    private VocabSource source = VocabSource.MANUAL;
}
