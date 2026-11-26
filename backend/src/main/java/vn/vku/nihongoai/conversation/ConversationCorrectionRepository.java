package vn.vku.nihongoai.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationCorrectionRepository extends JpaRepository<ConversationCorrection, Long> {
    List<ConversationCorrection> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("SELECT c.category, COUNT(c) FROM ConversationCorrection c WHERE c.user.id = :userId GROUP BY c.category ORDER BY COUNT(c) DESC")
    List<Object[]> countErrorsByCategory(@Param("userId") Long userId);
}
