package vn.vku.nihongoai.vocab;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.vocab.dto.TopicDto;

import java.util.List;

@RestController
@RequestMapping("/api/v1/topics")
@RequiredArgsConstructor
@Tag(name = "Topics", description = "Chủ đề từ vựng hệ thống")
public class TopicController {

    private final TopicService topicService;

    @GetMapping
    @Operation(summary = "Lấy danh sách các chủ đề từ vựng đang hoạt động")
    public ApiResponse<List<TopicDto>> getAllActiveTopics() {
        return ApiResponse.ok(topicService.getAllActiveTopics());
    }
}
