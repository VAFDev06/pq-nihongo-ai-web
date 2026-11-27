package vn.vku.nihongoai.shadowing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.vku.nihongoai.furigana.FuriganaToken;

import java.util.ArrayList;
import java.util.List;

/**
 * Structured Japanese Shadowing AI evaluation result returned by the private AI Model Server
 * and enriched with existing Spring Boot Kuromoji tokenization/furigana analysis.
 *
 * Numeric scores may be null when a component is unavailable or audio quality is insufficient;
 * scores are never fabricated.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ShadowingEvaluationResultDto {

    private String referenceText;
    private String referenceReading;
    private String recognizedText;
    private String status; // COMPLETED | PARTIAL | FAILED

    @Builder.Default
    private ScoreBreakdown scores = new ScoreBreakdown();

    @Builder.Default
    private PronunciationSection pronunciation = new PronunciationSection();

    @Builder.Default
    private IntonationSection intonation = new IntonationSection();

    @Builder.Default
    private AlignmentSection alignment = new AlignmentSection();

    @Builder.Default
    private AsrSection asr = new AsrSection();

    @Builder.Default
    private FeedbackSection feedback = new FeedbackSection();

    @Builder.Default
    private List<WordDiffItem> wordDiff = new ArrayList<>();

    @Builder.Default
    private List<FuriganaToken> kuromojiTokens = new ArrayList<>();

    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    private Double confidence;

    @Builder.Default
    private EvaluationMetadata metadata = new EvaluationMetadata();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ScoreBreakdown {
        private Double overall;
        private Double accuracy;
        private Double completeness;
        private Double pitchAccent;
        private Double intonation;
        private Double timing;
        private Double kuromojiTokenAccuracy;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MoraEvaluation {
        private String kana;
        private String wordSurface;
        private List<String> phonemes;
        private Double startTime;
        private Double endTime;
        private Double score;
        private String status;
        private String substitutedBy;
        private String durationStatus;
        private String expectedPitchLevel;
        private Double observedSemitone;
        private String pitchStatus;
        private boolean devoicedExpected;
        @JsonProperty("isSpecialMora")
        private boolean specialMora;
        private String specialMoraType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WordPronunciationEvaluation {
        private String surface;
        private String reading;
        private Double score;
        private Integer accentType;
        private String accentOutcome;
        private Double startTime;
        private Double endTime;
        private List<MoraEvaluation> morae;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PronunciationErrorItem {
        private String type;
        private String word;
        private String reading;
        private String mora;
        private String expected;
        private String observed;
        private String severity;
        private String detail;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InsertionItem {
        private Double startTime;
        private Double endTime;
        private String content;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SpecialMoraSummary {
        private int sokuonTotal;
        private int sokuonIssues;
        private int moraicNTotal;
        private int moraicNIssues;
        private int longVowelTotal;
        private int longVowelIssues;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PronunciationSection {
        private boolean available;
        private String engine;
        private String alphaDisclaimer;
        @Builder.Default
        private List<MoraEvaluation> moraResults = new ArrayList<>();
        @Builder.Default
        private List<WordPronunciationEvaluation> wordResults = new ArrayList<>();
        private SpecialMoraSummary specialMoraSummary;
        @Builder.Default
        private List<PronunciationErrorItem> errors = new ArrayList<>();
        @Builder.Default
        private List<InsertionItem> insertions = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PitchPoint {
        private Double timeSec;
        private Double f0Hz;
        private Double semitone;
        private boolean voiced;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PauseSegment {
        private Double startSec;
        private Double endSec;
        private Double durationSec;
        private String severity;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReferenceIntonationComparison {
        private Double dtwMaeSemitones;
        private Double contourCorrelation;
        private Double durationRatio;
        private Integer pauseCountDelta;
        private Double referenceMedianF0Hz;
        private Double referencePitchRangeSemitones;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class IntonationSection {
        @Builder.Default
        private boolean experimental = true;
        private boolean f0Available;
        private boolean referenceComparisonAvailable;
        private String reliability;
        private Double confidence;
        private Double score;
        private Double medianF0Hz;
        private Double pitchRangeSemitones;
        private Double pitchStdSemitones;
        private Double voicedRatio;
        private String finalPitchMovement;
        private String expectedFinalMovement;
        private Boolean finalPitchMatch;
        private Double speakingDurationSec;
        private Double articulationRatio;
        @Builder.Default
        private List<PitchPoint> pitchContour = new ArrayList<>();
        @Builder.Default
        private List<PauseSegment> pauseAnalysis = new ArrayList<>();
        private ReferenceIntonationComparison referenceComparison;
        @Builder.Default
        private List<String> feedback = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AlignmentSegment {
        private String unit;
        private Double startTime;
        private Double endTime;
        private Double duration;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AlignmentSection {
        private boolean available;
        private String engine;
        private String note;
        @Builder.Default
        private List<AlignmentSegment> segments = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AsrSection {
        private boolean available;
        private String engine;
        private String language;
        private String recognizedText;
        private Double characterSimilarity;
        private String uncertaintyNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FeedbackExplanationItem {
        private String category;
        private String incorrectFragment;
        private String correctFragment;
        private String reason;
        private String suggestion;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FeedbackSection {
        private String source;
        private String summary;
        @Builder.Default
        private List<FeedbackExplanationItem> explanations = new ArrayList<>();
        @Builder.Default
        private List<String> practiceSuggestions = new ArrayList<>();
        private String encouragement;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AudioQualityInfo {
        private Double durationSec;
        private Integer sampleRate;
        private Integer originalSampleRate;
        private Integer originalChannels;
        private Long fileSizeBytes;
        private Double rmsDb;
        private Double peakAmplitude;
        private Double clippingRatio;
        private Double estimatedSnrDb;
        private List<String> warnings;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EvaluationMetadata {
        private Double audioDurationSec;
        private Integer sampleRate;
        private String deviceUsed;
        private Integer processingTimeMs;
        @Builder.Default
        private List<String> modelsUsed = new ArrayList<>();
        private AudioQualityInfo audioQuality;
    }
}
