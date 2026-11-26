package vn.vku.nihongoai.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeckRepository extends JpaRepository<Deck, Long> {

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.topic LEFT JOIN FETCH d.owner WHERE d.isActive = true AND " +
           "(d.owner.id = :userId OR (d.isSystem = true AND d.status = vn.vku.nihongoai.flashcard.DeckStatus.PUBLISHED)) " +
           "ORDER BY d.updatedAt DESC, d.id DESC")
    List<Deck> findAccessibleDecks(@Param("userId") Long userId);

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.topic LEFT JOIN FETCH d.owner " +
           "WHERE d.isActive = true AND d.isSystem = false AND d.owner.id = :userId " +
           "ORDER BY d.updatedAt DESC, d.id DESC")
    List<Deck> findMyDecks(@Param("userId") Long userId);

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.topic LEFT JOIN FETCH d.owner " +
           "WHERE d.isSystem = true AND d.status = vn.vku.nihongoai.flashcard.DeckStatus.PUBLISHED AND d.isActive = true " +
           "ORDER BY d.updatedAt DESC, d.id DESC")
    List<Deck> findPublishedSystemDecks();

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.topic LEFT JOIN FETCH d.owner " +
           "WHERE d.isSystem = true AND d.status = vn.vku.nihongoai.flashcard.DeckStatus.PUBLISHED AND d.isActive = true " +
           "ORDER BY d.updatedAt DESC, d.id DESC")
    List<Deck> findPublicDecks();

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.topic LEFT JOIN FETCH d.owner " +
           "WHERE d.isSystem = true " +
           "AND (:status IS NULL OR d.status = :status) " +
           "ORDER BY d.updatedAt DESC, d.id DESC")
    List<Deck> findAllSystemDecks(@Param("status") DeckStatus status);

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.topic LEFT JOIN FETCH d.owner WHERE d.id = :id")
    Optional<Deck> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.topic LEFT JOIN FETCH d.owner WHERE d.id = :id AND d.isActive = true")
    Optional<Deck> findByIdAndIsActiveTrue(@Param("id") Long id);

    long countByIsSystemTrue();
    long countByIsSystemTrueAndStatus(DeckStatus status);
    long countByTopicId(Long topicId);
}
