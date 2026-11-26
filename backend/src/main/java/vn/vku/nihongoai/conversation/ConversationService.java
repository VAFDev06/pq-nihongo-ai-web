package vn.vku.nihongoai.conversation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.ai.AiQuotaService;
import vn.vku.nihongoai.ai.GeminiClient;
import vn.vku.nihongoai.ai.PromptTemplates;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.conversation.dto.*;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;
import vn.vku.nihongoai.vocab.UserVocabulary;
import vn.vku.nihongoai.vocab.UserVocabularyRepository;
import vn.vku.nihongoai.vocab.VocabSource;
import vn.vku.nihongoai.vocab.dto.CreateUserVocabRequest;
import vn.vku.nihongoai.vocab.dto.UserVocabularyDto;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationService {

    private final ConversationTopicRepository topicRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final ConversationCorrectionRepository correctionRepository;
    private final UserVocabularyRepository userVocabularyRepository;
    private final GeminiClient geminiClient;
    private final AiQuotaService aiQuotaService;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    @org.springframework.context.annotation.Lazy
    private final vn.vku.nihongoai.progress.ProgressService progressService;

    @Transactional(readOnly = true)
    public List<ConversationTopicDto> getActiveTopics() {
        return getActiveTopics(null);
    }

    @Transactional(readOnly = true)
    public List<ConversationTopicDto> getActiveTopics(String levelStr) {
        JlptLevel level = parseJlptLevel(levelStr);
        return topicRepository.findActiveTopicsByLevel(level)
                .stream()
                .map(ConversationTopicDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ConversationTopicDto> getTopicsForUser(Long userId) {
        return getTopicsForUser(userId, null);
    }

    @Transactional(readOnly = true)
    public List<ConversationTopicDto> getTopicsForUser(Long userId, String levelStr) {
        JlptLevel level = parseJlptLevel(levelStr);
        return topicRepository.findVisibleTopicsForUserByLevel(userId, level)
                .stream()
                .map(ConversationTopicDto::from)
                .toList();
    }

    private JlptLevel parseJlptLevel(String levelStr) {
        if (levelStr == null || levelStr.isBlank() || "ALL".equalsIgnoreCase(levelStr.trim()) || "FREE".equalsIgnoreCase(levelStr.trim())) {
            return null;
        }
        try {
            return JlptLevel.valueOf(levelStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @Transactional
    public ConversationTopicDto createPersonalTopic(Long userId, Map<String, Object> body) {
        String nameVi = body.get("nameVi") != null ? body.get("nameVi").toString().trim()
                : (body.get("title") != null ? body.get("title").toString().trim() : "");
        if (nameVi.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tên chủ đề hội thoại không được để trống");
        }
        String description = body.get("description") != null ? body.get("description").toString().trim() : "";
        String aiRole = body.get("aiRole") != null ? body.get("aiRole").toString().trim() : "Người bản xứ Nhật Bản";
        String userRole = body.get("userRole") != null ? body.get("userRole").toString().trim() : "Người học tiếng Nhật";
        JlptLevel level = JlptLevel.N5;
        if (body.get("jlptLevel") != null) {
            try {
                level = JlptLevel.valueOf(body.get("jlptLevel").toString().trim().toUpperCase());
            } catch (Exception ignored) {
            }
        }

        String systemPrompt = String.format(
                "Tình huống hội thoại: %s. %s. Bạn đóng vai: %s. Người học đóng vai: %s. Hãy chủ động dẫn dắt cuộc trò chuyện tự nhiên theo tình huống này.",
                nameVi, description, aiRole, userRole
        );

        ConversationTopic topic = ConversationTopic.builder()
                .nameVi(nameVi)
                .description(description.isEmpty() ? ("Vai AI: " + aiRole + " • Vai bạn: " + userRole) : description)
                .aiRole(aiRole)
                .userRole(userRole)
                .jlptLevel(level)
                .systemPrompt(systemPrompt)
                .createdBy(userId)
                .isActive(true)
                .build();

        topic = topicRepository.save(topic);
        return ConversationTopicDto.from(topic);
    }

    @Transactional
    public void deletePersonalTopic(Long userId, Long topicId) {
        ConversationTopic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề"));
        if (topic.getCreatedBy() == null || !topic.getCreatedBy().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể xóa chủ đề cá nhân do chính mình tạo");
        }
        topicRepository.delete(topic);
    }

    @Transactional
    public ConversationDetailDto createConversation(Long userId, StartConversationRequest request) {
        aiQuotaService.checkQuota(userId);
        User user = userService.getUserOrThrow(userId);

        ConversationTopic topic = null;
        if (request.getTopicId() != null) {
            topic = topicRepository.findById(request.getTopicId())
                    .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy chủ đề hội thoại"));
        } else if (request.getCustomTitle() != null && !request.getCustomTitle().isBlank()) {
            String aiRole = (request.getAiRole() != null && !request.getAiRole().isBlank()) ? request.getAiRole().trim() : "Người bản xứ Nhật Bản";
            String userRole = (request.getUserRole() != null && !request.getUserRole().isBlank()) ? request.getUserRole().trim() : "Người học tiếng Nhật";
            String scenario = (request.getCustomScenario() != null && !request.getCustomScenario().isBlank()) ? request.getCustomScenario().trim() : request.getCustomTitle().trim();
            String sysPrompt = String.format(
                    "Tình huống hội thoại: %s. Chi tiết: %s. Bạn đóng vai: %s. Người học đóng vai: %s.",
                    request.getCustomTitle().trim(), scenario, aiRole, userRole
            );
            topic = ConversationTopic.builder()
                    .nameVi(request.getCustomTitle().trim())
                    .description(scenario)
                    .aiRole(aiRole)
                    .userRole(userRole)
                    .jlptLevel(request.getJlptLevel() != null ? request.getJlptLevel() : user.getJlptLevel())
                    .systemPrompt(sysPrompt)
                    .createdBy(userId)
                    .isActive(Boolean.TRUE.equals(request.getSaveTopic()))
                    .build();
            topic = topicRepository.save(topic);
        } else {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng chọn chủ đề hoặc nhập chủ đề hội thoại cá nhân");
        }

        JlptLevel level = request.getJlptLevel() != null ? request.getJlptLevel() : user.getJlptLevel();
        String tutorMode = (request.getTutorMode() != null && !request.getTutorMode().isBlank())
                ? request.getTutorMode().trim().toUpperCase()
                : "ROLEPLAY";
        String chatMode = (request.getChatMode() != null && !request.getChatMode().isBlank())
                ? request.getChatMode().trim().toUpperCase()
                : "CHAT";
        String levelDisplay = (request.getLevelMode() != null && !request.getLevelMode().isBlank())
                ? request.getLevelMode().trim().toUpperCase()
                : level.name();

        Conversation conversation = Conversation.builder()
                .user(user)
                .topic(topic)
                .jlptLevel(level)
                .tutorMode(tutorMode)
                .chatMode(chatMode)
                .title("Hội thoại: " + topic.getNameVi())
                .status(ConversationStatus.ACTIVE)
                .build();

        conversation = conversationRepository.save(conversation);

        // Chuẩn bị system instruction
        String systemInstruction = String.format(PromptTemplates.CHAT_SYSTEM_INSTRUCTION,
                topic.getSystemPrompt(), describeTutorMode(tutorMode), levelDisplay, levelDisplay);

        // Lời mở đầu của AI
        List<Map<String, Object>> contents = List.of(
                Map.of("role", "user", "parts", List.of(Map.of("text", "Bắt đầu cuộc trò chuyện. Hãy chào tôi theo đúng ngữ cảnh tình huống và gợi ý 3 câu trả lời để tôi bắt đầu.")))
        );

        JsonNode responseNode = geminiClient.generateChatJson(user, systemInstruction, contents);
        String replyJa = responseNode.path("replyJa").asText("こんにちは。よろしくお願いいたします。");
        String replyVi = responseNode.path("replyVi").asText("Xin chào bạn. Rất vui được trò chuyện cùng bạn.");
        List<SuggestedReplyDto> suggestedReplies = extractSuggestedReplies(responseNode, replyJa);

        ConversationMessage aiMsg = ConversationMessage.builder()
                .conversation(conversation)
                .role(MessageRole.AI)
                .messageType("CHAT")
                .contentJa(replyJa)
                .contentVi(replyVi)
                .suggestedRepliesJson(serializeJson(suggestedReplies))
                .build();

        aiMsg = messageRepository.save(aiMsg);

        if (progressService != null) {
            progressService.recordActivity(userId, "CONVERSATION", 1);
        }

        return ConversationDetailDto.from(conversation, List.of(ConversationMessageDto.from(aiMsg)));
    }

    @Transactional
    public AiMessageResponse sendMessage(Long userId, Long conversationId, SendConversationMessageRequest request) {
        aiQuotaService.checkQuota(userId);
        User user = userService.getUserOrThrow(userId);

        Conversation conv = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng hội thoại"));

        if (conv.getStatus() == ConversationStatus.ENDED) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Cuộc hội thoại này đã kết thúc");
        }

        String userText = request.getText().trim();
        if (userText.length() > 500) {
            userText = userText.substring(0, 500);
        }

        // Cập nhật linh hoạt level hoặc tutorMode ngay trong hội thoại nếu người học đổi
        if (request.getTutorMode() != null && !request.getTutorMode().isBlank()) {
            conv.setTutorMode(request.getTutorMode().trim().toUpperCase());
            conversationRepository.save(conv);
        }
        if (request.getLevelMode() != null && !request.getLevelMode().isBlank()) {
            try {
                conv.setJlptLevel(JlptLevel.valueOf(request.getLevelMode().trim().toUpperCase()));
                conversationRepository.save(conv);
            } catch (Exception ignored) {
                // Nếu chọn FREE (Tự do), giữ jlptLevel trong DB và truyền FREE vào prompt
            }
        }

        // Nếu người học bấm "Hỏi Gia sư bằng tiếng Việt", chuyển sang luồng giải đáp Gia sư
        if ("TUTOR_QUESTION".equalsIgnoreCase(request.getMessageType())) {
            return askTutorInVietnamese(userId, conversationId, userText);
        }

        // 1. Lưu tin nhắn người dùng
        ConversationMessage userMsg = ConversationMessage.builder()
                .conversation(conv)
                .role(MessageRole.USER)
                .messageType("CHAT")
                .contentJa(userText)
                .build();
        userMsg = messageRepository.save(userMsg);

        // 2. Lấy 10 tin nhắn CHAT gần nhất để gửi ngữ cảnh hội thoại (bỏ qua các câu hỏi gia sư tiếng Việt để không làm nhiễu roleplay)
        List<ConversationMessage> recentMessages = messageRepository.findTop10ByConversationIdOrderByCreatedAtDesc(conv.getId());
        Collections.reverse(recentMessages);

        List<Map<String, Object>> contents = new ArrayList<>();
        for (ConversationMessage m : recentMessages) {
            if ("TUTOR_QUESTION".equalsIgnoreCase(m.getMessageType()) || "TUTOR_ANSWER".equalsIgnoreCase(m.getMessageType())) {
                continue;
            }
            String role = (m.getRole() == MessageRole.USER) ? "user" : "model";
            contents.add(Map.of("role", role, "parts", List.of(Map.of("text", m.getContentJa()))));
        }
        if (contents.isEmpty()) {
            contents.add(Map.of("role", "user", "parts", List.of(Map.of("text", userText))));
        }

        String topicPrompt = conv.getTopic() != null ? conv.getTopic().getSystemPrompt() : "Giao tiếp tiếng Nhật hàng ngày";
        String levelDisplay = (request.getLevelMode() != null && !request.getLevelMode().isBlank())
                ? request.getLevelMode().trim().toUpperCase()
                : conv.getJlptLevel().name();
        String systemInstruction = String.format(PromptTemplates.CHAT_SYSTEM_INSTRUCTION,
                topicPrompt, describeTutorMode(conv.getTutorMode()), levelDisplay, levelDisplay);

        // 3. Gọi Gemini
        JsonNode aiNode = geminiClient.generateChatJson(user, systemInstruction, contents);

        String replyJa = aiNode.path("replyJa").asText("なるほど、いいですね！それで、どうなりましたか？");
        String replyVi = aiNode.path("replyVi").asText("Ra vậy, tuyệt quá! Sau đó thì sao ạ?");
        List<SuggestedReplyDto> suggestedReplies = extractSuggestedReplies(aiNode, replyJa);

        // 4. Lưu tin nhắn phản hồi của AI
        ConversationMessage aiMsg = ConversationMessage.builder()
                .conversation(conv)
                .role(MessageRole.AI)
                .messageType("CHAT")
                .contentJa(replyJa)
                .contentVi(replyVi)
                .suggestedRepliesJson(serializeJson(suggestedReplies))
                .build();
        aiMsg = messageRepository.save(aiMsg);

        // 5. Lưu các lỗi ngữ pháp phát hiện được
        List<CorrectionDto> corrections = new ArrayList<>();
        JsonNode corrNode = aiNode.path("corrections");
        if (corrNode.isArray()) {
            for (JsonNode c : corrNode) {
                String orig = c.path("original").asText();
                String corr = c.path("corrected").asText();
                String catStr = c.path("category").asText("GRAMMAR");
                String expl = c.path("explanationVi").asText();

                CorrectionCategory cat = CorrectionCategory.GRAMMAR;
                try {
                    cat = CorrectionCategory.valueOf(catStr);
                } catch (Exception ignored) {}

                if (!orig.isBlank() && !corr.isBlank()) {
                    ConversationCorrection cc = ConversationCorrection.builder()
                            .message(userMsg)
                            .user(user)
                            .originalText(orig)
                            .correctedText(corr)
                            .category(cat)
                            .explanationVi(expl)
                            .build();

                    cc = correctionRepository.save(cc);
                    corrections.add(CorrectionDto.from(cc));
                }
            }
        }

        // 6. Gợi ý từ mới
        List<NewWordDto> newWords = new ArrayList<>();
        JsonNode wordsNode = aiNode.path("newWords");
        if (wordsNode.isArray()) {
            for (JsonNode w : wordsNode) {
                newWords.add(NewWordDto.builder()
                        .word(w.path("word").asText())
                        .reading(w.path("reading").asText())
                        .meaningVi(w.path("meaningVi").asText())
                        .build());
            }
        }

        return AiMessageResponse.builder()
                .id(aiMsg.getId())
                .contentJa(replyJa)
                .contentVi(replyVi)
                .messageType("CHAT")
                .corrections(corrections)
                .newWords(newWords)
                .suggestedReplies(suggestedReplies)
                .build();
    }

    @Transactional
    public AiMessageResponse askTutorInVietnamese(Long userId, Long conversationId, String questionVi) {
        aiQuotaService.checkQuota(userId);
        User user = userService.getUserOrThrow(userId);

        Conversation conv = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng hội thoại"));

        String cleanQ = (questionVi != null ? questionVi.trim() : "");
        if (cleanQ.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng nhập câu hỏi bằng tiếng Việt cho Gia sư");
        }

        // Lưu câu hỏi của học viên với messageType = TUTOR_QUESTION
        ConversationMessage qMsg = ConversationMessage.builder()
                .conversation(conv)
                .role(MessageRole.USER)
                .messageType("TUTOR_QUESTION")
                .contentJa(cleanQ)
                .contentVi("Câu hỏi gửi Gia sư")
                .build();
        messageRepository.save(qMsg);

        String topicName = conv.getTopic() != null ? conv.getTopic().getNameVi() : "Giao tiếp tiếng Nhật";
        String sysInstruction = String.format(
                PromptTemplates.TUTOR_VIETNAMESE_QA_PROMPT,
                topicName,
                conv.getJlptLevel().name(),
                describeTutorMode(conv.getTutorMode())
        );

        List<Map<String, Object>> contents = List.of(
                Map.of("role", "user", "parts", List.of(Map.of("text", "Câu hỏi của học viên bằng tiếng Việt: " + cleanQ)))
        );

        JsonNode node = geminiClient.generateChatJson(user, sysInstruction, contents);
        String jpExpr = node.path("japaneseExpression").asText(node.path("replyJa").asText("将来、ブリッジSEになりたいです。"));
        String reading = node.path("readingHiragana").asText("しょうらい、ぶりっじエスイーになりたいです。");
        String viMeaning = node.path("vietnameseMeaning").asText(node.path("replyVi").asText("Mẫu câu tiếng Nhật gợi ý theo câu hỏi của bạn."));
        String explanation = node.path("explanationVi").asText("Bạn có thể dùng trực tiếp mẫu câu lịch sự này để trả lời trong cuộc hội thoại hiện tại.");

        List<SuggestedReplyDto> alternatives = new ArrayList<>();
        JsonNode altNode = node.path("alternativeExpressions");
        if (altNode.isArray()) {
            for (JsonNode a : altNode) {
                String ja = a.path("japanese").asText();
                if (!ja.isBlank()) {
                    alternatives.add(SuggestedReplyDto.builder()
                            .japanese(ja)
                            .reading(a.path("reading").asText())
                            .vietnamese(a.path("vietnamese").asText())
                            .build());
                }
            }
        }
        if (alternatives.isEmpty()) {
            alternatives.add(SuggestedReplyDto.builder()
                    .japanese(jpExpr)
                    .reading(reading)
                    .vietnamese(viMeaning)
                    .build());
        }

        TutorAnswerDto tutorAnswer = TutorAnswerDto.builder()
                .questionVi(cleanQ)
                .japaneseExpression(jpExpr)
                .readingHiragana(reading)
                .vietnameseMeaning(viMeaning)
                .explanationVi(explanation)
                .alternativeExpressions(alternatives)
                .build();

        ConversationMessage tutorMsg = ConversationMessage.builder()
                .conversation(conv)
                .role(MessageRole.AI)
                .messageType("TUTOR_ANSWER")
                .contentJa(jpExpr)
                .contentVi(explanation)
                .tutorAnswerJson(serializeJson(tutorAnswer))
                .suggestedRepliesJson(serializeJson(alternatives))
                .build();
        tutorMsg = messageRepository.save(tutorMsg);

        return AiMessageResponse.builder()
                .id(tutorMsg.getId())
                .contentJa(jpExpr)
                .contentVi(explanation)
                .messageType("TUTOR_ANSWER")
                .tutorAnswer(tutorAnswer)
                .suggestedReplies(alternatives)
                .corrections(List.of())
                .newWords(List.of())
                .build();
    }

    @Transactional
    public ConversationDetailDto updateConversationSettings(Long userId, Long conversationId, Map<String, Object> body) {
        Conversation conv = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng hội thoại"));

        if (body.get("jlptLevel") != null) {
            try {
                conv.setJlptLevel(JlptLevel.valueOf(body.get("jlptLevel").toString().trim().toUpperCase()));
            } catch (Exception ignored) {
            }
        }
        if (body.get("tutorMode") != null && !body.get("tutorMode").toString().isBlank()) {
            conv.setTutorMode(body.get("tutorMode").toString().trim().toUpperCase());
        }
        if (body.get("chatMode") != null && !body.get("chatMode").toString().isBlank()) {
            conv.setChatMode(body.get("chatMode").toString().trim().toUpperCase());
        }
        conversationRepository.save(conv);
        return getConversationDetail(userId, conversationId);
    }

    private String describeTutorMode(String mode) {
        if (mode == null) return "Nhập vai theo tình huống thực tế (Roleplay)";
        return switch (mode.toUpperCase()) {
            case "FREE_CONVERSATION" -> "Hội thoại tự do về mọi chủ đề đời sống";
            case "DAILY_JAPANESE" -> "Giao tiếp tiếng Nhật phản xạ hàng ngày";
            case "INTERVIEW" -> "Phỏng vấn xin việc / phỏng vấn công ty Nhật Bản";
            case "BUSINESS_JAPANESE" -> "Tiếng Nhật công sở lịch sự (Keigo, Sonkeigo, Kenjougo)";
            case "JLPT_PRACTICE" -> "Luyện sử dụng từ vựng và mẫu ngữ pháp chuẩn JLPT";
            case "TEACHER_MODE" -> "Gia sư giải thích cặn kẽ ngữ pháp và sửa cách diễn đạt";
            default -> "Nhập vai theo tình huống thực tế (Roleplay)";
        };
    }

    private List<SuggestedReplyDto> extractSuggestedReplies(JsonNode aiNode, String replyJa) {
        List<SuggestedReplyDto> list = new ArrayList<>();
        JsonNode sNode = aiNode.path("suggestedReplies");
        if (sNode.isArray()) {
            for (JsonNode s : sNode) {
                String ja = s.path("japanese").asText(s.path("textJa").asText(""));
                if (!ja.isBlank()) {
                    list.add(SuggestedReplyDto.builder()
                            .japanese(ja)
                            .reading(s.path("reading").asText(s.path("hiragana").asText("")))
                            .vietnamese(s.path("vietnamese").asText(s.path("meaningVi").asText("")))
                            .build());
                }
            }
        }
        if (list.isEmpty()) {
            list.add(SuggestedReplyDto.builder()
                    .japanese("はい、よろしくお願いします。")
                    .reading("はい、よろしくおねがいします。")
                    .vietnamese("Vâng, rất mong được giúp đỡ.")
                    .build());
            list.add(SuggestedReplyDto.builder()
                    .japanese("すみません、もう一度ゆっくり言ってください。")
                    .reading("すみません、もういちどゆっくりいってください。")
                    .vietnamese("Xin lỗi, vui lòng nói lại chậm một lần nữa.")
                    .build());
            list.add(SuggestedReplyDto.builder()
                    .japanese("そうですね。とてもいいと思います。")
                    .reading("そうですね。とてもいいとおもいます。")
                    .vietnamese("Đúng vậy nhỉ. Tôi nghĩ là rất tuyệt.")
                    .build());
        }
        return list;
    }

    private String serializeJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return null;
        }
    }

    @Transactional
    public ConversationDetailDto endConversation(Long userId, Long conversationId) {
        Conversation conv = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng hội thoại"));

        if (conv.getStatus() != ConversationStatus.ENDED) {
            List<ConversationMessage> allMsgs = messageRepository.findAllByConversationIdOrderByCreatedAtAsc(conv.getId());
            List<Map<String, Object>> contents = new ArrayList<>();
            for (ConversationMessage m : allMsgs) {
                String role = (m.getRole() == MessageRole.USER) ? "user" : "model";
                contents.add(Map.of("role", role, "parts", List.of(Map.of("text", m.getContentJa()))));
            }

            String summary = geminiClient.generateSummary(conv.getUser(), contents);
            conv.setSummary(summary);
            conv.setStatus(ConversationStatus.ENDED);
            conv.setEndedAt(Instant.now());
            conv = conversationRepository.save(conv);
        }

        return getConversationDetail(userId, conversationId);
    }

    @Transactional(readOnly = true)
    public ConversationDetailDto getConversationDetail(Long userId, Long conversationId) {
        Conversation conv = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng hội thoại"));

        List<ConversationMessage> messages = messageRepository.findAllByConversationIdOrderByCreatedAtAsc(conv.getId());
        List<ConversationMessageDto> dtos = messages.stream().map(ConversationMessageDto::from).toList();

        return ConversationDetailDto.from(conv, dtos);
    }

    @Transactional(readOnly = true)
    public Page<ConversationDetailDto> getHistory(Long userId, Pageable pageable) {
        return conversationRepository.findByUserIdOrderByStartedAtDesc(userId, pageable)
                .map(c -> ConversationDetailDto.from(c, List.of()));
    }

    @Transactional
    public void deleteConversation(Long userId, Long conversationId) {
        Conversation conv = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng hội thoại"));
        conversationRepository.delete(conv);
    }

    @Transactional(readOnly = true)
    public List<WeakPointDto> getWeakPoints(Long userId) {
        List<Object[]> rows = correctionRepository.countErrorsByCategory(userId);
        List<WeakPointDto> result = new ArrayList<>();

        for (Object[] row : rows) {
            CorrectionCategory cat = (CorrectionCategory) row[0];
            long count = ((Number) row[1]).longValue();
            String desc = switch (cat) {
                case GRAMMAR -> "Lỗi cấu trúc ngữ pháp và chia động từ";
                case PARTICLE -> "Lỗi dùng sai trợ từ (は, が, を, に, で)";
                case VOCAB -> "Lỗi chọn từ vựng chưa phù hợp ngữ cảnh";
                case POLITENESS -> "Lỗi sắc thái lịch sự hoặc thể giao tiếp";
                default -> "Các lỗi diễn đạt khác";
            };
            result.add(WeakPointDto.builder()
                    .category(cat)
                    .count(count)
                    .descriptionVi(desc)
                    .build());
        }
        return result;
    }

    @Transactional
    public UserVocabularyDto saveWordFromMessage(Long userId, Long messageId, CreateUserVocabRequest request) {
        User user = userService.getUserOrThrow(userId);
        messageRepository.findById(messageId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy tin nhắn"));

        UserVocabulary uv = UserVocabulary.builder()
                .user(user)
                .word(request.getWord().trim())
                .reading(request.getReading() != null ? request.getReading().trim() : null)
                .meaningVi(request.getMeaningVi().trim())
                .exampleJa(request.getExampleJa())
                .exampleVi(request.getExampleVi())
                .source(VocabSource.MANUAL)
                .isMastered(false)
                .build();

        uv = userVocabularyRepository.save(uv);
        return UserVocabularyDto.from(uv);
    }
}
