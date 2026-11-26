package vn.vku.nihongoai.conversation.dto;

import lombok.Data;
import vn.vku.nihongoai.user.JlptLevel;

@Data
public class StartConversationRequest {
    private Long topicId;
    private JlptLevel jlptLevel;
    private String levelMode; // N5, N4, N3, N2, N1, FREE
    private String tutorMode; // FREE_CONVERSATION, ROLEPLAY, DAILY_JAPANESE, INTERVIEW, BUSINESS_JAPANESE, JLPT_PRACTICE, TEACHER_MODE
    private String chatMode;  // CHAT, VOICE

    // Cho phép khởi tạo nhanh hoặc tạo chủ đề cá nhân
    private String customTitle;
    private String customScenario;
    private String aiRole;
    private String userRole;
    private Boolean saveTopic;
}
