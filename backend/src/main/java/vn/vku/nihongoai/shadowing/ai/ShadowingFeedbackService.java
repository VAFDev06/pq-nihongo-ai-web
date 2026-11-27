package vn.vku.nihongoai.shadowing.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vku.nihongoai.furigana.FuriganaService;
import vn.vku.nihongoai.furigana.FuriganaToken;
import vn.vku.nihongoai.shadowing.ShadowingScoringService;
import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;
import vn.vku.nihongoai.shadowing.dto.WordDiffItem;
import vn.vku.nihongoai.shadowing.dto.WordDiffStatus;

import java.util.ArrayList;
import java.util.List;

/**
 * Combines structured AI evaluation results with existing Spring Boot Kuromoji services
 * (FuriganaService + ShadowingScoringService) and ensures deterministic Vietnamese learner
 * feedback is always present without calling Gemini API.
 */
@Service
@RequiredArgsConstructor
public class ShadowingFeedbackService {

    private final FuriganaService furiganaService;
    private final ShadowingScoringService scoringService;

    public ShadowingEvaluationResultDto enrichWithKuromojiAndFeedback(
            ShadowingEvaluationResultDto evaluation,
            String referenceText
    ) {
        String ref = referenceText != null ? referenceText.trim() : "";
        String recognized = evaluation.getRecognizedText() != null ? evaluation.getRecognizedText().trim() : "";

        // Step 7: Reuse existing Kuromoji tokenization & reading extraction (no duplicate tokenizer!)
        List<FuriganaToken> kuromojiTokens = furiganaService.generateFurigana(ref);
        String referenceReading = furiganaService.toFullHiragana(ref);
        ShadowingScoringService.ScoreResult kuromojiScore = scoringService.score(ref, recognized);

        evaluation.setReferenceText(ref);
        evaluation.setReferenceReading(referenceReading);
        evaluation.setKuromojiTokens(kuromojiTokens);
        evaluation.setWordDiff(kuromojiScore.getWordDiff());

        if (evaluation.getScores() == null) {
            evaluation.setScores(new ShadowingEvaluationResultDto.ScoreBreakdown());
        }
        evaluation.getScores().setKuromojiTokenAccuracy(kuromojiScore.getAccuracy());

        // Ensure Vietnamese learner feedback is always populated and grounded on real diff + acoustic data
        ShadowingEvaluationResultDto.FeedbackSection fb = evaluation.getFeedback();
        if (fb == null) {
            fb = ShadowingEvaluationResultDto.FeedbackSection.builder()
                    .source("TEMPLATE")
                    .explanations(new ArrayList<>())
                    .practiceSuggestions(new ArrayList<>())
                    .build();
            evaluation.setFeedback(fb);
        }

        if (fb.getExplanations() == null) {
            fb.setExplanations(new ArrayList<>());
        }
        if (fb.getPracticeSuggestions() == null) {
            fb.setPracticeSuggestions(new ArrayList<>());
        }

        // Add concrete Kuromoji token-level missing/wrong word feedback if not already explained
        List<WordDiffItem> tokenIssues = kuromojiScore.getWordDiff().stream()
                .filter(w -> w.getStatus() == WordDiffStatus.MISSING || w.getStatus() == WordDiffStatus.WRONG)
                .toList();

        if (!tokenIssues.isEmpty()) {
            boolean hasAsrDetail = fb.getExplanations().stream()
                    .anyMatch(e -> "KUROMOJI_TOKEN".equals(e.getCategory()));
            if (!hasAsrDetail) {
                for (WordDiffItem issue : tokenIssues.stream().limit(2).toList()) {
                    String reading = furiganaService.toFullHiragana(issue.getText());
                    String correctLabel = reading != null && !reading.isBlank() && !reading.equals(issue.getText())
                            ? issue.getText() + " (" + reading + ")"
                            : issue.getText();

                    if (issue.getStatus() == WordDiffStatus.MISSING) {
                        fb.getExplanations().add(
                                ShadowingEvaluationResultDto.FeedbackExplanationItem.builder()
                                        .category("KUROMOJI_TOKEN")
                                        .incorrectFragment("(bị thiếu)")
                                        .correctFragment(correctLabel)
                                        .reason("Từ/trợ từ 「" + issue.getText() + "」 chưa xuất hiện trong văn bản ASR nhận diện (lưu ý: cũng có thể do đọc nối quá nhanh hoặc giới hạn ASR).")
                                        .suggestion("Đọc chậm và tách rõ âm 「" + correctLabel + "」 khi luyện lại.")
                                        .build()
                        );
                    } else {
                        fb.getExplanations().add(
                                ShadowingEvaluationResultDto.FeedbackExplanationItem.builder()
                                        .category("KUROMOJI_TOKEN")
                                        .incorrectFragment(issue.getHeard() != null ? issue.getHeard() : "(nhầm âm)")
                                        .correctFragment(correctLabel)
                                        .reason("ASR nhận diện thành 「" + issue.getHeard() + "」 thay vì 「" + correctLabel + "」.")
                                        .suggestion("Nghe lại câu mẫu để phân biệt cách phát âm của 「" + correctLabel + "」.")
                                        .build()
                        );
                    }
                }
            }
        }

        if (fb.getSummary() == null || fb.getSummary().isBlank()) {
            Double overall = evaluation.getScores().getOverall();
            if (overall != null) {
                fb.setSummary(String.format("Điểm phát âm tổng quan: %.1f/100 (khớp từ Kuromoji: %.1f%%).",
                        overall, kuromojiScore.getAccuracy()));
            } else {
                fb.setSummary(String.format("Đã đối chiếu văn bản tiếng Nhật (độ khớp từ Kuromoji: %.1f%%).",
                        kuromojiScore.getAccuracy()));
            }
        }

        if (fb.getEncouragement() == null || fb.getEncouragement().isBlank()) {
            fb.setEncouragement("Hãy luyện lặp lại từng câu chậm rãi rồi tăng dần tốc độ để cải thiện phản xạ Shadowing!");
        }

        return evaluation;
    }

