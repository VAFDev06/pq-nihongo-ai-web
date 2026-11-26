package vn.vku.nihongoai.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vku.nihongoai.user.JlptLevel;

import java.util.List;

@Repository
public interface ConversationTopicRepository extends JpaRepository<ConversationTopic, Long> {
    List<ConversationTopic> findAllByIsActiveTrueOrderByCreatedAtAsc();

    @Query("SELECT t FROM ConversationTopic t WHERE t.isActive = true AND (t.createdBy IS NULL OR t.createdBy = :userId) ORDER BY t.createdBy NULLS FIRST, t.createdAt ASC")
    List<ConversationTopic> findVisibleTopicsForUser(@Param("userId") Long userId);

    @Query("SELECT t FROM ConversationTopic t WHERE t.isActive = true " +
           "AND (t.createdBy IS NULL OR t.createdBy = :userId) " +
           "AND (:level IS NULL OR t.jlptLevel = :level) " +
           "ORDER BY t.createdBy NULLS FIRST, t.createdAt ASC")
    List<ConversationTopic> findVisibleTopicsForUserByLevel(@Param("userId") Long userId, @Param("level") JlptLevel level);

    @Query("SELECT t FROM ConversationTopic t WHERE t.isActive = true " +
           "AND (:level IS NULL OR t.jlptLevel = :level) " +
           "ORDER BY t.createdAt ASC")
    List<ConversationTopic> findActiveTopicsByLevel(@Param("level") JlptLevel level);
}
