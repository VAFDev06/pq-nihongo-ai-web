package vn.vku.nihongoai.flashcard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.flashcard.dto.*;
import vn.vku.nihongoai.security.UserDetailsImpl;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Flashcard Decks", description = "Quản lý bộ thẻ và các thẻ ghi nhớ Flashcard")
public class DeckController {

    private final DeckService deckService;

    @GetMapping("/decks")
    @Operation(summary = "Lấy danh sách các bộ flashcard (của tôi + công khai)")
    public ApiResponse<List<DeckDto>> getDecks(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam(required = false, defaultValue = "all") String scope
    ) {
        return ApiResponse.ok(deckService.getDecks(userDetails.getId(), scope));
    }

    @GetMapping({"/decks/system", "/decks/public"})
    @Operation(summary = "Lấy danh sách các bộ thẻ mẫu hệ thống")
    public ApiResponse<List<DeckDto>> getSystemDecks(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ApiResponse.ok(deckService.getDecks(userDetails.getId(), "public"));
    }

    @PostMapping("/decks")
    @Operation(summary = "Tạo bộ flashcard mới")
    public ApiResponse<DeckDto> createDeck(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @Valid @RequestBody CreateDeckRequest request
    ) {
        return ApiResponse.ok(deckService.createDeck(userDetails.getId(), request), "Tạo bộ thẻ thành công");
    }

    @GetMapping("/decks/{id}")
    @Operation(summary = "Lấy chi tiết một bộ flashcard")
    public ApiResponse<DeckDto> getDeckDetail(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(deckService.getDeckDetail(userDetails.getId(), id));
    }

    @PutMapping("/decks/{id}")
    @Operation(summary = "Chỉnh sửa bộ flashcard")
    public ApiResponse<DeckDto> updateDeck(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody CreateDeckRequest request
    ) {
        return ApiResponse.ok(deckService.updateDeck(userDetails.getId(), id, request), "Cập nhật bộ thẻ thành công");
    }

    @DeleteMapping("/decks/{id}")
    @Operation(summary = "Xóa bộ flashcard")
    public ApiResponse<Void> deleteDeck(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        deckService.deleteDeck(userDetails.getId(), id);
        return ApiResponse.ok(null, "Xóa bộ thẻ thành công");
    }

    @PostMapping("/decks/{id}/clone")
    @Operation(summary = "Sao chép bộ thẻ mẫu/công khai thành bộ thẻ cá nhân")
    public ApiResponse<DeckDto> cloneDeck(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(deckService.cloneDeck(userDetails.getId(), id), "Sao chép bộ thẻ thành công");
    }

    @GetMapping("/decks/{id}/cards")
    @Operation(summary = "Lấy danh sách các thẻ trong bộ flashcard")
    public ApiResponse<List<FlashcardDto>> getCards(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(deckService.getCards(userDetails.getId(), id));
    }

    @PostMapping("/decks/{id}/cards")
    @Operation(summary = "Thêm thẻ thủ công vào bộ")
    public ApiResponse<FlashcardDto> addCard(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody CreateFlashcardRequest request
    ) {
        return ApiResponse.ok(deckService.addCard(userDetails.getId(), id, request), "Thêm thẻ thành công");
    }

    @PostMapping("/decks/{id}/cards/from-vocab")
    @Operation(summary = "Thêm các từ từ sổ từ vựng cá nhân vào bộ flashcard")
    public ApiResponse<List<FlashcardDto>> addCardsFromVocab(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody AddCardsFromVocabRequest request
    ) {
        return ApiResponse.ok(deckService.addCardsFromVocab(userDetails.getId(), id, request), "Đã thêm từ vào bộ thẻ");
    }

    @PutMapping({"/cards/{id}", "/decks/{deckId}/cards/{id}"})
    @Operation(summary = "Chỉnh sửa nội dung thẻ flashcard")
    public ApiResponse<FlashcardDto> updateCard(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody CreateFlashcardRequest request
    ) {
        return ApiResponse.ok(deckService.updateCard(userDetails.getId(), id, request), "Cập nhật thẻ thành công");
    }

    @DeleteMapping({"/cards/{id}", "/decks/{deckId}/cards/{id}"})
    @Operation(summary = "Xóa thẻ flashcard")
    public ApiResponse<Void> deleteCard(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id
    ) {
        deckService.deleteCard(userDetails.getId(), id);
        return ApiResponse.ok(null, "Xóa thẻ thành công");
    }
}
