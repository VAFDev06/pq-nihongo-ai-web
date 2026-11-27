package vn.vku.nihongoai.shadowing.ai;

import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;

public interface SpeechRecognitionClient {
    ShadowingEvaluationResultDto.AsrSection transcribe(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText
    );
}
