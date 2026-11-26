package vn.vku.nihongoai.imports;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.ApiResponse;
import vn.vku.nihongoai.imports.dto.CommitImportRequest;
import vn.vku.nihongoai.imports.dto.ImportPreviewResponse;
import vn.vku.nihongoai.security.UserDetailsImpl;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Deck Import", description = "Import Flashcard từ tệp CSV hoặc Excel (Preview và Commit)")
public class TemplateController {

    private final ImportService importService;

    @GetMapping({"/decks/{id}/import/template", "/templates/flashcard"})
    @Operation(summary = "Tải về tệp mẫu CSV hoặc Excel (.xlsx) chuẩn để nhập từ vựng")
    public ResponseEntity<byte[]> downloadTemplate(@RequestParam(defaultValue = "csv") String type) {
        byte[] bytes = importService.generateTemplate(type);
        String filename = "xlsx".equalsIgnoreCase(type) ? "flashcards_template.xlsx" : "flashcards_template.csv";
        MediaType mediaType = "xlsx".equalsIgnoreCase(type) ?
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") :
                MediaType.parseMediaType("text/csv; charset=UTF-8");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(mediaType)
                .body(bytes);
    }

    @GetMapping("/templates/flashcard.csv")
    public ResponseEntity<byte[]> downloadCsvTemplate() {
        return downloadTemplate("csv");
    }

    @GetMapping("/templates/flashcard.xlsx")
    public ResponseEntity<byte[]> downloadXlsxTemplate() {
        return downloadTemplate("xlsx");
    }

    @GetMapping({"/templates/dialogue", "/admin/shadowing/import/template"})
    @Operation(summary = "Tải về tệp mẫu Excel/CSV cho Shadowing Hội thoại A/B")
    public ResponseEntity<byte[]> downloadDialogueTemplate(@RequestParam(defaultValue = "xlsx") String type) {
        byte[] bytes = importService.generateDialogueTemplate(type);
        String filename = "xlsx".equalsIgnoreCase(type) ? "shadowing_dialogue_template.xlsx" : "shadowing_dialogue_template.csv";
        MediaType mediaType = "xlsx".equalsIgnoreCase(type) ?
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") :
                MediaType.parseMediaType("text/csv; charset=UTF-8");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(mediaType)
                .body(bytes);
    }

    @GetMapping("/templates/dialogue.csv")
    public ResponseEntity<byte[]> downloadDialogueCsvTemplate() {
        return downloadDialogueTemplate("csv");
    }

    @GetMapping("/templates/dialogue.xlsx")
    public ResponseEntity<byte[]> downloadDialogueXlsxTemplate() {
        return downloadDialogueTemplate("xlsx");
    }

    @PostMapping(value = "/decks/{id}/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải file lên để xem trước kiểm tra lỗi (chưa ghi database)")
    public ApiResponse<ImportPreviewResponse> previewImport(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file
    ) {
        return ApiResponse.ok(importService.previewImport(userDetails.getId(), id, file));
    }

    @PostMapping("/decks/{id}/import/commit")
    @Operation(summary = "Xác nhận ghi các dòng hợp lệ vào bộ flashcard (tùy chọn SKIP hoặc UPDATE khi trùng)")
    public ApiResponse<ImportJob> commitImport(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long id,
            @Valid @RequestBody CommitImportRequest request
    ) {
        return ApiResponse.ok(importService.commitImport(userDetails.getId(), request), "Import bộ thẻ thành công");
    }
}
