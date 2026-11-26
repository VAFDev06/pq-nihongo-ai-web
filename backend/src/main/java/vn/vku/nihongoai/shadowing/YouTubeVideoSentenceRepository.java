package vn.vku.nihongoai.shadowing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface YouTubeVideoSentenceRepository extends JpaRepository<YouTubeVideoSentence, Long> {
    List<YouTubeVideoSentence> findAllByVideoIdOrderBySentenceOrderAsc(String videoId);
    Optional<YouTubeVideoSentence> findByIdAndVideoId(Long id, String videoId);
    void deleteAllByVideoId(String videoId);
}
