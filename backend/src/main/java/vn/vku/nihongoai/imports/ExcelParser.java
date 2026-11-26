package vn.vku.nihongoai.imports;

import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.imports.dto.ImportRowDto;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.*;

@Component
public class ExcelParser {

    public List<ImportRowDto> parse(MultipartFile file) {
        List<ImportRowDto> rows = new ArrayList<>();
        try (InputStream is = file.getInputStream(); Workbook workbook = WorkbookFactory.create(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                return rows;
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return rows;
            }

            DataFormatter formatter = new DataFormatter();
            Map<String, Integer> colMap = new HashMap<>();
            for (Cell cell : headerRow) {
                String rawHeader = formatter.formatCellValue(cell).trim();
                if (!rawHeader.isEmpty()) {
                    colMap.put(rawHeader.toLowerCase(), cell.getColumnIndex());
                    colMap.put(normalizeHeader(rawHeader), cell.getColumnIndex());
                }
            }

            int total = sheet.getLastRowNum();

            for (int r = 1; r <= total; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                String word = getFirstCell(row, colMap, formatter,
                        "kanji", "word", "front", "japanesetext", "tu tieng nhat", "từ tiếng nhật");
                String partOfSpeech = getFirstCell(row, colMap, formatter,
                        "tu loai", "từ loại", "part_of_speech", "partofspeech");
                String meaningVi = getFirstCell(row, colMap, formatter,
                        "nghia tieng viet", "nghĩa tiếng việt", "nghia", "nghĩa", "meaning_vi", "meaning", "back", "vietnamesemeaning");
                String reading = getFirstCell(row, colMap, formatter,
                        "hiragana", "reading", "cach doc", "cách đọc");
                String hanViet = getFirstCell(row, colMap, formatter,
                        "han viet", "hán việt", "han_viet", "hanviet", "sinovietnamese");
                String romaji = getFirstCell(row, colMap, formatter, "romaji");
                String jlptLevel = getFirstCell(row, colMap, formatter, "jlpt_level", "jlptlevel", "jlpt", "cap do");
                String rawExample = getFirstCell(row, colMap, formatter,
                        "vi du tieng nhat (kem dich)", "ví dụ tiếng nhật (kèm dịch)", "vi du tieng nhat", "ví dụ tiếng nhật",
                        "vi du", "ví dụ", "example_ja", "examplesentence", "example");
                String exampleVi = getFirstCell(row, colMap, formatter,
                        "dich vi du", "dịch ví dụ", "example_vi", "examplemeaning");
                String exampleReading = getFirstCell(row, colMap, formatter,
                        "hiragana vi du", "hiragana ví dụ", "example_reading", "examplereading", "examplehiragana");
                String note = getFirstCell(row, colMap, formatter, "note", "notes", "ghi chu", "ghi chú");

                if (word.isEmpty() && meaningVi.isEmpty() && reading.isEmpty() && rawExample.isEmpty()) {
                    continue; // skip completely blank row
                }

                // Tách câu ví dụ tiếng Nhật kèm dịch trong ngoặc nếu cột dịch ví dụ riêng đang trống
                String exampleJa = rawExample;
                if (!rawExample.isEmpty() && exampleVi.isEmpty()) {
                    String[] split = splitExampleWithTranslation(rawExample);
                    exampleJa = split[0];
                    exampleVi = split[1];
                }

                List<String> errs = new ArrayList<>();
                if (word.isEmpty()) errs.add("Thiếu từ tiếng Nhật (Kanji/Kana)");
                if (meaningVi.isEmpty()) errs.add("Thiếu nghĩa tiếng Việt");
                boolean valid = errs.isEmpty();

                rows.add(ImportRowDto.builder()
                        .rowNumber(r + 1)
                        .word(word)
                        .reading(reading)
                        .romaji(romaji)
                        .meaningVi(meaningVi)
                        .partOfSpeech(partOfSpeech)
                        .hanViet(hanViet)
                        .jlptLevel(jlptLevel)
                        .exampleJa(exampleJa)
                        .exampleVi(exampleVi)
                        .exampleReading(exampleReading)
                        .note(note)
                        .valid(valid)
                        .errorMessage(valid ? null : String.join("; ", errs))
                        .build());
            }
        } catch (Exception e) {
            throw new AppException(ErrorCode.IMPORT_INVALID_FILE, "Không thể đọc tệp Excel: " + e.getMessage());
        }
        return rows;
    }

    public static String[] splitExampleWithTranslation(String raw) {
        String trimmed = raw.trim();
        int openParen = trimmed.lastIndexOf('(');
        int closeParen = trimmed.lastIndexOf(')');
        if (openParen < 0) {
            openParen = trimmed.lastIndexOf('（');
            closeParen = trimmed.lastIndexOf('）');
        }
        if (openParen > 0 && closeParen > openParen && closeParen >= trimmed.length() - 2) {
            String ja = trimmed.substring(0, openParen).trim();
            String vi = trimmed.substring(openParen + 1, closeParen).trim();
            return new String[]{ja, vi};
        }
        return new String[]{trimmed, ""};
    }

    public static String normalizeHeader(String input) {
        if (input == null) return "";
        String clean = input.replace("\uFEFF", "").trim().toLowerCase();
        String nfd = Normalizer.normalize(clean, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace('đ', 'd')
                .replaceAll("\\s+", " ");
    }

    private String getFirstCell(Row row, Map<String, Integer> colMap, DataFormatter formatter, String... cols) {
        for (String col : cols) {
            String val = getCell(row, colMap, col, formatter);
            if (!val.isEmpty()) return val;
            String normVal = getCell(row, colMap, normalizeHeader(col), formatter);
            if (!normVal.isEmpty()) return normVal;
        }
        return "";
    }

    private String getCell(Row row, Map<String, Integer> colMap, String colName, DataFormatter formatter) {
        Integer idx = colMap.get(colName.toLowerCase());
        if (idx == null) return "";
        Cell cell = row.getCell(idx);
        if (cell == null) return "";
        return formatter.formatCellValue(cell).trim();
    }
}
