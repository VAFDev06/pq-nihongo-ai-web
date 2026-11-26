package vn.vku.nihongoai.vocab;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserVocabularyRepository extends JpaRepository<UserVocabulary, Long> {
    Optional<UserVocabulary> findByUserIdAndWordAndReading(Long userId, String word, String reading);
    Optional<UserVocabulary> findFirstByUserIdAndWord(Long userId, String word);
    Optional<UserVocabulary> findFirstByUserIdAndVocabularyId(Long userId, Long vocabularyId);
    Optional<UserVocabulary> findByIdAndUserId(Long id, Long userId);

    @Query("SELECT uv.vocabulary.id FROM UserVocabulary uv WHERE uv.user.id = :userId AND uv.vocabulary IS NOT NULL")
    List<Long> findSavedSystemVocabularyIds(@Param("userId") Long userId);

    @Query("SELECT uv.word FROM UserVocabulary uv WHERE uv.user.id = :userId")
    List<String> findSavedWords(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE UserVocabulary uv SET uv.updatedAt = CURRENT_TIMESTAMP, uv.vocabulary = :sysVocab WHERE uv.id = :id")
    void touchUpdatedAtAndLinkVocabulary(@Param("id") Long id, @Param("sysVocab") Vocabulary sysVocab);

    @Query("SELECT uv FROM UserVocabulary uv WHERE " +
           "uv.user.id = :userId AND " +
           "(:isMastered IS NULL OR uv.isMastered = :isMastered) AND " +
           "(:source IS NULL OR uv.source = :source) AND " +
           "(:query = '' OR LOWER(uv.word) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(COALESCE(uv.reading, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(uv.meaningVi) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<UserVocabulary> searchUserVocab(
            @Param("userId") Long userId,
            @Param("query") String query,
            @Param("isMastered") Boolean isMastered,
            @Param("source") VocabSource source,
            Pageable pageable
    );

    long countByUserIdAndIsMastered(Long userId, boolean isMastered);
    long countByUserId(Long userId);
}
