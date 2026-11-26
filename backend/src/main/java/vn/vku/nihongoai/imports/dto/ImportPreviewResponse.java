package vn.vku.nihongoai.imports.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportPreviewResponse {
    private Long jobId;
    private String fileName;
    private int totalRows;
    private int validRows;
    private int errorRows;
    private int duplicateRows;
    private List<ImportRowDto> previewRows;
    private List<ImportRowError> errors;
}
