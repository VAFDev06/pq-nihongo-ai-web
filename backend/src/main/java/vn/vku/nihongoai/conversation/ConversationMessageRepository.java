package vn.vku.nihongoai.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {
    List<ConversationMessage> findAllByConversationIdOrderByCreatedAtAsc(Long conversationId);
    List<ConversationMessage> findTop10ByConversationIdOrderByCreatedAtDesc(Long conversationId);
}
