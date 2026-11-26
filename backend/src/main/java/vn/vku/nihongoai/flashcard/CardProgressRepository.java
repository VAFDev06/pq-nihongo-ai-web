package vn.vku.nihongoai.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface CardProgressRepository extends JpaRepository<CardProgress, Long> {
    Optional<CardProgress> findByUserIdAndFlashcardId(Long userId, Long flashcardId);

    /**
     * Lấy các thẻ ĐẾN HẠN ôn tập (CHỈ Level 1..4 và due_at <= now).
     * KHÔNG lấy Level 0 (Từ mới) và KHÔNG lấy Level 5 (Đã thuộc vĩnh viễn).
     */
    @Query("SELECT cp FROM CardProgress cp " +
           "JOIN FETCH cp.flashcard f " +
           "JOIN FETCH f.deck d " +
           "WHERE cp.user.id = :userId " +
           "AND d.isActive = true " +
           "AND (:deckId IS NULL OR d.id = :deckId) " +
           "AND cp.srsLevel BETWEEN 1 AND 4 " +
           "AND cp.dueAt IS NOT NULL " +
           "AND cp.dueAt <= :now " +
           "ORDER BY cp.srsLevel ASC, cp.dueAt ASC, cp.id ASC")
    List<CardProgress> findDueCards(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("now") Instant now);

    /**
     * Lấy các thẻ Level 0 (Từ mới chưa đánh giá lần đầu).
     */
    @Query("SELECT cp FROM CardProgress cp " +
           "JOIN FETCH cp.flashcard f " +
           "JOIN FETCH f.deck d " +
           "WHERE cp.user.id = :userId " +
           "AND d.isActive = true " +
           "AND (:deckId IS NULL OR d.id = :deckId) " +
           "AND cp.srsLevel = 0 " +
           "ORDER BY f.position ASC, cp.id ASC")
    List<CardProgress> findNewLevel0Cards(@Param("userId") Long userId, @Param("deckId") Long deckId);

    /**
     * Lấy toàn bộ thẻ SRS của user (dùng cho màn hình Tổng quan SRS & Chế độ Học lại bộ thẻ).
     */
    @Query("SELECT cp FROM CardProgress cp " +
           "JOIN FETCH cp.flashcard f " +
           "JOIN FETCH f.deck d " +
           "WHERE cp.user.id = :userId " +
           "AND d.isActive = true " +
           "AND (:deckId IS NULL OR d.id = :deckId) " +
           "ORDER BY CASE WHEN cp.srsLevel BETWEEN 1 AND 4 AND cp.dueAt IS NOT NULL AND cp.dueAt <= :now THEN 0 " +
           "              WHEN cp.srsLevel = 0 THEN 1 " +
           "              WHEN cp.srsLevel BETWEEN 1 AND 4 THEN 2 " +
           "              ELSE 3 END, " +
           "         cp.srsLevel ASC, cp.dueAt ASC NULLS LAST, f.position ASC, cp.id ASC")
    List<CardProgress> findAllActiveForUser(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("now") Instant now);

    /**
     * Lấy toàn bộ thẻ trong 1 bộ thẻ theo đúng thứ tự vị trí (dùng cho Chế độ Học lại bộ thẻ - SET_RELEARN).
     */
    @Query("SELECT cp FROM CardProgress cp " +
           "JOIN FETCH cp.flashcard f " +
           "JOIN FETCH f.deck d " +
           "WHERE cp.user.id = :userId " +
           "AND d.id = :deckId " +
           "AND d.isActive = true " +
           "ORDER BY f.position ASC, f.id ASC")
    List<CardProgress> findAllByUserAndDeckOrderByPosition(@Param("userId") Long userId, @Param("deckId") Long deckId);

    @Query("SELECT COUNT(cp) FROM CardProgress cp JOIN cp.flashcard f JOIN f.deck d " +
           "WHERE cp.user.id = :userId AND d.isActive = true AND (:deckId IS NULL OR d.id = :deckId)")
    long countTotalActiveSrsCards(@Param("userId") Long userId, @Param("deckId") Long deckId);

    @Query("SELECT COUNT(cp) FROM CardProgress cp JOIN cp.flashcard f JOIN f.deck d " +
           "WHERE cp.user.id = :userId AND d.isActive = true AND (:deckId IS NULL OR d.id = :deckId) " +
           "AND cp.srsLevel BETWEEN 1 AND 4 AND cp.dueAt IS NOT NULL AND cp.dueAt <= :now")
    long countDueActiveSrsCards(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("now") Instant now);

    @Query("SELECT COUNT(cp) FROM CardProgress cp JOIN cp.flashcard f JOIN f.deck d " +
           "WHERE cp.user.id = :userId AND d.isActive = true AND (:deckId IS NULL OR d.id = :deckId) " +
           "AND cp.srsLevel = :level")
    long countByUserAndLevel(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("level") int level);

    @Query("SELECT COUNT(cp) FROM CardProgress cp JOIN cp.flashcard f JOIN f.deck d " +
           "WHERE cp.user.id = :userId AND d.isActive = true AND (:deckId IS NULL OR d.id = :deckId) " +
           "AND cp.srsLevel BETWEEN 1 AND 4")
    long countLearningLevels1To4(@Param("userId") Long userId, @Param("deckId") Long deckId);

    @Query("SELECT cp.srsLevel, COUNT(cp) FROM CardProgress cp JOIN cp.flashcard f JOIN f.deck d " +
           "WHERE cp.user.id = :userId AND d.isActive = true AND (:deckId IS NULL OR d.id = :deckId) " +
           "GROUP BY cp.srsLevel")
    List<Object[]> countGroupByLevel(@Param("userId") Long userId, @Param("deckId") Long deckId);

    @Query("SELECT COUNT(cp) FROM CardProgress cp JOIN cp.flashcard f WHERE f.deck.id = :deckId")
    long countAllProgressByDeckId(@Param("deckId") Long deckId);

    @Query("SELECT COUNT(cp) FROM CardProgress cp JOIN cp.flashcard f " +
           "WHERE cp.user.id = :userId AND f.deck.id = :deckId " +
           "AND cp.srsLevel BETWEEN 1 AND 4 AND cp.dueAt IS NOT NULL AND cp.dueAt <= :now")
    long countDueByDeckId(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("now") Instant now);

    @Query("SELECT cp FROM CardProgress cp WHERE cp.user.id = :userId AND cp.lapses > 2 ORDER BY cp.lapses DESC")
    List<CardProgress> findWeakCards(@Param("userId") Long userId);
}
