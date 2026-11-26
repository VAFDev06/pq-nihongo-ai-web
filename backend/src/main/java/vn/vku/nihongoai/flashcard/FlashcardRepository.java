package vn.vku.nihongoai.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FlashcardRepository extends JpaRepository<Flashcard, Long> {
    List<Flashcard> findAllByDeckIdOrderByPositionAsc(Long deckId);
    Optional<Flashcard> findByDeckIdAndFrontAndReading(Long deckId, String front, String reading);
    long countByDeckId(Long deckId);

    @Query("SELECT f FROM Flashcard f WHERE f.deck.isActive = true AND " +
           "f.deck.id = :deckId AND " +
           "NOT EXISTS (SELECT 1 FROM CardProgress cp WHERE cp.user.id = :userId AND cp.flashcard.id = f.id) " +
           "ORDER BY f.position ASC, f.id ASC")
    List<Flashcard> findNewCardsByDeckForUser(@Param("userId") Long userId, @Param("deckId") Long deckId);

    @Query("SELECT f FROM Flashcard f WHERE f.deck.isActive = true AND " +
           "f.deck.owner.id = :userId AND " +
           "NOT EXISTS (SELECT 1 FROM CardProgress cp WHERE cp.user.id = :userId AND cp.flashcard.id = f.id) " +
           "ORDER BY f.id ASC")
    List<Flashcard> findAllNewCardsInUserDecks(@Param("userId") Long userId);

    @Query("SELECT COUNT(f) FROM Flashcard f WHERE f.deck.id = :deckId AND " +
           "NOT EXISTS (SELECT 1 FROM CardProgress cp WHERE cp.user.id = :userId AND cp.flashcard.id = f.id)")
    long countNewCardsByDeckId(@Param("userId") Long userId, @Param("deckId") Long deckId);

    @Query("SELECT COUNT(f) FROM Flashcard f WHERE f.deck.isActive = true AND f.deck.owner.id = :userId AND " +
           "NOT EXISTS (SELECT 1 FROM CardProgress cp WHERE cp.user.id = :userId AND cp.flashcard.id = f.id)")
    long countAllNewCardsInUserDecks(@Param("userId") Long userId);
}
