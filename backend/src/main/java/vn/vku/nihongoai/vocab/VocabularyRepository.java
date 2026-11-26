package vn.vku.nihongoai.vocab;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vku.nihongoai.user.JlptLevel;

import java.util.Optional;

@Repository
public interface VocabularyRepository extends JpaRepository<Vocabulary, Long> {
    Optional<Vocabulary> findByWordAndReading(String word, String reading);

    @Query("SELECT v FROM Vocabulary v WHERE " +
           "v.isActive = true AND " +
           "(:jlptLevel IS NULL OR v.jlptLevel = :jlptLevel) AND " +
           "(:topicId IS NULL OR (v.topic IS NOT NULL AND v.topic.id = :topicId)) AND " +
           "(:query = '' OR LOWER(v.word) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(COALESCE(v.reading, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(v.meaningVi) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Vocabulary> searchSystemVocab(
            @Param("jlptLevel") JlptLevel jlptLevel,
            @Param("topicId") Long topicId,
            @Param("query") String query,
            Pageable pageable
    );

    @Query("SELECT v FROM Vocabulary v WHERE " +
           "(:jlptLevel IS NULL OR v.jlptLevel = :jlptLevel) AND " +
           "(:topicId IS NULL OR (v.topic IS NOT NULL AND v.topic.id = :topicId)) AND " +
           "(:query = '' OR LOWER(v.word) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(COALESCE(v.reading, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(v.meaningVi) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Vocabulary> searchAllSystemVocabForAdmin(
            @Param("jlptLevel") JlptLevel jlptLevel,
            @Param("topicId") Long topicId,
            @Param("query") String query,
            Pageable pageable
    );
}
