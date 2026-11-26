package vn.vku.nihongoai.recognition;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ImageRecognitionRepository extends JpaRepository<ImageRecognition, Long> {
    Page<ImageRecognition> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Optional<ImageRecognition> findByIdAndUserId(Long id, Long userId);
}
