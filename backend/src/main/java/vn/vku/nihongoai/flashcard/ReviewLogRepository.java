package vn.vku.nihongoai.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ReviewLogRepository extends JpaRepository<ReviewLog, Long> {
    List<ReviewLog> findByUserIdOrderByReviewedAtDesc(Long userId);

    @Query("SELECT COUNT(DISTINCT rl.flashcard.id) FROM ReviewLog rl " +
           "WHERE rl.user.id = :userId " +
           "AND (:deckId IS NULL OR rl.flashcard.deck.id = :deckId) " +
           "AND rl.reviewedAt >= :since")
    long countDistinctCardsReviewedSince(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("since") Instant since);

    @Query("SELECT COUNT(rl) FROM ReviewLog rl " +
           "WHERE rl.user.id = :userId " +
           "AND (:deckId IS NULL OR rl.flashcard.deck.id = :deckId) " +
           "AND rl.reviewedAt >= :since")
    long countReviewsSince(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("since") Instant since);

    @Query("SELECT rl FROM ReviewLog rl " +
           "JOIN FETCH rl.flashcard f " +
           "JOIN FETCH f.deck d " +
           "WHERE rl.user.id = :userId " +
           "AND (:deckId IS NULL OR d.id = :deckId) " +
           "AND (:rating IS NULL OR rl.rating = :rating) " +
           "AND (CAST(:since AS timestamp) IS NULL OR rl.reviewedAt >= :since) " +
           "AND (:q = '' OR LOWER(f.front) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(COALESCE(f.reading, '')) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR LOWER(f.back) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY rl.reviewedAt DESC")
    List<ReviewLog> searchReviewHistory(
            @Param("userId") Long userId,
            @Param("deckId") Long deckId,
            @Param("rating") Integer rating,
            @Param("since") Instant since,
            @Param("q") String q
    );
}
