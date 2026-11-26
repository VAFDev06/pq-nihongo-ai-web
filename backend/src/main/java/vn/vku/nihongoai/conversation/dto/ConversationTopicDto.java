package vn.vku.nihongoai.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.conversation.ConversationTopic;
import vn.vku.nihongoai.user.JlptLevel;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationTopicDto {
    private Long id;
    private String nameVi;
    private String nameJa;
    private String description;
    private String icon;
    private JlptLevel jlptLevel;
    private String aiRole;
    private String userRole;
    private Long createdBy;
    private boolean isPersonal;

    public static ConversationTopicDto from(ConversationTopic topic) {
        return ConversationTopicDto.builder()
                .id(topic.getId())
                .nameVi(topic.getNameVi())
                .nameJa(topic.getNameJa())
                .description(topic.getDescription())
                .icon(topic.getIcon())
                .jlptLevel(topic.getJlptLevel())
                .aiRole(topic.getAiRole())
                .userRole(topic.getUserRole())
                .createdBy(topic.getCreatedBy())
                .isPersonal(topic.getCreatedBy() != null)
                .build();
    }

    public String getTitle() {
        return this.nameVi;
    }
}
