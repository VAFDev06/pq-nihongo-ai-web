package vn.vku.nihongoai.shadowing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShadowingDialogueLineRepository extends JpaRepository<ShadowingDialogueLine, Long> {
    List<ShadowingDialogueLine> findByLessonIdOrderByLineOrderAscIdAsc(Long lessonId);
    long countByLessonId(Long lessonId);
    void deleteByLessonId(Long lessonId);
}
