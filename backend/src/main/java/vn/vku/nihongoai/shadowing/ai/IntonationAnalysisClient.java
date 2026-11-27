package vn.vku.nihongoai.shadowing.ai;

import com.fasterxml.jackson.databind.JsonNode;

public interface IntonationAnalysisClient {
    JsonNode analyzeIntonation(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText,
            byte[] referenceAudioBytes,
            String referenceFilename,
            String referenceContentType
    );
}
