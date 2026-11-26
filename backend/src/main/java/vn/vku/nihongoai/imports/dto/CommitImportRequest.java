package vn.vku.nihongoai.imports.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CommitImportRequest {
    @NotNull(message = "jobId không được để trống")
    private Long jobId;

    @com.fasterxml.jackson.annotation.JsonAlias({"onDuplicate", "duplicateStrategy"})
    private String onDuplicate = "SKIP"; // SKIP hoặc UPDATE
}
