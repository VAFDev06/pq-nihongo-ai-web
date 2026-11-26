package vn.vku.nihongoai.conversation.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SendConversationMessageRequest {
    @NotBlank(message = "Nội dung tin nhắn không được để trống")
    @Size(max = 500, message = "Tin nhắn tối đa 500 ký tự")
    @JsonAlias({"text", "content", "message"})
    private String text;

    private String messageType; // CHAT | TUTOR_QUESTION
    private String levelMode;   // Optional override N5..N1 or FREE
    private String tutorMode;   // Optional override tutorMode
}
