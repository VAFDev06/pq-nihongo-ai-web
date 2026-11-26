package vn.vku.nihongoai.shadowing;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vku.nihongoai.user.JlptLevel;

import java.util.Optional;

@Repository
public interface ShadowingLessonRepository extends JpaRepository<ShadowingLesson, Long> {

    /**
     * Dành cho USER: CHỈ hiển thị các bài Shadowing ở trạng thái PUBLISHED và đang hoạt động.
     */
    @Query("SELECT sl FROM ShadowingLesson sl WHERE " +
           "sl.isActive = true AND sl.status = 'PUBLISHED' AND " +
           "(:jlptLevel IS NULL OR sl.jlptLevel = :jlptLevel) AND " +
           "(:topicId IS NULL OR (sl.topic IS NOT NULL AND sl.topic.id = :topicId)) AND " +
           "(:query = '' OR LOWER(sl.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(COALESCE(sl.description, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(sl.textJa) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(COALESCE(sl.textVi, '')) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<ShadowingLesson> searchLessons(
            @Param("jlptLevel") JlptLevel jlptLevel,
            @Param("topicId") Long topicId,
            @Param("query") String query,
            Pageable pageable
    );

    /**
     * Dành cho ADMIN: xem được tất cả trạng thái (DRAFT, PUBLISHED, ARCHIVED).
     */
    @Query("SELECT sl FROM ShadowingLesson sl WHERE " +
           "(:jlptLevel IS NULL OR sl.jlptLevel = :jlptLevel) AND " +
           "(:topicId IS NULL OR (sl.topic IS NOT NULL AND sl.topic.id = :topicId)) AND " +
           "(:status IS NULL OR :status = '' OR sl.status = :status) AND " +
           "(:query = '' OR LOWER(sl.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(COALESCE(sl.description, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(sl.textJa) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(COALESCE(sl.textVi, '')) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<ShadowingLesson> searchAdminLessons(
            @Param("jlptLevel") JlptLevel jlptLevel,
            @Param("topicId") Long topicId,
            @Param("status") String status,
            @Param("query") String query,
            Pageable pageable
    );

    Optional<ShadowingLesson> findByIdAndIsActiveTrue(Long id);

    Optional<ShadowingLesson> findByIdAndStatus(Long id, String status);

    Optional<ShadowingLesson> findFirstByTextJa(String textJa);

    long countByTopicId(Long topicId);
}
