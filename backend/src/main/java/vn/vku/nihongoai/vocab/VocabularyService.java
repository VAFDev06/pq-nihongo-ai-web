package vn.vku.nihongoai.vocab;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.vocab.dto.VocabularyDto;

@Service
@RequiredArgsConstructor
public class VocabularyService {

    private final VocabularyRepository vocabularyRepository;

    @Transactional(readOnly = true)
    public Page<VocabularyDto> searchSystemVocab(JlptLevel level, Long topicId, String q, Pageable pageable) {
        String cleanQuery = (q != null && !q.isBlank()) ? q.trim() : "";
        return vocabularyRepository.searchSystemVocab(level, topicId, cleanQuery, pageable)
                .map(VocabularyDto::from);
    }

    @Transactional(readOnly = true)
    public Vocabulary getVocabularyOrThrow(Long id) {
        return vocabularyRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy từ vựng hệ thống với ID: " + id));
    }
}
