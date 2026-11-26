package vn.vku.nihongoai.vocab.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.vocab.Topic;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopicDto {
    private Long id;
    private String nameVi;
    private String nameJa;
    private String description;
    private JlptLevel jlptLevel;
    private String status;
    private Boolean isActive;
    private long deckCount;
    private long shadowingCount;
    private Instant createdAt;
    private Instant updatedAt;

    public static TopicDto from(Topic topic) {
        return from(topic, 0, 0);
    }

    public static TopicDto from(Topic topic, long deckCount, long shadowingCount) {
        String st = topic.getStatus();
        if (st == null || st.isBlank()) {
            st = Boolean.FALSE.equals(topic.getIsActive()) ? "INACTIVE" : "ACTIVE";
        }
        return TopicDto.builder()
                .id(topic.getId())
                .nameVi(topic.getNameVi())
                .nameJa(topic.getNameJa())
                .description(topic.getDescription())
                .jlptLevel(topic.getJlptLevel())
                .status(st)
                .isActive(!"INACTIVE".equalsIgnoreCase(st))
                .deckCount(deckCount)
                .shadowingCount(shadowingCount)
                .createdAt(topic.getCreatedAt())
                .updatedAt(topic.getUpdatedAt())
                .build();
    }
}
