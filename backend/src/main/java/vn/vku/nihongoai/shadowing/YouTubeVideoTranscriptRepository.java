package vn.vku.nihongoai.shadowing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface YouTubeVideoTranscriptRepository extends JpaRepository<YouTubeVideoTranscript, String> {
}
