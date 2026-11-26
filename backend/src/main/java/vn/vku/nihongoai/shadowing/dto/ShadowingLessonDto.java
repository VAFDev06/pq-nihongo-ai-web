package vn.vku.nihongoai.shadowing.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.shadowing.ShadowingLesson;
import vn.vku.nihongoai.user.JlptLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShadowingLessonDto {
    private Long id;
    private String title;
    private String description;

    @JsonAlias({"textJa", "japaneseText"})
    private String textJa;

    @JsonAlias({"textVi", "vietnameseMeaning"})
    private String textVi;

    private JlptLevel jlptLevel;
    private Long topicId;
    private String topicNameVi;
    private String audioUrl;
    private String coverImageUrl;
    private String status; // DRAFT | PUBLISHED | ARCHIVED
    private Boolean isDialogue;
    private Boolean isActive;
    private Integer lineCount;
    private List<ShadowingDialogueLineDto> lines;
    private BigDecimal bestAccuracy;
    private Instant createdAt;
    private Instant updatedAt;

    public static ShadowingLessonDto from(ShadowingLesson lesson, BigDecimal bestAccuracy) {
        return from(lesson, bestAccuracy, null, 0);
    }

    public static ShadowingLessonDto from(
            ShadowingLesson lesson,
            BigDecimal bestAccuracy,
            List<ShadowingDialogueLineDto> lines,
            int lineCount
    ) {
        String st = lesson.getStatus();
        if (st == null || st.isBlank()) {
            st = Boolean.FALSE.equals(lesson.getIsActive()) ? "ARCHIVED" : "PUBLISHED";
        }
        int effectiveCount = lines != null ? lines.size() : lineCount;
        boolean dialogue = Boolean.TRUE.equals(lesson.getIsDialogue()) || effectiveCount > 1;
        return ShadowingLessonDto.builder()
                .id(lesson.getId())
                .title(lesson.getTitle())
                .description(lesson.getDescription())
                .textJa(lesson.getTextJa())
                .textVi(lesson.getTextVi())
                .jlptLevel(lesson.getJlptLevel())
                .topicId(lesson.getTopic() != null ? lesson.getTopic().getId() : null)
                .topicNameVi(lesson.getTopic() != null ? lesson.getTopic().getNameVi() : null)
                .audioUrl(lesson.getAudioUrl())
                .coverImageUrl(lesson.getCoverImageUrl())
                .status(st)
                .isDialogue(dialogue)
                .isActive(lesson.getIsActive())
                .lineCount(effectiveCount)
                .lines(lines != null ? lines : new ArrayList<>())
                .bestAccuracy(bestAccuracy)
                .createdAt(lesson.getCreatedAt())
                .updatedAt(lesson.getUpdatedAt())
                .build();
    }

    public String getJapaneseText() {
        return this.textJa;
    }

    public String getVietnameseMeaning() {
        return this.textVi;
    }

    public String getTopic() {
        return this.topicNameVi != null ? this.topicNameVi : "Giao tiếp hàng ngày";
    }
}
