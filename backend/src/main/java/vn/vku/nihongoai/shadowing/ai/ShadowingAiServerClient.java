package vn.vku.nihongoai.shadowing.ai;

import vn.vku.nihongoai.shadowing.dto.ShadowingAiStatusDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;

/**
 * Facade interface for communicating with the Private Shadowing AI Model Server.
 */
public interface ShadowingAiServerClient
        extends SpeechRecognitionClient, ForcedAlignmentClient, PronunciationScoringClient, IntonationAnalysisClient {

    ShadowingEvaluationResultDto evaluateShadowing(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText,
            byte[] referenceAudioBytes,
            String referenceFilename,
            String referenceContentType,
            String jlptLevel
    );

    ShadowingAiStatusDto checkHealth();
}
