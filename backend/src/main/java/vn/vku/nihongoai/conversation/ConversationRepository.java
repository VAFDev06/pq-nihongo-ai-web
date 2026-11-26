package vn.vku.nihongoai.conversation;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Page<Conversation> findByUserIdOrderByStartedAtDesc(Long userId, Pageable pageable);
    Optional<Conversation> findByIdAndUserId(Long id, Long userId);
}
