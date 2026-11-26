package vn.vku.nihongoai.flashcard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateFlashcardRequest {
    @NotBlank(message = "Mặt trước (từ tiếng Nhật) không được để trống")
    @Size(max = 200, message = "Mặt trước tối đa 200 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"front", "japaneseText", "word"})
    private String front;

    @Size(max = 200, message = "Cách đọc tối đa 200 ký tự")
    private String reading;

    @NotBlank(message = "Mặt sau (nghĩa tiếng Việt) không được để trống")
    @Size(max = 500, message = "Mặt sau tối đa 500 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"back", "vietnameseMeaning", "meaningVi"})
    private String back;

    @Size(max = 50, message = "Từ loại tối đa 50 ký tự")
    private String partOfSpeech;

    @Size(max = 150, message = "Hán Việt tối đa 150 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"hanViet", "sinoVietnamese", "han_viet"})
    private String hanViet;

    @Size(max = 500, message = "Ví dụ tiếng Nhật tối đa 500 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"exampleJa", "exampleSentence"})
    private String exampleJa;

    @Size(max = 500, message = "Dịch ví dụ tối đa 500 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"exampleVi", "exampleMeaning"})
    private String exampleVi;

    @Size(max = 500, message = "Cách đọc ví dụ tối đa 500 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"exampleReading", "exampleHiragana"})
    private String exampleReading;

    @Size(max = 500, message = "URL hình ảnh tối đa 500 ký tự")
    private String imageUrl;

    @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự")
    @com.fasterxml.jackson.annotation.JsonAlias({"note", "notes", "romaji"})
    private String note;
}
