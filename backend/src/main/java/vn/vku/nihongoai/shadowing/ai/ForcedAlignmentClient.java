package vn.vku.nihongoai.shadowing.ai;

import vn.vku.nihongoai.shadowing.dto.ShadowingEvaluationResultDto;

public interface ForcedAlignmentClient {
    ShadowingEvaluationResultDto.AlignmentSection align(
            byte[] audioBytes,
            String filename,
            String contentType,
            String referenceText
    );
}
