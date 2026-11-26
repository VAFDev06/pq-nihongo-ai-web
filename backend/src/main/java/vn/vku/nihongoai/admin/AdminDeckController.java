package vn.vku.nihongoai.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.*;
import vn.vku.nihongoai.flashcard.dto.CreateDeckRequest;
import vn.vku.nihongoai.flashcard.dto.CreateFlashcardRequest;
import vn.vku.nihongoai.flashcard.dto.DeckDto;
import vn.vku.nihongoai.flashcard.dto.FlashcardDto;
import vn.vku.nihongoai.security.UserDetailsImpl;
import vn.vku.nihongoai.vocab.Topic;
import vn.vku.nihongoai.vocab.TopicRepository;
import vn.vku.nihongoai.vocab.Vocabulary;
import vn.vku.nihongoai.vocab.VocabularyRepository;

import java.util.*;

@RestController
@RequestMapping("/api/v1/admin/decks")
@RequiredArgsConstructor
@Tag(name = "Admin Decks", description = "Quản lý toàn diện các bộ thẻ mẫu hệ thống (Draft / Published / Archived) đồng bộ với USER")
public class AdminDeckController {

    private final DeckRepository deckRepository;
    private final FlashcardRepository flashcardRepository;
    private final CardProgressRepository cardProgressRepository;
    private final TopicRepository topicRepository;
    private final VocabularyRepository vocabularyRepository;
    private final vn.vku.nihongoai.imports.ImportService importService;
    private final AuditService auditService;