    /**
     * Builds a degraded Kuromoji-only evaluation when the private AI server is temporarily unreachable
     * and the client explicitly supplies a browser fallback transcript. Never fabricates acoustic scores.
     */
    public ShadowingEvaluationResultDto buildFallbackDegradedEvaluation(
            String referenceText,
            String fallbackRecognizedText,
            String warningMessage
    ) {
        ShadowingEvaluationResultDto degraded = ShadowingEvaluationResultDto.builder()
                .referenceText(referenceText)
                .recognizedText(fallbackRecognizedText != null ? fallbackRecognizedText.trim() : "")
                .status("PARTIAL")
                .scores(ShadowingEvaluationResultDto.ScoreBreakdown.builder()
                        .overall(null)
                        .accuracy(null)
                        .completeness(null)
                        .pitchAccent(null)
                        .intonation(null)
                        .timing(null)
                        .build())
                .pronunciation(ShadowingEvaluationResultDto.PronunciationSection.builder()
                        .available(false)
                        .engine("hatsuon")
                        .build())
                .intonation(ShadowingEvaluationResultDto.IntonationSection.builder()
                        .experimental(true)
                        .f0Available(false)
                        .reliability("UNRELIABLE")
                        .build())
                .alignment(ShadowingEvaluationResultDto.AlignmentSection.builder()
                        .available(false)
                        .engine("Qwen/Qwen3-ForcedAligner-0.6B")
                        .build())
                .asr(ShadowingEvaluationResultDto.AsrSection.builder()
                        .available(false)
                        .engine("browser-fallback")
                        .recognizedText(fallbackRecognizedText != null ? fallbackRecognizedText.trim() : "")
                        .build())
                .warnings(new ArrayList<>(List.of(warningMessage)))
                .confidence(null)
                .build();

        return enrichWithKuromojiAndFeedback(degraded, referenceText);
    }
}
