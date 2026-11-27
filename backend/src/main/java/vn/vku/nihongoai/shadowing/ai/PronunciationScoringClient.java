package vn.vku.nihongoai.shadowing.ai;

import com.fasterxml.jackson.databind.JsonNode;

public interface PronunciationScoringClient {
    JsonNode scorePronunciation(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText
    );
}
