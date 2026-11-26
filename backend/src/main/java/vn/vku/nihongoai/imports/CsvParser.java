package vn.vku.nihongoai.imports;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import vn.vku.nihongoai.common.AppException;
import vn.vku.nihongoai.common.ErrorCode;
import vn.vku.nihongoai.imports.dto.ImportRowDto;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class CsvParser {

    public List<ImportRowDto> parse(MultipartFile file) {
        List<ImportRowDto> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            CSVFormat format = CSVFormat.DEFAULT.builder()
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .setIgnoreHeaderCase(true)
                    .setTrim(true)
                    .build();

            CSVParser parser = format.parse(reader);
            Map<String, String> normalizedHeaderMap = new HashMap<>();
            for (String h : parser.getHeaderNames()) {
                normalizedHeaderMap.put(ExcelParser.normalizeHeader(h), h);
                normalizedHeaderMap.put(h.replace("\uFEFF", "").trim().toLowerCase(), h);
            }

            int rowNum = 1; // 1 is header

            for (CSVRecord record : parser) {
                rowNum++;
                String word = getFirstVal(record, normalizedHeaderMap,
                        "kanji", "word", "front", "japanesetext", "tu tieng nhat", "từ tiếng nhật");
                String partOfSpeech = getFirstVal(record, normalizedHeaderMap,
                        "tu loai", "từ loại", "part_of_speech", "partofspeech");
                String meaningVi = getFirstVal(record, normalizedHeaderMap,
                        "nghia tieng viet", "nghĩa tiếng việt", "nghia", "nghĩa", "meaning_vi", "meaning", "back", "vietnamesemeaning");
                String reading = getFirstVal(record, normalizedHeaderMap,
                        "hiragana", "reading", "cach doc", "cách đọc");
                String hanViet = getFirstVal(record, normalizedHeaderMap,
                        "han viet", "hán việt", "han_viet", "hanviet", "sinovietnamese");
                String romaji = getFirstVal(record, normalizedHeaderMap, "romaji");
                String jlptLevel = getFirstVal(record, normalizedHeaderMap, "jlpt_level", "jlptlevel", "jlpt");
                String rawExample = getFirstVal(record, normalizedHeaderMap,
                        "vi du tieng nhat (kem dich)", "ví dụ tiếng nhật (kèm dịch)", "vi du tieng nhat",
                        "example_ja", "examplesentence", "example");
                String exampleVi = getFirstVal(record, normalizedHeaderMap,
                        "dich vi du", "dịch ví dụ", "example_vi", "examplemeaning");
                String exampleReading = getFirstVal(record, normalizedHeaderMap,
                        "hiragana vi du", "hiragana ví dụ", "example_reading", "examplereading", "examplehiragana");
                String note = getFirstVal(record, normalizedHeaderMap, "note", "notes", "ghi chu");

                if (word.isEmpty() && meaningVi.isEmpty() && reading.isEmpty() && rawExample.isEmpty()) continue;

                String exampleJa = rawExample;
                if (!rawExample.isEmpty() && exampleVi.isEmpty()) {
                    String[] split = ExcelParser.splitExampleWithTranslation(rawExample);
                    exampleJa = split[0];
                    exampleVi = split[1];
                }

                List<String> errs = new ArrayList<>();
                if (word.isEmpty()) errs.add("Thiếu từ tiếng Nhật (Kanji/Kana)");
                if (meaningVi.isEmpty()) errs.add("Thiếu nghĩa tiếng Việt");
                boolean valid = errs.isEmpty();

                rows.add(ImportRowDto.builder()
                        .rowNumber(rowNum)
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
            throw new AppException(ErrorCode.IMPORT_INVALID_FILE, "Không thể đọc tệp CSV: " + e.getMessage());
        }
        return rows;
    }

    private String getFirstVal(CSVRecord record, Map<String, String> headerMap, String... cols) {
        for (String col : cols) {
            String actualHeader = headerMap.get(col.toLowerCase());
            if (actualHeader == null) {
                actualHeader = headerMap.get(ExcelParser.normalizeHeader(col));
            }
            if (actualHeader != null && record.isMapped(actualHeader)) {
                String v = record.get(actualHeader).trim();
                if (!v.isEmpty()) return v;
            }
        }
        return "";
    }
}