    @GetMapping
    @Transactional(readOnly = true)
    @Operation(summary = "Lấy toàn bộ danh sách bộ thẻ mẫu hệ thống (hỗ trợ lọc theo trạng thái DRAFT/PUBLISHED/ARCHIVED)")
    public ApiResponse<List<DeckDto>> getAll(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @RequestParam(required = false) DeckStatus status
    ) {
        List<Deck> decks = deckRepository.findAllSystemDecks(status);
        List<DeckDto> dtos = decks.stream().map(d -> {
            long total = flashcardRepository.countByDeckId(d.getId());
            return DeckDto.from(d, admin.getId(), total, 0);
        }).toList();
        return ApiResponse.ok(dtos);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    @Operation(summary = "Xem chi tiết một bộ thẻ mẫu hệ thống")
    public ApiResponse<DeckDto> getOne(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id
    ) {
        Deck deck = deckRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));
        long total = flashcardRepository.countByDeckId(deck.getId());
        return ApiResponse.ok(DeckDto.from(deck, admin.getId(), total, 0));
    }

    @PostMapping
    @Transactional
    @Operation(summary = "Tạo bộ thẻ mẫu mới của hệ thống")
    public ApiResponse<DeckDto> create(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @Valid @RequestBody CreateDeckRequest request
    ) {
        Topic topic = request.getTopicId() != null ? topicRepository.findById(request.getTopicId()).orElse(null) : null;
        DeckStatus status = resolveStatus(request.getStatus(), request.getIsPublic(), DeckStatus.DRAFT);

        Deck deck = Deck.builder()
                .name(request.getName().trim())
                .description(request.getDescription() != null ? request.getDescription().trim() : null)
                .jlptLevel(request.getJlptLevel())
                .topic(topic)
                .coverImageUrl(request.getCoverImageUrl() != null && !request.getCoverImageUrl().isBlank()
                        ? request.getCoverImageUrl().trim() : null)
                .status(status)
                .isSystem(true)
                .isPublic(status == DeckStatus.PUBLISHED)
                .isActive(status != DeckStatus.ARCHIVED)
                .build();

        deck = deckRepository.save(deck);
        auditService.log(admin.getId(), "CREATE_ADMIN_DECK", "DECK", deck.getId(), request);
        return ApiResponse.ok(DeckDto.from(deck, admin.getId(), 0, 0), "Tạo bộ thẻ mẫu thành công");
    }

    @PutMapping("/{id}")
    @Transactional
    @Operation(summary = "Chỉnh sửa thông tin bộ thẻ mẫu hệ thống (cập nhật trực tiếp không làm mất lịch sử SRS của USER)")
    public ApiResponse<DeckDto> update(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @Valid @RequestBody CreateDeckRequest request
    ) {
        Deck deck = deckRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        deck.setName(request.getName().trim());
        deck.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        deck.setJlptLevel(request.getJlptLevel());
        if (request.getCoverImageUrl() != null) {
            deck.setCoverImageUrl(request.getCoverImageUrl().isBlank() ? null : request.getCoverImageUrl().trim());
        }
        if (request.getTopicId() != null) {
            Topic topic = topicRepository.findById(request.getTopicId()).orElse(null);
            deck.setTopic(topic);
        } else {
            deck.setTopic(null);
        }

        if (request.getStatus() != null || request.getIsPublic() != null) {
            DeckStatus nextStatus = resolveStatus(request.getStatus(), request.getIsPublic(), deck.getStatus());
            applyStatus(deck, nextStatus);
        }

        deck = deckRepository.save(deck);
        auditService.log(admin.getId(), "UPDATE_ADMIN_DECK", "DECK", deck.getId(), request);
        long total = flashcardRepository.countByDeckId(deck.getId());
        return ApiResponse.ok(DeckDto.from(deck, admin.getId(), total, 0), "Cập nhật bộ thẻ mẫu thành công");
    }

    @PatchMapping("/{id}/status")
    @Transactional
    @Operation(summary = "Thay đổi trạng thái xuất bản bộ thẻ mẫu (DRAFT / PUBLISHED / ARCHIVED)")
    public ApiResponse<DeckDto> updateStatus(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        Deck deck = deckRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        String rawStatus = body.get("status");
        if (rawStatus == null || rawStatus.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Trạng thái bộ thẻ không được để trống (DRAFT, PUBLISHED, ARCHIVED)");
        }
        DeckStatus nextStatus;
        try {
            nextStatus = DeckStatus.valueOf(rawStatus.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Trạng thái không hợp lệ. Chỉ chấp nhận: DRAFT, PUBLISHED, ARCHIVED");
        }

        applyStatus(deck, nextStatus);
        deck = deckRepository.save(deck);
        auditService.log(admin.getId(), "UPDATE_ADMIN_DECK_STATUS", "DECK", id, body);
        long total = flashcardRepository.countByDeckId(deck.getId());

        String msg = switch (nextStatus) {
            case PUBLISHED -> "Đã xuất bản bộ thẻ mẫu (học viên đã có thể nhìn thấy)";
            case DRAFT -> "Đã chuyển bộ thẻ về Bản nháp (chỉ Admin nhìn thấy)";
            case ARCHIVED -> "Đã lưu trữ bộ thẻ mẫu (ẩn khỏi danh sách đang hoạt động của học viên)";
        };
        return ApiResponse.ok(DeckDto.from(deck, admin.getId(), total, 0), msg);
    }

    @PatchMapping("/{id}/public")
    @Transactional
    @Operation(summary = "Bật hoặc tắt trạng thái công khai của bộ thẻ (tương thích ngược)")
    public ApiResponse<DeckDto> togglePublic(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body
    ) {
        Deck deck = deckRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        boolean isPublic = body.getOrDefault("isPublic", true);
        applyStatus(deck, isPublic ? DeckStatus.PUBLISHED : DeckStatus.DRAFT);
        deck = deckRepository.save(deck);

        auditService.log(admin.getId(), "TOGGLE_DECK_PUBLIC", "DECK", id, body);
        long total = flashcardRepository.countByDeckId(deck.getId());
        return ApiResponse.ok(DeckDto.from(deck, admin.getId(), total, 0), "Cập nhật trạng thái thành công");
    }

    @GetMapping("/{id}/cards")
    @Transactional(readOnly = true)
    @Operation(summary = "Xem danh sách thẻ theo đúng thứ tự trong bộ thẻ mẫu hệ thống")
    public ApiResponse<List<FlashcardDto>> getCards(@PathVariable Long id) {
        deckRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));
        return ApiResponse.ok(flashcardRepository.findAllByDeckIdOrderByPositionAsc(id)
                .stream()
                .map(FlashcardDto::from)
                .toList());
    }

    @PostMapping("/{id}/cards")
    @Transactional
    @Operation(summary = "Thêm thẻ mới vào bộ thẻ mẫu hệ thống")
    public ApiResponse<FlashcardDto> addCard(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @Valid @RequestBody CreateFlashcardRequest request
    ) {
        Deck deck = deckRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        int nextPos = (int) flashcardRepository.countByDeckId(id) + 1;
        Flashcard card = Flashcard.builder()
                .deck(deck)
                .front(request.getFront().trim())
                .reading(request.getReading() != null && !request.getReading().isBlank() ? request.getReading().trim() : null)
                .back(request.getBack().trim())
                .partOfSpeech(request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank() ? request.getPartOfSpeech().trim() : null)
                .hanViet(request.getHanViet() != null && !request.getHanViet().isBlank() ? request.getHanViet().trim() : null)
                .exampleJa(request.getExampleJa() != null && !request.getExampleJa().isBlank() ? request.getExampleJa().trim() : null)
                .exampleVi(request.getExampleVi() != null && !request.getExampleVi().isBlank() ? request.getExampleVi().trim() : null)
                .exampleReading(request.getExampleReading() != null && !request.getExampleReading().isBlank() ? request.getExampleReading().trim() : null)
                .imageUrl(request.getImageUrl())
                .note(request.getNote())
                .position(nextPos)
                .build();
        card = flashcardRepository.save(card);
        auditService.log(admin.getId(), "ADD_ADMIN_CARD", "FLASHCARD", card.getId(), request);
        return ApiResponse.ok(FlashcardDto.from(card), "Thêm thẻ vào bộ mẫu thành công");
    }

    @PostMapping("/{id}/cards/from-system-vocab")
    @Transactional
    @Operation(summary = "Chọn nhiều từ vựng từ Kho từ vựng hệ thống để thêm vào bộ thẻ mẫu")
    public ApiResponse<List<FlashcardDto>> addCardsFromSystemVocab(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestBody Map<String, List<Long>> body
    ) {
        Deck deck = deckRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        List<Long> vocabIds = body.getOrDefault("vocabularyIds", List.of());
        if (vocabIds.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Vui lòng chọn ít nhất một từ vựng hệ thống");
        }

        int nextPos = (int) flashcardRepository.countByDeckId(id);
        List<FlashcardDto> created = new ArrayList<>();
        for (Long vocabId : vocabIds) {
            Optional<Vocabulary> vocabOpt = vocabularyRepository.findById(vocabId);
            if (vocabOpt.isEmpty()) continue;
            Vocabulary v = vocabOpt.get();
            boolean exists = flashcardRepository.findByDeckIdAndFrontAndReading(id, v.getWord(), v.getReading()).isPresent();
            if (!exists) {
                nextPos++;
                Flashcard card = Flashcard.builder()
                        .deck(deck)
                        .front(v.getWord())
                        .reading(v.getReading())
                        .back(v.getMeaningVi())
                        .partOfSpeech(v.getPartOfSpeech())
                        .hanViet(v.getHanViet())
                        .exampleJa(v.getExampleJa())
                        .exampleVi(v.getExampleVi())
                        .exampleReading(v.getExampleReading())
                        .imageUrl(v.getImageUrl())
                        .position(nextPos)
                        .build();
                card = flashcardRepository.save(card);
                created.add(FlashcardDto.from(card));
            }
        }
        auditService.log(admin.getId(), "ADD_ADMIN_CARDS_FROM_VOCAB", "DECK", id, Map.of("addedCount", created.size()));
        return ApiResponse.ok(created, String.format("Đã thêm %d thẻ mới từ kho từ vựng hệ thống", created.size()));
    }

    @PutMapping("/{deckId}/cards/{cardId}")
    @Transactional
    @Operation(summary = "Chỉnh sửa nội dung thẻ trong bộ mẫu hệ thống")
    public ApiResponse<FlashcardDto> updateCard(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long deckId,
            @PathVariable Long cardId,
            @Valid @RequestBody CreateFlashcardRequest request
    ) {
        Flashcard card = flashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy thẻ"));
        if (!card.getDeck().getId().equals(deckId)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Thẻ không thuộc bộ thẻ này");
        }

        card.setFront(request.getFront().trim());
        card.setReading(request.getReading() != null && !request.getReading().isBlank() ? request.getReading().trim() : null);
        card.setBack(request.getBack().trim());
        card.setPartOfSpeech(request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank() ? request.getPartOfSpeech().trim() : null);
        card.setHanViet(request.getHanViet() != null && !request.getHanViet().isBlank() ? request.getHanViet().trim() : null);
        card.setExampleJa(request.getExampleJa() != null && !request.getExampleJa().isBlank() ? request.getExampleJa().trim() : null);
        card.setExampleVi(request.getExampleVi() != null && !request.getExampleVi().isBlank() ? request.getExampleVi().trim() : null);
        card.setExampleReading(request.getExampleReading() != null && !request.getExampleReading().isBlank() ? request.getExampleReading().trim() : null);
        card.setNote(request.getNote());

        card = flashcardRepository.save(card);
        auditService.log(admin.getId(), "UPDATE_ADMIN_CARD", "FLASHCARD", cardId, request);
        return ApiResponse.ok(FlashcardDto.from(card), "Cập nhật thẻ thành công");
    }

    @PatchMapping("/{deckId}/cards/reorder")
    @Transactional
    @Operation(summary = "Sắp xếp lại thứ tự các thẻ trong bộ thẻ mẫu")
    public ApiResponse<List<FlashcardDto>> reorderCards(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long deckId,
            @RequestBody Map<String, List<Long>> body
    ) {
        deckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        List<Long> orderedIds = body.getOrDefault("cardIds", List.of());
        List<Flashcard> cards = flashcardRepository.findAllByDeckIdOrderByPositionAsc(deckId);
        Map<Long, Flashcard> map = new HashMap<>();
        for (Flashcard c : cards) map.put(c.getId(), c);

        int pos = 1;
        for (Long cid : orderedIds) {
            Flashcard c = map.remove(cid);
            if (c != null) {
                c.setPosition(pos++);
                flashcardRepository.save(c);
            }
        }
        for (Flashcard remaining : map.values()) {
            remaining.setPosition(pos++);
            flashcardRepository.save(remaining);
        }

        auditService.log(admin.getId(), "REORDER_ADMIN_CARDS", "DECK", deckId, body);
        return ApiResponse.ok(flashcardRepository.findAllByDeckIdOrderByPositionAsc(deckId)
                .stream().map(FlashcardDto::from).toList(), "Đã cập nhật thứ tự thẻ");
    }

    @DeleteMapping("/{deckId}/cards/{cardId}")
    @Transactional
    @Operation(summary = "Xóa thẻ khỏi bộ thẻ mẫu hệ thống (không ảnh hưởng từ vựng hệ thống hoặc sổ cá nhân của học viên)")
    public ApiResponse<Void> deleteCard(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long deckId,
            @PathVariable Long cardId
    ) {
        Flashcard card = flashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy thẻ"));
        if (!card.getDeck().getId().equals(deckId)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Thẻ không thuộc bộ thẻ này");
        }
        flashcardRepository.delete(card);
        auditService.log(admin.getId(), "DELETE_ADMIN_CARD", "FLASHCARD", cardId, null);
        return ApiResponse.ok(null, "Đã xóa thẻ khỏi bộ mẫu");
    }

    @DeleteMapping("/{id}")
    @Transactional
    @Operation(summary = "Xóa hoặc lưu trữ an toàn bộ thẻ mẫu hệ thống (bảo toàn dữ liệu học SRS của học viên)")
    public ApiResponse<Map<String, Object>> delete(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id
    ) {
        Deck deck = deckRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ flashcard"));

        long activeLearnersProgress = cardProgressRepository.countAllProgressByDeckId(id);
        if (activeLearnersProgress > 0) {
            // Đã có học viên học SRS bộ này -> chuyển sang ARCHIVED thay vì xóa cứng để bảo toàn lịch sử SRS của USER
            applyStatus(deck, DeckStatus.ARCHIVED);
            deckRepository.save(deck);
            auditService.log(admin.getId(), "ARCHIVE_ADMIN_DECK_SAFE", "DECK", id, Map.of("progressCount", activeLearnersProgress));
            return ApiResponse.ok(
                    Map.of("action", "ARCHIVED", "id", id),
                    "Bộ thẻ này đã có dữ liệu ôn tập SRS của học viên nên đã được chuyển sang Lưu trữ (Archived) để bảo toàn lịch sử học."
            );
        }

        deckRepository.delete(deck);
        auditService.log(admin.getId(), "DELETE_ADMIN_DECK", "DECK", id, null);
        return ApiResponse.ok(Map.of("action", "DELETED", "id", id), "Đã xóa bộ thẻ mẫu thành công");
    }

    @PostMapping(value = "/{id}/import/preview", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Xem trước file Excel/CSV trước khi import thẻ vào bộ thẻ mẫu hệ thống")
    public ApiResponse<vn.vku.nihongoai.imports.dto.ImportPreviewResponse> previewDeckImport(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file
    ) {
        return ApiResponse.ok(importService.previewAdminDeckImport(admin.getId(), id, file));
    }

    @PostMapping("/{id}/import/commit")
    @Operation(summary = "Xác nhận import danh sách thẻ từ Excel/CSV vào bộ thẻ mẫu hệ thống (không ảnh hưởng SRS cá nhân)")
    public ApiResponse<vn.vku.nihongoai.imports.ImportJob> commitDeckImport(
            @AuthenticationPrincipal UserDetailsImpl admin,
            @PathVariable Long id,
            @Valid @RequestBody vn.vku.nihongoai.imports.dto.CommitImportRequest request
    ) {
        vn.vku.nihongoai.imports.ImportJob job = importService.commitImport(admin.getId(), request);
        auditService.log(admin.getId(), "IMPORT_ADMIN_DECK_CARDS", "DECK", id, Map.of(
                "jobId", job.getId(),
                "successRows", job.getSuccessRows(),
                "skippedRows", job.getSkippedRows()
        ));
        return ApiResponse.ok(job, String.format("Đã import thành công %d thẻ vào bộ mẫu (bỏ qua %d dòng)", job.getSuccessRows(), job.getSkippedRows()));
    }

    private DeckStatus resolveStatus(DeckStatus requestedStatus, Boolean isPublic, DeckStatus fallback) {
        if (requestedStatus != null) return requestedStatus;
        if (isPublic != null) return isPublic ? DeckStatus.PUBLISHED : DeckStatus.DRAFT;
        return fallback != null ? fallback : DeckStatus.DRAFT;
    }

    private void applyStatus(Deck deck, DeckStatus status) {
        deck.setStatus(status);
        deck.setIsPublic(status == DeckStatus.PUBLISHED);
        deck.setIsActive(status != DeckStatus.ARCHIVED);
    }
}
