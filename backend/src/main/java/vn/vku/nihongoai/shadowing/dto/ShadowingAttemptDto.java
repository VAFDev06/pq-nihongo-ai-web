package vn.vku.nihongoai.shadowing.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.shadowing.ShadowingAttempt;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShadowingAttemptDto {
    private Long id;
    private Long lessonId;
    private String lessonTitle;
    private String recognizedText;
    private BigDecimal accuracy;
    private List<WordDiffItem> wordDiff;
    private String audioUrl;
    private BigDecimal playbackSpeed;
    private Instant createdAt;

    public static ShadowingAttemptDto from(ShadowingAttempt attempt, ObjectMapper mapper) {
        List<WordDiffItem> diffList = List.of();
        try {
            if (attempt.getWordDiff() != null) {
                diffList = mapper.readValue(attempt.getWordDiff(), new TypeReference<List<WordDiffItem>>() {});
            }
        } catch (Exception ignored) {}

        return ShadowingAttemptDto.builder()
                .id(attempt.getId())
                .lessonId(attempt.getLesson().getId())
                .lessonTitle(attempt.getLesson().getTitle())
                .recognizedText(attempt.getRecognizedText())
                .accuracy(attempt.getAccuracy())
                .wordDiff(diffList)
                .audioUrl(attempt.getAudioUrl())
                .playbackSpeed(attempt.getPlaybackSpeed())
                .createdAt(attempt.getCreatedAt())
                .build();
    }

    public BigDecimal getAccuracyScore() {
        return this.accuracy;
    }
}
