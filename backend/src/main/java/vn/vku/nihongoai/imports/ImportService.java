package vn.vku.nihongoai.imports;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.flashcard.*;
import vn.vku.nihongoai.furigana.FuriganaService;
import vn.vku.nihongoai.imports.dto.CommitImportRequest;
import vn.vku.nihongoai.imports.dto.ImportPreviewResponse;
import vn.vku.nihongoai.imports.dto.ImportRowDto;
import vn.vku.nihongoai.imports.dto.ImportRowError;
import vn.vku.nihongoai.user.User;
import vn.vku.nihongoai.user.UserService;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportService {

    private final CsvParser csvParser;
    private final ExcelParser excelParser;
    private final ImportJobRepository importJobRepository;
    private final FlashcardRepository flashcardRepository;
    private final DeckRepository deckRepository;
    private final DeckService deckService;
    private final UserService userService;
    private final FuriganaService furiganaService;
    private final ObjectMapper objectMapper;

    public byte[] generateTemplate(String type) {
        String[] columns = {
                "Kanji",
                "Từ loại",
                "Nghĩa tiếng Việt",
                "Hiragana",
                "Hán Việt",
                "Ví dụ tiếng Nhật",
                "Hiragana ví dụ",
                "Dịch ví dụ"
        };

        String[][] samples = {
                {
                        "男性",
                        "Danh từ",
                        "Nam giới, đàn ông",
                        "だんせい",
                        "Nam tính",
                        "理想の男性と結婚する。",
                        "りそうのだんせいとけっこんする。",
                        "Kết hôn với người đàn ông lý tưởng."
                },
                {
                        "警察",
                        "Danh từ",
                        "Cảnh sát",
                        "けいさつ",
                        "Cảnh sát",
                        "自転車を盗まれたので、警察に届けた。",
                        "じてんしゃをぬすまれたので、けいさつにとどけた。",
                        "Vì bị trộm xe đạp nên tôi đã báo cảnh sát."
                },
                {
                        "図書館",
                        "Danh từ",
                        "Thư viện",
                        "としょかん",
                        "Đồ thư quán",
                        "図書館で日本語の本を借ります。",
                        "としょかんでにほんごのほんをかります。",
                        "Tôi mượn sách tiếng Nhật ở thư viện."
                }
        };

        return buildSpreadsheetBytes(type, "Flashcard Template", columns, samples);
    }

    public byte[] generateDialogueTemplate(String type) {
        String[] columns = {
                "Order",
                "Speaker",
                "Japanese",
                "Hiragana",
                "Vietnamese"
        };

        String[][] samples = {
                {
                        "1",
                        "A",
                        "おはようございます。初めまして、ミンと申します。",
                        "おはようございます。はじめまして、みんともうします。",
                        "Chào buổi sáng. Rất vui được gặp bạn, tôi tên là Minh."
                },
                {
                        "2",
                        "B",
                        "おはようございます！田中です。よろしくお願いします。",
                        "おはようございます！たなかです。よろしくおねがいします。",
                        "Chào buổi sáng! Tôi là Tanaka. Rất mong được giúp đỡ."
                },
                {
                        "3",
                        "A",
                        "ベトナムから来ました。趣味は日本語の勉強です。",
                        "べとなむからきました。しゅみはにほんごのべんきょうです。",
                        "Tôi đến từ Việt Nam. Sở thích của tôi là học tiếng Nhật."
                },
                {
                        "4",
                        "B",
                        "そうなんですね！これから一緒に頑張りましょう。",
                        "そうなんですね！これからいっしょにがんばりましょう。",
                        "Vậy à! Từ giờ hãy cùng nhau cố gắng nhé."
                }
        };

        return buildSpreadsheetBytes(type, "Dialogue Shadowing Template", columns, samples);
    }

    private byte[] buildSpreadsheetBytes(String type, String sheetName, String[] columns, String[][] samples) {
        if ("xlsx".equalsIgnoreCase(type)) {
            try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                Sheet sheet = workbook.createSheet(sheetName);
                CellStyle headerStyle = workbook.createCellStyle();
                Font headerFont = workbook.createFont();
                headerFont.setBold(true);
                headerStyle.setFont(headerFont);

                Row header = sheet.createRow(0);
                for (int i = 0; i < columns.length; i++) {
                    Cell c = header.createCell(i);
                    c.setCellValue(columns[i]);
                    c.setCellStyle(headerStyle);
                }

                for (int r = 0; r < samples.length; r++) {
                    Row sampleRow = sheet.createRow(r + 1);
                    for (int c = 0; c < samples[r].length; c++) {
                        sampleRow.createCell(c).setCellValue(samples[r][c]);
                    }
                }

                for (int i = 0; i < columns.length; i++) {
                    sheet.autoSizeColumn(i);
                }

                workbook.write(out);
                return out.toByteArray();
            } catch (IOException e) {
                throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi tạo tệp mẫu Excel");
            }
        } else {
            byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
            StringBuilder sb = new StringBuilder();
            sb.append(String.join(",", columns)).append("\n");
            for (String[] row : samples) {
                List<String> escaped = new ArrayList<>();
                for (String cell : row) {
                    escaped.add("\"" + cell.replace("\"", "\"\"") + "\"");
                }
                sb.append(String.join(",", escaped)).append("\n");
            }

            byte[] textBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
            byte[] result = new byte[bom.length + textBytes.length];
            System.arraycopy(bom, 0, result, 0, bom.length);
            System.arraycopy(textBytes, 0, result, bom.length, textBytes.length);
            return result;
        }
    }

    @Transactional
    public ImportPreviewResponse previewImport(Long userId, Long deckId, MultipartFile file) {
        Deck deck = deckId != null ? deckService.getMyDeckOrThrow(deckId, userId) : null;
        return previewDeckImportInternal(userId, deck, file);
    }

    @Transactional
    public ImportPreviewResponse previewAdminDeckImport(Long adminUserId, Long deckId, MultipartFile file) {
        Deck deck = deckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bộ thẻ mẫu hệ thống"));
        return previewDeckImportInternal(adminUserId, deck, file);
    }

    private ImportPreviewResponse previewDeckImportInternal(Long userId, Deck deck, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tệp tải lên rỗng");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new AppException(ErrorCode.FILE_TOO_LARGE, "Dung lượng tệp import tối đa 5MB");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "import.csv";
        String lower = filename.toLowerCase();
        boolean isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");
        ImportFileType fileType = isExcel ? ImportFileType.XLSX : ImportFileType.CSV;

        User user = userService.getUserOrThrow(userId);
        List<ImportRowDto> parsedRows = isExcel ? excelParser.parse(file) : csvParser.parse(file);

        if (parsedRows.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "File không có dữ liệu hoặc thiếu dòng tiêu đề hợp lệ");
        }
        if (parsedRows.size() > 2000) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Số lượng dòng tối đa cho phép là 2000 dòng");
        }

        List<ImportRowError> errors = new ArrayList<>();
        int validCount = 0;
        int duplicateCount = 0;
        Long deckId = deck != null ? deck.getId() : null;

        for (ImportRowDto row : parsedRows) {
            if (row.getWord() == null || row.getWord().isBlank()) {
                errors.add(ImportRowError.builder().row(row.getRowNumber()).field("Kanji").message("Từ tiếng Nhật bắt buộc").build());
            }
            if (row.getMeaningVi() == null || row.getMeaningVi().isBlank()) {
                errors.add(ImportRowError.builder().row(row.getRowNumber()).field("Nghĩa tiếng Việt").message("Nghĩa tiếng Việt bắt buộc").build());
            }
            if (row.isValid()) {
                validCount++;
                String cleanReading = (row.getReading() != null && !row.getReading().isBlank()) ? row.getReading().trim() : null;
                if (deckId != null && flashcardRepository.findByDeckIdAndFrontAndReading(deckId, row.getWord().trim(), cleanReading).isPresent()) {
                    row.setDuplicate(true);
                    duplicateCount++;
                }
            }
        }

        String rowsJson = "[]";
        try {
            rowsJson = objectMapper.writeValueAsString(parsedRows);
        } catch (Exception e) {
            log.warn("Error serializing import rows: {}", e.getMessage());
        }

        ImportJob job = ImportJob.builder()
                .user(user)
                .deck(deck)
                .targetType(deckId != null ? ImportTargetType.DECK : ImportTargetType.SYSTEM_VOCAB)
                .fileName(filename)
                .fileType(fileType)
                .totalRows(parsedRows.size())
                .successRows(0)
                .skippedRows(0)
                .errorRows(parsedRows.size() - validCount)
                .status(ImportJobStatus.PREVIEW)
                .errorReport(rowsJson)
                .build();

        job = importJobRepository.save(job);

        List<ImportRowDto> previewTop50 = parsedRows.subList(0, Math.min(50, parsedRows.size()));

        return ImportPreviewResponse.builder()
                .jobId(job.getId())
                .fileName(filename)
                .totalRows(parsedRows.size())
                .validRows(validCount)
                .errorRows(parsedRows.size() - validCount)
                .duplicateRows(duplicateCount)
                .previewRows(previewTop50)
                .errors(errors)
                .build();
    }

    /**
     * Commit import flashcard vào bảng flashcards (chỉ ghi flashcard, KHÔNG tạo card_progress hay user_vocabularies).
     */
    @Transactional
    public ImportJob commitImport(Long userId, CommitImportRequest request) {
        ImportJob job = importJobRepository.findByIdAndUserId(request.getJobId(), userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy phiên import"));

        if (job.getStatus() != ImportJobStatus.PREVIEW) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Phiên import này đã được xử lý hoặc bị hủy");
        }

        List<ImportRowDto> rows;
        try {
            rows = objectMapper.readValue(job.getErrorReport(), new TypeReference<List<ImportRowDto>>() {});
        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Lỗi đọc dữ liệu import tạm thời");
        }

        int success = 0;
        int skipped = 0;
        Deck deck = job.getDeck();
        String strategy = request.getOnDuplicate() != null ? request.getOnDuplicate().trim().toUpperCase() : "SKIP";

        if (deck != null) {
            int position = (int) flashcardRepository.countByDeckId(deck.getId());
            for (ImportRowDto row : rows) {
                if (!row.isValid()) {
                    skipped++;
                    continue;
                }

                String cleanWord = row.getWord().trim();
                String cleanReading = (row.getReading() != null && !row.getReading().isBlank()) ? row.getReading().trim() : null;
                var existingOpt = flashcardRepository.findByDeckIdAndFrontAndReading(deck.getId(), cleanWord, cleanReading);

                if (existingOpt.isPresent()) {
                    if ("UPDATE".equals(strategy)) {
                        Flashcard existing = existingOpt.get();
                        existing.setBack(row.getMeaningVi().trim());
                        if (row.getPartOfSpeech() != null && !row.getPartOfSpeech().isBlank()) {
                            existing.setPartOfSpeech(row.getPartOfSpeech().trim());
                        }
                        if (row.getHanViet() != null && !row.getHanViet().isBlank()) {
                            existing.setHanViet(row.getHanViet().trim());
                        }
                        if (row.getExampleJa() != null && !row.getExampleJa().isBlank()) {
                            existing.setExampleJa(row.getExampleJa().trim());
                        }
                        if (row.getExampleVi() != null && !row.getExampleVi().isBlank()) {
                            existing.setExampleVi(row.getExampleVi().trim());
                        }
                        if (row.getExampleReading() != null && !row.getExampleReading().isBlank()) {
                            existing.setExampleReading(row.getExampleReading().trim());
                        }
                        if (row.getNote() != null && !row.getNote().isBlank()) {
                            existing.setNote(row.getNote().trim());
                        }
                        flashcardRepository.save(existing);
                        success++;
                    } else {
                        skipped++;
                    }
                } else {
                    position++;
                    String autoNote = row.getNote();
                    if ((autoNote == null || autoNote.isBlank()) && row.getExampleReading() != null && !row.getExampleReading().isBlank()) {
                        autoNote = row.getExampleReading().trim()
                                + (row.getHanViet() != null && !row.getHanViet().isBlank() ? " (" + row.getHanViet().trim().toUpperCase() + ")" : "");
                    }

                    Flashcard fc = Flashcard.builder()
                            .deck(deck)
                            .front(cleanWord)
                            .reading(cleanReading)
                            .back(row.getMeaningVi().trim())
                            .partOfSpeech(row.getPartOfSpeech() != null && !row.getPartOfSpeech().isBlank() ? row.getPartOfSpeech().trim() : null)
                            .hanViet(row.getHanViet() != null && !row.getHanViet().isBlank() ? row.getHanViet().trim() : null)
                            .exampleJa(row.getExampleJa() != null && !row.getExampleJa().isBlank() ? row.getExampleJa().trim() : null)
                            .exampleVi(row.getExampleVi() != null && !row.getExampleVi().isBlank() ? row.getExampleVi().trim() : null)
                            .exampleReading(row.getExampleReading() != null && !row.getExampleReading().isBlank() ? row.getExampleReading().trim() : null)
                            .note(autoNote)
                            .position(position)
                            .build();

                    flashcardRepository.save(fc);
                    success++;
                }
            }
        }

        job.setSuccessRows(success);
        job.setSkippedRows(skipped);
        job.setStatus(ImportJobStatus.DONE);
        return importJobRepository.save(job);
    }

    /**
     * Đọc & kiểm tra file Excel/CSV cho Shadowing Hội thoại A/B (cột: Order, Speaker, Japanese, Hiragana, Vietnamese).
     */
    public Map<String, Object> parseDialogueFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Tệp tải lên rỗng");
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "dialogue.csv";
        String lower = filename.toLowerCase();
        boolean isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");

        List<Map<String, Object>> parsedRows = isExcel ? parseDialogueExcel(file) : parseDialogueCsv(file);
        if (parsedRows.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "File không có dòng hội thoại nào. Vui lòng kiểm tra cột Order, Speaker, Japanese, Hiragana, Vietnamese.");
        }

        List<Map<String, Object>> errors = new ArrayList<>();
        int validCount = 0;
        for (Map<String, Object> r : parsedRows) {
            if (Boolean.TRUE.equals(r.get("valid"))) {
                validCount++;
            } else {
                errors.add(Map.of(
                        "row", r.get("rowNumber"),
                        "message", String.valueOf(r.get("errorMessage"))
                ));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fileName", filename);
        result.put("totalRows", parsedRows.size());
        result.put("validRows", validCount);
        result.put("errorRows", parsedRows.size() - validCount);
        result.put("rows", parsedRows);
        result.put("errors", errors);
        return result;
    }

    private List<Map<String, Object>> parseDialogueExcel(MultipartFile file) {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (InputStream is = file.getInputStream(); Workbook workbook = WorkbookFactory.create(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getRow(0) == null) return rows;

            DataFormatter formatter = new DataFormatter();
            Map<String, Integer> colMap = new HashMap<>();
            for (Cell cell : sheet.getRow(0)) {
                String raw = formatter.formatCellValue(cell).trim();
                if (!raw.isEmpty()) {
                    colMap.put(raw.toLowerCase(), cell.getColumnIndex());
                    colMap.put(ExcelParser.normalizeHeader(raw), cell.getColumnIndex());
                }
            }

            int autoOrder = 1;
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                String orderStr = getExcelCell(row, colMap, formatter, "order", "stt", "thu tu", "thứ tự", "line_order", "lineorder");
                String speaker = getExcelCell(row, colMap, formatter, "speaker", "nguoi noi", "người nói", "nhan vat", "nhân vật", "vai");
                String ja = getExcelCell(row, colMap, formatter, "japanese", "japanese_text", "japanesetext", "tieng nhat", "tiếng nhật", "cau tieng nhat", "câu tiếng nhật", "text_ja");
                String hira = getExcelCell(row, colMap, formatter, "hiragana", "hiragana_text", "hiraganatext", "furigana", "reading", "cach doc");
                String vi = getExcelCell(row, colMap, formatter, "vietnamese", "vietnamese_translation", "vietnamesetranslation", "nghia", "nghĩa", "dich", "dịch", "tieng viet", "tiếng việt", "text_vi");

                if (orderStr.isEmpty() && speaker.isEmpty() && ja.isEmpty() && hira.isEmpty() && vi.isEmpty()) continue;

                rows.add(buildDialogueRow(r + 1, autoOrder++, orderStr, speaker, ja, hira, vi));
            }
        } catch (Exception e) {
            throw new AppException(ErrorCode.IMPORT_INVALID_FILE, "Không thể đọc tệp Excel hội thoại: " + e.getMessage());
        }
        return rows;
    }

    private List<Map<String, Object>> parseDialogueCsv(MultipartFile file) {
        List<Map<String, Object>> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            CSVFormat format = CSVFormat.DEFAULT.builder()
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .setIgnoreHeaderCase(true)
                    .setTrim(true)
                    .build();
            CSVParser parser = format.parse(reader);
            Map<String, String> headerMap = new HashMap<>();
            for (String h : parser.getHeaderNames()) {
                headerMap.put(ExcelParser.normalizeHeader(h), h);
                headerMap.put(h.replace("\uFEFF", "").trim().toLowerCase(), h);
            }

            int rowNum = 1;
            int autoOrder = 1;
            for (CSVRecord record : parser) {
                rowNum++;
                String orderStr = getCsvVal(record, headerMap, "order", "stt", "thu tu", "thứ tự", "line_order", "lineorder");
                String speaker = getCsvVal(record, headerMap, "speaker", "nguoi noi", "người nói", "nhan vat", "nhân vật", "vai");
                String ja = getCsvVal(record, headerMap, "japanese", "japanese_text", "japanesetext", "tieng nhat", "tiếng nhật", "cau tieng nhat", "câu tiếng nhật", "text_ja");
                String hira = getCsvVal(record, headerMap, "hiragana", "hiragana_text", "hiraganatext", "furigana", "reading", "cach doc");
                String vi = getCsvVal(record, headerMap, "vietnamese", "vietnamese_translation", "vietnamesetranslation", "nghia", "nghĩa", "dich", "dịch", "tieng viet", "tiếng việt", "text_vi");

                if (orderStr.isEmpty() && speaker.isEmpty() && ja.isEmpty() && hira.isEmpty() && vi.isEmpty()) continue;

                rows.add(buildDialogueRow(rowNum, autoOrder++, orderStr, speaker, ja, hira, vi));
            }
        } catch (Exception e) {
            throw new AppException(ErrorCode.IMPORT_INVALID_FILE, "Không thể đọc tệp CSV hội thoại: " + e.getMessage());
        }
        return rows;
    }

    private Map<String, Object> buildDialogueRow(int rowNum, int fallbackOrder, String orderStr, String speaker, String ja, String hira, String vi) {
        List<String> errs = new ArrayList<>();
        int lineOrder = fallbackOrder;
        if (orderStr != null && !orderStr.isBlank()) {
            try {
                lineOrder = Integer.parseInt(orderStr.replaceAll("[^0-9]", ""));
            } catch (Exception e) {
                errs.add("Thứ tự (Order) phải là số nguyên");
            }
        }
        String cleanSpeaker = (speaker != null && !speaker.isBlank()) ? speaker.trim() : (fallbackOrder % 2 == 1 ? "A" : "B");
        String cleanJa = ja != null ? ja.trim() : "";
        String cleanHira = hira != null ? hira.trim() : "";
        String cleanVi = vi != null ? vi.trim() : "";

        if (cleanJa.isEmpty()) {
            errs.add("Thiếu câu tiếng Nhật (Japanese)");
        } else if (cleanHira.isEmpty()) {
            cleanHira = furiganaService.toFullHiragana(cleanJa);
        }

        boolean valid = errs.isEmpty();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("rowNumber", rowNum);
        map.put("lineOrder", lineOrder);
        map.put("speaker", cleanSpeaker);
        map.put("japaneseText", cleanJa);
        map.put("hiraganaText", cleanHira);
        map.put("vietnameseTranslation", cleanVi);
        map.put("valid", valid);
        map.put("errorMessage", valid ? null : String.join("; ", errs));
        return map;
    }

    private String getExcelCell(Row row, Map<String, Integer> colMap, DataFormatter formatter, String... cols) {
        for (String col : cols) {
            Integer idx = colMap.get(col.toLowerCase());
            if (idx == null) idx = colMap.get(ExcelParser.normalizeHeader(col));
            if (idx != null) {
                Cell c = row.getCell(idx);
                if (c != null) {
                    String val = formatter.formatCellValue(c).trim();
                    if (!val.isEmpty()) return val;
                }
            }
        }
        return "";
    }

    private String getCsvVal(CSVRecord record, Map<String, String> headerMap, String... cols) {
        for (String col : cols) {
            String actual = headerMap.get(col.toLowerCase());
            if (actual == null) actual = headerMap.get(ExcelParser.normalizeHeader(col));
            if (actual != null && record.isMapped(actual)) {
                String v = record.get(actual).trim();
                if (!v.isEmpty()) return v;
            }
        }
        return "";
    }
}
