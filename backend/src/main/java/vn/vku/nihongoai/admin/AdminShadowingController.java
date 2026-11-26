package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.common.PageMeta;
import vn.vku.nihongoai.furigana.FuriganaService;
import vn.vku.nihongoai.imports.ImportService;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.shadowing.*;
import vn.vku.nihongoai.shadowing.dto.ShadowingDialogueLineDto;
import vn.vku.nihongoai.shadowing.dto.ShadowingLessonDto;
import vn.vku.nihongoai.user.JlptLevel;
import vn.vku.nihongoai.vocab.Topic;
import vn.vku.nihongoai.vocab.TopicRepository;

import java.util.*;

@RestController
@RequestMapping("/api/v1/admin/shadowing/lessons")
@RequiredArgsConstructor
@Tag(name = "Admin Shadowing", description = "Quản lý bài luyện Shadowing hội thoại A/B và import Excel/CSV cho Admin")
public class AdminShadowingController {

    private final ShadowingLessonRepository lessonRepository;
    private final ShadowingDialogueLineRepository dialogueLineRepository;
    private final TopicRepository topicRepository;
    private final FuriganaService furiganaService;
    private final ImportService importService;
    private final AuditService auditService;

    @GetMapping
    @Transactional(readOnly = true)
    @Operation(summary = "Danh sách tất cả bài luyện Shadowing (hỗ trợ lọc DRAFT / PUBLISHED / ARCHIVED, chủ đề, JLPT)")
    public ApiResponse<List<ShadowingLessonDto>> getLessons(
            @RequestParam(required = false) JlptLevel level,
            @RequestParam(required = false) Long topicId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 50, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        String raw = (q != null && !q.isBlank()) ? q : search;
        String query = (raw != null && !raw.isBlank()) ? raw.trim() : "";
        String st = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status.trim().toUpperCase() : null;

        Page<ShadowingLessonDto> page = lessonRepository.searchAdminLessons(level, topicId, st, query, pageable)
                .map(l -> {
                    int cnt = (int) dialogueLineRepository.countByLessonId(l.getId());
                    return ShadowingLessonDto.from(l, null, null, cnt);
                });
        return ApiResponse.ok(page.getContent(), PageMeta.from(page));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    @Operation(summary = "Xem chi tiết bài Shadowing kèm toàn bộ các câu hội thoại A/B")
    public ApiResponse<ShadowingLessonDto> getOne(@PathVariable Long id) {
        ShadowingLesson lesson = lessonRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài Shadowing"));
        List<ShadowingDialogueLineDto> lines = dialogueLineRepository.findByLessonIdOrderByLineOrderAscIdAsc(id)
                .stream()
                .map(ShadowingDialogueLineDto::from)
                .toList();
        return ApiResponse.ok(ShadowingLessonDto.from(lesson, null, lines, lines.size()));
    }

    @PostMapping
    @Transactional
    @Operation(summary = "Tạo bài Shadowing mới (hỗ trợ cả hội thoại nhiều câu A/B và câu đơn)")
    public ApiResponse<ShadowingLessonDto> create(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @Valid @RequestBody ShadowingLessonDto dto
    ) {
        if (dto.getTitle() == null || dto.getTitle().isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tiêu đề bài Shadowing không được để trống");
        }
        Topic topic = dto.getTopicId() != null ? topicRepository.findById(dto.getTopicId()).orElse(null) : null;
        String status = normalizeStatus(dto.getStatus(), "PUBLISHED");

        List<ShadowingDialogueLineDto> incomingLines = dto.getLines() != null ? dto.getLines() : List.of();
        String summaryJa = (dto.getTextJa() != null && !dto.getTextJa().isBlank())
                ? dto.getTextJa().trim()
                : (!incomingLines.isEmpty() && incomingLines.get(0).getJapaneseText() != null
                    ? incomingLines.get(0).getJapaneseText().trim()
                    : dto.getTitle().trim());
        String summaryVi = (dto.getTextVi() != null && !dto.getTextVi().isBlank())
                ? dto.getTextVi().trim()
                : (!incomingLines.isEmpty() ? incomingLines.get(0).getVietnameseTranslation() : "");

        ShadowingLesson lesson = ShadowingLesson.builder()
                .title(dto.getTitle().trim())
                .description(dto.getDescription() != null ? dto.getDescription().trim() : null)
                .textJa(summaryJa)
                .textVi(summaryVi)
                .jlptLevel(dto.getJlptLevel() != null ? dto.getJlptLevel() : JlptLevel.N5)
                .topic(topic)
                .audioUrl(dto.getAudioUrl())
                .coverImageUrl(dto.getCoverImageUrl())
                .status(status)
                .isActive("PUBLISHED".equalsIgnoreCase(status))
                .isDialogue(incomingLines.size() > 1 || Boolean.TRUE.equals(dto.getIsDialogue()))
                .build();

        lesson = lessonRepository.save(lesson);
        List<ShadowingDialogueLineDto> savedLines = saveLinesForLesson(lesson, incomingLines, summaryJa, summaryVi);

        auditService.log(admin.getId(), "CREATE_SHADOWING_LESSON", "SHADOWING_LESSON", lesson.getId(), Map.of("title", lesson.getTitle(), "lineCount", savedLines.size()));
        return ApiResponse.ok(ShadowingLessonDto.from(lesson, null, savedLines, savedLines.size()), "Tạo bài Shadowing thành công");
    }

    @PutMapping("/{id}")
    @Transactional
    @Operation(summary = "Chỉnh sửa bài Shadowing và danh sách các câu hội thoại A/B")
    public ApiResponse<ShadowingLessonDto> update(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @Valid @RequestBody ShadowingLessonDto dto
    ) {
        ShadowingLesson lesson = lessonRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài Shadowing"));

        lesson.setTitle(dto.getTitle().trim());
        lesson.setDescription(dto.getDescription() != null ? dto.getDescription().trim() : null);
        if (dto.getJlptLevel() != null) {
            lesson.setJlptLevel(dto.getJlptLevel());
        }
        if (dto.getTopicId() != null) {
            Topic topic = topicRepository.findById(dto.getTopicId()).orElse(null);
            lesson.setTopic(topic);
        } else {
            lesson.setTopic(null);
        }
        lesson.setAudioUrl(dto.getAudioUrl());
        lesson.setCoverImageUrl(dto.getCoverImageUrl());

        if (dto.getStatus() != null && !dto.getStatus().isBlank()) {
            String status = normalizeStatus(dto.getStatus(), lesson.getStatus());
            lesson.setStatus(status);
            lesson.setIsActive("PUBLISHED".equalsIgnoreCase(status));
        }

        List<ShadowingDialogueLineDto> savedLines;
        if (dto.getLines() != null && !dto.getLines().isEmpty()) {
            String firstJa = dto.getLines().get(0).getJapaneseText() != null ? dto.getLines().get(0).getJapaneseText().trim() : lesson.getTextJa();
            String firstVi = dto.getLines().get(0).getVietnameseTranslation() != null ? dto.getLines().get(0).getVietnameseTranslation().trim() : lesson.getTextVi();
            lesson.setTextJa(dto.getTextJa() != null && !dto.getTextJa().isBlank() ? dto.getTextJa().trim() : firstJa);
            lesson.setTextVi(dto.getTextVi() != null && !dto.getTextVi().isBlank() ? dto.getTextVi().trim() : firstVi);
            lesson.setIsDialogue(dto.getLines().size() > 1 || Boolean.TRUE.equals(dto.getIsDialogue()));
            lesson = lessonRepository.save(lesson);
            savedLines = saveLinesForLesson(lesson, dto.getLines(), lesson.getTextJa(), lesson.getTextVi());
        } else {
            if (dto.getTextJa() != null && !dto.getTextJa().isBlank()) lesson.setTextJa(dto.getTextJa().trim());
            if (dto.getTextVi() != null) lesson.setTextVi(dto.getTextVi().trim());
            lesson = lessonRepository.save(lesson);
            savedLines = dialogueLineRepository.findByLessonIdOrderByLineOrderAscIdAsc(id)
                    .stream().map(ShadowingDialogueLineDto::from).toList();
        }

        auditService.log(admin.getId(), "UPDATE_SHADOWING_LESSON", "SHADOWING_LESSON", lesson.getId(), Map.of("title", lesson.getTitle(), "lineCount", savedLines.size()));
        return ApiResponse.ok(ShadowingLessonDto.from(lesson, null, savedLines, savedLines.size()), "Cập nhật bài Shadowing thành công");
    }

    @PatchMapping("/{id}/status")
    @Transactional
    @Operation(summary = "Đổi trạng thái xuất bản bài Shadowing (DRAFT / PUBLISHED / ARCHIVED)")
    public ApiResponse<ShadowingLessonDto> updateStatus(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        ShadowingLesson lesson = lessonRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài Shadowing"));

        String nextStatus = normalizeStatus(body.get("status"), lesson.getStatus());
        lesson.setStatus(nextStatus);
        lesson.setIsActive("PUBLISHED".equalsIgnoreCase(nextStatus));
        lesson = lessonRepository.save(lesson);

        int cnt = (int) dialogueLineRepository.countByLessonId(id);
        auditService.log(admin.getId(), "UPDATE_SHADOWING_STATUS", "SHADOWING_LESSON", id, body);
        return ApiResponse.ok(ShadowingLessonDto.from(lesson, null, null, cnt), "Đã cập nhật trạng thái bài Shadowing");
    }

    @PatchMapping("/{id}/active")
    @Transactional
    @Operation(summary = "Bật hoặc tắt trạng thái bài Shadowing (tương thích ngược)")
    public ApiResponse<ShadowingLessonDto> toggleActive(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        ShadowingLesson lesson = lessonRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài Shadowing"));

        boolean active = body.getOrDefault("isActive", true);
        lesson.setIsActive(active);
        lesson.setStatus(active ? "PUBLISHED" : "ARCHIVED");
        lesson = lessonRepository.save(lesson);

        int cnt = (int) dialogueLineRepository.countByLessonId(id);
        auditService.log(admin.getId(), "TOGGLE_SHADOWING_ACTIVE", "SHADOWING_LESSON", id, body);
        return ApiResponse.ok(ShadowingLessonDto.from(lesson, null, null, cnt), "Cập nhật trạng thái thành công");
    }

    @PostMapping(value = "/{id}/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Xem trước file Excel/CSV hội thoại A/B trước khi lưu vào bài Shadowing")
    public ApiResponse<Map<String, Object>> previewDialogueImport(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file
    ) {
        lessonRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài Shadowing"));
        return ApiResponse.ok(importService.parseDialogueFile(file));
    }

    @PostMapping("/{id}/import/commit")
    @Transactional
    @Operation(summary = "Lưu danh sách câu hội thoại A/B đã kiểm tra từ Excel/CSV vào PostgreSQL")
    public ApiResponse<ShadowingLessonDto> commitDialogueImport(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        ShadowingLesson lesson = lessonRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài Shadowing"));

        String mode = body.get("mode") != null ? body.get("mode").toString().trim().toUpperCase() : "REPLACE";
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawRows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        if (rawRows.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Không có dòng hội thoại hợp lệ nào để lưu");
        }

        if ("REPLACE".equals(mode)) {
            dialogueLineRepository.deleteByLessonId(id);
            dialogueLineRepository.flush();
        }

        int baseOrder = "APPEND".equals(mode) ? (int) dialogueLineRepository.countByLessonId(id) : 0;
        int idx = 1;
        List<ShadowingDialogueLine> toSave = new ArrayList<>();
        for (Map<String, Object> r : rawRows) {
            if (Boolean.FALSE.equals(r.get("valid"))) continue;
            String ja = r.get("japaneseText") != null ? r.get("japaneseText").toString().trim() : "";
            if (ja.isEmpty()) continue;

            String speaker = r.get("speaker") != null && !r.get("speaker").toString().isBlank()
                    ? r.get("speaker").toString().trim()
                    : (idx % 2 == 1 ? "A" : "B");
            String hira = r.get("hiraganaText") != null ? r.get("hiraganaText").toString().trim() : "";
            if (hira.isEmpty()) {
                hira = furiganaService.toFullHiragana(ja);
            }
            String vi = r.get("vietnameseTranslation") != null ? r.get("vietnameseTranslation").toString().trim() : "";
            int ord = baseOrder + idx;
            if (!"APPEND".equals(mode) && r.get("lineOrder") instanceof Number n) {
                ord = n.intValue();
            }

            toSave.add(ShadowingDialogueLine.builder()
                    .lesson(lesson)
                    .lineOrder(ord)
                    .speaker(speaker)
                    .japaneseText(ja)
                    .hiraganaText(hira)
                    .vietnameseTranslation(vi)
                    .build());
            idx++;
        }

        if (toSave.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Không tìm thấy câu tiếng Nhật hợp lệ trong danh sách import");
        }

        dialogueLineRepository.saveAll(toSave);
        List<ShadowingDialogueLine> allLines = dialogueLineRepository.findByLessonIdOrderByLineOrderAscIdAsc(id);
        lesson.setIsDialogue(allLines.size() > 1);
        if (!allLines.isEmpty()) {
            lesson.setTextJa(allLines.get(0).getJapaneseText());
            lesson.setTextVi(allLines.get(0).getVietnameseTranslation());
        }
        lesson = lessonRepository.save(lesson);

        List<ShadowingDialogueLineDto> lineDtos = allLines.stream().map(ShadowingDialogueLineDto::from).toList();
        auditService.log(admin.getId(), "IMPORT_SHADOWING_DIALOGUE", "SHADOWING_LESSON", id, Map.of("importedLines", toSave.size(), "mode", mode));
        return ApiResponse.ok(
                ShadowingLessonDto.from(lesson, null, lineDtos, lineDtos.size()),
                String.format("Đã import thành công %d câu hội thoại vào bài Shadowing", toSave.size())
        );
    }

    @DeleteMapping("/{id}")
    @Transactional
    @Operation(summary = "Xóa bài luyện Shadowing")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id
    ) {
        ShadowingLesson lesson = lessonRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài Shadowing"));

        lessonRepository.delete(lesson);
        auditService.log(admin.getId(), "DELETE_SHADOWING_LESSON", "SHADOWING_LESSON", id, null);
        return ApiResponse.ok(null, "Xóa bài Shadowing thành công");
    }

