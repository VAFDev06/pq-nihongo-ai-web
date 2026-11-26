package vn.vku.nihongoai.vocab;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vku.nihongoai.vocab.dto.TopicDto;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TopicService {

    private final TopicRepository topicRepository;

    @Transactional(readOnly = true)
    public List<TopicDto> getAllActiveTopics() {
        return topicRepository.findAllByIsActiveTrueOrderByCreatedAtAsc()
                .stream()
                .map(TopicDto::from)
                .toList();
    }
}
