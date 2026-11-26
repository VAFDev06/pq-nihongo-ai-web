package vn.vku.nihongoai.shadowing;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ShadowingAttemptRepository extends JpaRepository<ShadowingAttempt, Long> {
    Page<ShadowingAttempt> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<ShadowingAttempt> findByUserIdAndLessonIdOrderByCreatedAtDesc(Long userId, Long lessonId, Pageable pageable);

    @Query("SELECT MAX(sa.accuracy) FROM ShadowingAttempt sa WHERE sa.user.id = :userId AND sa.lesson.id = :lessonId")
    BigDecimal findMaxAccuracyByUserAndLesson(@Param("userId") Long userId, @Param("lessonId") Long lessonId);

    @Query("SELECT AVG(sa.accuracy) FROM ShadowingAttempt sa WHERE sa.user.id = :userId")
    Double findAverageAccuracyByUserId(@Param("userId") Long userId);

    @Query("SELECT sa FROM ShadowingAttempt sa WHERE sa.user.id = :userId AND sa.accuracy < 70.0 ORDER BY sa.accuracy ASC")
    List<ShadowingAttempt> findWeakAttempts(@Param("userId") Long userId);
}