    private List<ShadowingDialogueLineDto> saveLinesForLesson(
            ShadowingLesson lesson,
            List<ShadowingDialogueLineDto> incomingLines,
            String fallbackJa,
            String fallbackVi
    ) {
        dialogueLineRepository.deleteByLessonId(lesson.getId());
        dialogueLineRepository.flush();

        List<ShadowingDialogueLine> entities = new ArrayList<>();
        if (incomingLines == null || incomingLines.isEmpty()) {
            entities.add(ShadowingDialogueLine.builder()
                    .lesson(lesson)
                    .lineOrder(1)
                    .speaker("A")
                    .japaneseText(fallbackJa)
                    .hiraganaText(furiganaService.toFullHiragana(fallbackJa))
                    .vietnameseTranslation(fallbackVi)
                    .build());
        } else {
            int order = 1;
            for (ShadowingDialogueLineDto item : incomingLines) {
                if (item.getJapaneseText() == null || item.getJapaneseText().isBlank()) continue;
                String ja = item.getJapaneseText().trim();
                String hira = (item.getHiraganaText() != null && !item.getHiraganaText().isBlank())
                        ? item.getHiraganaText().trim()
                        : furiganaService.toFullHiragana(ja);
                String speaker = (item.getSpeaker() != null && !item.getSpeaker().isBlank())
                        ? item.getSpeaker().trim()
                        : (order % 2 == 1 ? "A" : "B");
                entities.add(ShadowingDialogueLine.builder()
                        .lesson(lesson)
                        .lineOrder(item.getLineOrder() != null ? item.getLineOrder() : order)
                        .speaker(speaker)
                        .japaneseText(ja)
                        .hiraganaText(hira)
                        .vietnameseTranslation(item.getVietnameseTranslation() != null ? item.getVietnameseTranslation().trim() : "")
                        .audioUrl(item.getAudioUrl())
                        .build());
                order++;
            }
        }

        List<ShadowingDialogueLine> saved = dialogueLineRepository.saveAll(entities);
        return saved.stream().map(ShadowingDialogueLineDto::from).toList();
    }

    private String normalizeStatus(String raw, String fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback != null ? fallback : "PUBLISHED";
        }
        String up = raw.trim().toUpperCase();
        if (!up.equals("DRAFT") && !up.equals("PUBLISHED") && !up.equals("ARCHIVED")) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Trạng thái không hợp lệ. Chỉ chấp nhận: DRAFT, PUBLISHED, ARCHIVED");
        }
        return up;
    }
}
